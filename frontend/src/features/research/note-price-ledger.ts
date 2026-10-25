import { isCalendarDate, isIsoTimestamp } from '../chart/chart-periods'
import { indicatorSeries } from '../scenario/scenario-calculator'
import { barEndAt } from '../scenario/scenario-calendar'
import { validCandle } from '../scenario/scenario-inputs'
import type { AnalysisInput, PeriodInput } from '../scenario/scenario-types'
import { runNotePriceModels, NOTE_PRICE_VERSION, type NotePriceConfig, type NotePriceRun } from './note-price-models'

export const NOTE_PRICE_STORAGE_KEY = 'stockcal.note-price-shadow.v1'
export const NOTE_PRICE_EVALUATION_KEY = 'stockcal.note-price-evaluations.v1'
export type NotePriceSnapshot = {
  schemaVersion: 1; id: string; createdAt: string; timing: 'local_before_window' | 'replay' | 'unresolved' | 'demo'
  input: AnalysisInput; run: NotePriceRun
}
function timing(input: AnalysisInput, run: NotePriceRun, createdAt: string): NotePriceSnapshot['timing'] {
  if (input.sourceMode === 'demo') return 'demo'
  const target = run.results[0]?.priceTarget.barKey
  if (!target) return 'unresolved'
  return Date.parse(createdAt) < Date.parse(target + 'T09:30:00+08:00') ? 'local_before_window' : 'replay'
}
export function freezeNotePriceSnapshot(input: AnalysisInput, config: NotePriceConfig, id: string, createdAt: string): NotePriceSnapshot {
  if (!id.trim() || !isIsoTimestamp(createdAt) || Date.parse(createdAt) < Date.parse(input.asOf)) throw new Error('保存时间不得早于行情截止时间。')
  if (input.periods.day && (!isIsoTimestamp(input.periods.day.source.fetchedAt)
    || Date.parse(createdAt) < Date.parse(input.periods.day.source.fetchedAt))) throw new Error('保存时间不得早于行情实际采集时间。')
  const frozen: AnalysisInput = structuredClone({ ...input, periods: input.periods.day ? { day: input.periods.day } : {} })
  const run = runNotePriceModels(frozen, config)
  if (!run.origin || !run.results.some(result => result.status === 'computed')) throw new Error('没有可冻结的有效计算结果。')
  return { schemaVersion: 1, id, createdAt, timing: timing(frozen, run, createdAt), input: frozen, run }
}
export function parseNotePriceSnapshots(raw: string | null): NotePriceSnapshot[] {
  if (raw === null) return []
  try {
    const ledger = JSON.parse(raw)
    if (ledger.schemaVersion !== 1 || !Array.isArray(ledger.records) || ledger.records.length > 500) throw new Error()
    const ids = new Set<string>()
    for (const record of ledger.records as NotePriceSnapshot[]) {
      if (record.schemaVersion !== 1 || typeof record.id !== 'string' || ids.has(record.id)
        || record.run.definitionVersion !== NOTE_PRICE_VERSION || !['real', 'demo'].includes(record.input.sourceMode)
        || !/^(?:\d{6}|sh000001|DEMO)$/.test(record.input.symbol)) throw new Error()
      const expected = freezeNotePriceSnapshot(record.input, record.run.config, record.id, record.createdAt)
      if (JSON.stringify(record.run) !== JSON.stringify(expected.run) || record.timing !== expected.timing) throw new Error()
      ids.add(record.id)
    }
    return ledger.records
  } catch { throw new Error('笔记价格记录损坏或版本不支持；原有内容未被覆盖，请先导出原始备份。') }
}
export function appendNotePriceSnapshot(storage: Pick<Storage, 'getItem' | 'setItem'>, record: NotePriceSnapshot): NotePriceSnapshot[] {
  const records = parseNotePriceSnapshots(storage.getItem(NOTE_PRICE_STORAGE_KEY))
  if (records.some(old => old.id === record.id)) throw new Error('记录ID已存在，不能覆盖冻结结果。')
  const next = [...records, record]
  parseNotePriceSnapshots(JSON.stringify({ schemaVersion: 1, records: next }))
  storage.setItem(NOTE_PRICE_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, records: next }))
  return next
}

