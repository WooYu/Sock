import { bollinger, movingAverage } from '../chart/chart-math'
import { isIsoTimestamp } from '../chart/chart-periods'
import type { Candle } from '../workspace/stock-workspace-types'
import { barEndAt, futureBarTargets } from './scenario-calendar'
import type { AnalysisInput, AnalysisKind, AnalysisPeriod, CloseScenario, Horizon, Indicator, PeriodInput, PriceReference } from './scenario-types'
export type ReferenceOptions = { kind?: AnalysisKind; period: AnalysisPeriod; method: PriceReference['method']; horizons: Horizon[]; scenario?: CloseScenario; executionWindow: PriceReference['executionWindow'] }
export const SCENARIO_INDICATORS: Indicator[] = ['ma5', 'ma10', 'ma20', 'bollUpper', 'bollMiddle', 'bollLower']
export function indicatorSeries(candles: Candle[]): Record<Indicator, Array<number | null>> {
  const bands = bollinger(candles, 20, 2)
  return { ma5: movingAverage(candles, 5), ma10: movingAverage(candles, 10), ma20: movingAverage(candles, 20),
    bollUpper: bands.upper, bollMiddle: bands.middle, bollLower: bands.lower }
}
export function createFlatScenario(input: PeriodInput): CloseScenario {
  const origin = input.closed.at(-1)
  if (!origin) throw new Error('基准情景需要完整K线')
  return { id: 'base:' + input.period + ':' + origin.day, symbol: input.symbol, period: input.period, originBarKey: origin.day,
    kind: 'base', closes: Array<number>(4).fill(origin.close), condition: '后三根（或第四根）收盘保持原点收盘价', selectedAt: input.asOf, evidence: [] }
}
export function computeReferences(input: AnalysisInput, options: ReferenceOptions): PriceReference[] {
  const periodInput = input.periods[options.period]
  if (!periodInput?.closed.length) return []
  if (periodInput.symbol !== input.symbol || periodInput.asOf !== input.asOf || periodInput.adjustment !== 'none') throw new Error('分析输入口径或时间不一致')
  const origin = periodInput.closed.at(-1)!
  const rolling = options.method === 'rolling_close'
  if (!['rolling_close', 'average_delta', 'last_delta'].includes(options.method)) throw new Error('参数计算方法无效')
  const scenario = rolling ? options.scenario ?? createFlatScenario(periodInput) : null
  if (scenario) {
    if (scenario.symbol !== input.symbol || scenario.period !== options.period || scenario.originBarKey !== origin.day
      || !scenario.condition.trim() || !isIsoTimestamp(scenario.selectedAt) || (options.kind !== 'replay' && Date.parse(scenario.selectedAt) > Date.parse(input.asOf))) throw new Error('情景的股票、周期、原点或选择时点无效')
    if (scenario.closes.length < Math.max(...options.horizons)
      || !scenario.closes.every(c => Number.isFinite(c) && c > 0)) throw new Error('情景收盘价必须为有限正数且覆盖目标根数')
  }
  const calendar = input.calendar && Date.parse(input.calendar.verifiedAt) <= Date.parse(input.asOf) ? input.calendar : null
  const targets = futureBarTargets(options.period, origin.day, options.horizons, calendar)
  const past = indicatorSeries(periodInput.closed)
  const future = scenario ? indicatorSeries([...periodInput.closed, ...scenario.closes.map((close, i) => ({
    day: 'scenario-' + (i + 1), open: close, high: close, low: close, close, volume: 0,
  }))]) : null
  const refs: PriceReference[] = []
  for (const target of targets) {
    const group = SCENARIO_INDICATORS.map(indicator => {
      let value: number | null = null
      const issues = [...target.issues]
      const current = past[indicator].at(-1)
      const prev = past[indicator].at(-2)
      const earlier = past[indicator].at(-3)
      const observedWindow = indicator.startsWith('boll') || indicator === 'ma20' ? 20 : indicator === 'ma10' ? 10 : 5
      if (future && periodInput.closed.length >= observedWindow) value = future[indicator][periodInput.closed.length + target.horizon - 1]
      else if (current != null && prev != null && (options.method === 'last_delta' || earlier != null)) {
        const delta = options.method === 'last_delta' ? current - prev : (current - earlier!) / 2
        value = current + delta * target.horizon
      }
      if (value == null) issues.push('history_insufficient')
      else if (!Number.isFinite(value)) { value = null; issues.push('nonfinite_reference') }
      else if (value <= 0) issues.push('nonpositive_reference')
      const valid = value !== null && Number.isFinite(value) && value > 0
      return {
        id: [input.symbol, options.period, origin.day, options.method, scenario?.id ?? '', indicator, target.horizon].join('|'),
        period: options.period, indicator, method: options.method, scenarioId: scenario?.id ?? null,
        originBarKey: origin.day, originEndAt: barEndAt(options.period, origin.day), asOf: input.asOf,
        target, executionWindow: options.executionWindow, value, valid, issues,
      } satisfies PriceReference
    })
    const bands = group.filter(r => r.indicator.startsWith('boll'))
    const [upper, middle, lower] = bands
    if (upper.value != null && middle.value != null && lower.value != null
      && !(lower.value <= middle.value && middle.value <= upper.value)) {
      for (const band of bands) { band.valid = false; band.issues.push('invalid_boll_order') }
    } else if (bands.some(r => !r.valid)) {
      for (const band of bands) { band.valid = false; if (!band.issues.includes('history_insufficient')) band.issues.push('invalid_boll_values') }
    }
    refs.push(...group)
  }
  return refs
}