export type NotePriceScore = {
  modelId: string; status: 'evaluated' | 'waiting' | 'not_issued' | 'basis_changed'; reason: string
  actualHigh: number | null; relativeError: number | null; withinOnePercent: boolean | null
  previousHighError: number | null; previousCloseError: number | null; unconditionalError: number | null
  boundaryHeld: boolean | null; indicatorRelativeError: number | null
}
export function evaluateNotePriceSnapshot(snapshot: NotePriceSnapshot, actual: PeriodInput): NotePriceScore[] {
  const frozen = snapshot.input.periods.day!
  const cutoff = Math.min(Date.parse(actual.asOf), Date.parse(actual.source.fetchedAt))
  const origin = actual.closed.find(bar => bar.day === snapshot.run.origin)
  const basisChanged = actual.symbol !== snapshot.input.symbol || actual.period !== 'day' || actual.adjustment !== frozen.adjustment
    || !origin || frozen.closed.some(old => {
      const current = actual.closed.find(bar => bar.day === old.day)
      return current && (['open', 'high', 'low', 'close'] as const).some(key => Math.abs(current[key] - old[key]) > .005)
    })
  const actualValid = isIsoTimestamp(actual.asOf) && isIsoTimestamp(actual.source.fetchedAt) && actual.closed.every((bar, i) =>
    validCandle(bar) && isCalendarDate(bar.day) && Date.parse(barEndAt('day', bar.day)) <= cutoff && (i === 0 || bar.day > actual.closed[i - 1].day))
  const actualIndicators = actualValid ? indicatorSeries(actual.closed) : null
  return snapshot.run.results.map(result => {
    const score: NotePriceScore = { modelId: result.card.id, status: 'waiting', reason: '', actualHigh: null, relativeError: null,
      withinOnePercent: null, previousHighError: null, previousCloseError: null, unconditionalError: null,
      boundaryHeld: null, indicatorRelativeError: null }
    if (result.status !== 'computed' || result.value === null) return { ...score, status: 'not_issued', reason: result.reason }
    if (!actualValid || !actualIndicators) return { ...score, reason: '核对行情不完整或含有无效、未结束日线' }
    if (basisChanged) return { ...score, status: 'basis_changed', reason: '股票、周期、价格口径或原点历史已变化，暂不跨基准评分' }
    const key = result.priceTarget.barKey
    const bar = actual.closed.find(bar => bar.day === key)
    if (!key || !bar || !validCandle(bar) || !Number.isFinite(cutoff) || Date.parse(barEndAt('day', key)) > cutoff) {
      return { ...score, reason: key ? '等待目标完整日K' : '目标日期未核实，不按自然日补造' }
    }
    score.status = 'evaluated'
    if (result.card.role === 'boundary') {
      score.boundaryHeld = bar.close >= result.value
      score.reason = '仅核对收盘是否达到临界价，不将阈值当作收盘预测评分'
    } else {
      const error = (value: number) => Math.abs(value - bar.high) / bar.high
      score.actualHigh = bar.high
      score.relativeError = error(result.value)
      score.withinOnePercent = score.relativeError < .01
      score.previousHighError = error(result.baselines.previousHigh)
      score.previousCloseError = error(result.baselines.previousClose)
      score.unconditionalError = result.baselines.unconditional === null ? null : error(result.baselines.unconditional)
      score.reason = '按事先声明的最高价目标评分；未验证分钟压力反应，也不是交易胜率'
    }
    const indicatorIndex = actual.closed.findIndex(bar => bar.day === result.indicatorTarget?.barKey)
    const indicatorKey = result.card.id === 'climb_high' ? 'bollUpper' : 'ma5'
    const indicatorValue = indicatorIndex >= 0 ? actualIndicators[indicatorKey][indicatorIndex] : null
    if (result.card.role !== 'boundary' && indicatorValue != null && indicatorValue > 0
      && Date.parse(barEndAt('day', actual.closed[indicatorIndex].day)) <= cutoff) {
      score.indicatorRelativeError = Math.abs(result.value - indicatorValue) / indicatorValue
    }
    return score
  })
}

export type NotePriceEvaluation = { schemaVersion: 1; id: string; evaluatedAt: string; forecast: NotePriceSnapshot; actual: PeriodInput; scores: NotePriceScore[] }
export function freezeNotePriceEvaluation(forecast: NotePriceSnapshot, actual: PeriodInput, id: string, evaluatedAt: string): NotePriceEvaluation {
  parseNotePriceSnapshots(JSON.stringify({ schemaVersion: 1, records: [forecast] }))
  if (!id.trim() || !isIsoTimestamp(evaluatedAt) || Date.parse(evaluatedAt) < Math.max(Date.parse(actual.asOf), Date.parse(actual.source.fetchedAt), Date.parse(forecast.createdAt))) throw new Error('核对保存时间早于预测或核对行情时间。')
  const scores = evaluateNotePriceSnapshot(forecast, actual)
  if (!scores.some(score => score.status === 'evaluated' || score.status === 'basis_changed')) throw new Error('目标日尚未完成，暂不冻结核对结果。')
  return structuredClone({ schemaVersion: 1, id, evaluatedAt, forecast, actual, scores })
}
export function parseNotePriceEvaluations(raw: string | null): NotePriceEvaluation[] {
  if (raw === null) return []
  try {
    const ledger = JSON.parse(raw)
    if (ledger.schemaVersion !== 1 || !Array.isArray(ledger.evaluations) || ledger.evaluations.length > 500) throw new Error()
    const ids = new Set<string>()
    for (const record of ledger.evaluations as NotePriceEvaluation[]) {
      if (record.schemaVersion !== 1 || ids.has(record.id)) throw new Error()
      const expected = freezeNotePriceEvaluation(record.forecast, record.actual, record.id, record.evaluatedAt)
      if (JSON.stringify(expected.scores) !== JSON.stringify(record.scores)) throw new Error()
      ids.add(record.id)
    }
    return ledger.evaluations
  } catch { throw new Error('笔记核对历史损坏或版本不支持，原有结果未被覆盖。') }
}
export function appendNotePriceEvaluation(storage: Pick<Storage, 'getItem' | 'setItem'>, record: NotePriceEvaluation) {
  const evaluations = parseNotePriceEvaluations(storage.getItem(NOTE_PRICE_EVALUATION_KEY))
  if (evaluations.some(old => old.id === record.id)) throw new Error('核对ID已存在，不能覆盖历史评分。')
  const next = [...evaluations, record]
  const raw = JSON.stringify({ schemaVersion: 1, evaluations: next })
  parseNotePriceEvaluations(raw)
  storage.setItem(NOTE_PRICE_EVALUATION_KEY, raw)
  return next
}
