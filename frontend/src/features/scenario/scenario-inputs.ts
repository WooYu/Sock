import { canonicalPeriodTime, isIsoTimestamp } from '../chart/chart-periods'
import { validMarketSymbol } from '@/lib/api/market-symbol'
import type { ChartSeries } from '../chart/chart-market-types'
import type { Candle } from '../workspace/stock-workspace-types'
import { ANALYSIS_PERIODS, barEndAt, sessionEnds } from './scenario-calendar'
import type { AnalysisPeriod, PeriodInput } from './scenario-types'

export function validCandle(bar: Candle): boolean {
  return [bar.open, bar.high, bar.low, bar.close].every(v => Number.isFinite(v) && v > 0)
    && Number.isFinite(bar.volume) && bar.volume >= 0 && bar.low <= Math.min(bar.open, bar.close)
    && bar.high >= Math.max(bar.open, bar.close) && bar.low <= bar.high
}
function sameValues(a: Candle, b: Candle): boolean {
  return (['open', 'high', 'low', 'close', 'volume', 'turnover', 'averagePrice'] as const).every(k => a[k] === b[k])
}
function knownMinuteGap(before: string, next: string, period: AnalysisPeriod): boolean {
  if (period === 'day') return false
  const ends = sessionEnds(period)
  const first = ends.indexOf(before.slice(11, 16)), second = ends.indexOf(next.slice(11, 16))
  if (before.slice(0, 10) === next.slice(0, 10)) return second !== first + 1
  return first !== ends.length - 1 || second !== 0
}
export function normalizeScenarioSeries(series: ChartSeries, asOf: string): PeriodInput {
  if (!ANALYSIS_PERIODS.includes(series.period as AnalysisPeriod) || series.kind !== 'candles') throw new Error('分析周期无效')
  if (series.adjustment !== 'none' && !(series.period === 'day' && series.adjustment === 'qfq')) throw new Error('行情复权口径无效')
  if (series.symbol !== 'DEMO' && !validMarketSymbol.test(series.symbol)) throw new Error('股票代码无效')
  if (!isIsoTimestamp(asOf) || !series.source || !isIsoTimestamp(series.source.fetchedAt) || !Array.isArray(series.bars)) throw new Error('行情来源或截止时间无效')
  const period = series.period as AnalysisPeriod
  const cutoff = Math.min(Date.parse(asOf), Date.parse(series.source.fetchedAt))
  const localDay = new Date(cutoff + 8 * 3600_000).toISOString().slice(0, 10)
  const grouped = new Map<string, Candle[]>()
  const issues: string[] = ['calendar_history_unverified']
  if (series.limitedHistory) issues.push('limited_history')
  if (series.note) issues.push(series.note)
  for (const raw of series.bars) {
    if (!raw || typeof raw.day !== 'string') { issues.push('invalid_bar_time'); continue }
    if (raw.day.slice(0, 10) > localDay) continue
    let key: string
    try { key = canonicalPeriodTime(raw.day, period) } catch { issues.push('invalid_bar_time:' + raw.day); continue }
    const end = Date.parse(barEndAt(period, key))
    if (end > cutoff && period !== 'day') {
      const endMinute = Number(key.slice(11, 13)) * 60 + Number(key.slice(14, 16))
      const length = Number(period.slice(0, -1))
      const startMinute = endMinute - length
      const start = Date.parse(key.slice(0, 10) + 'T' + String(Math.floor(startMinute / 60)).padStart(2, '0') + ':' + String(startMinute % 60).padStart(2, '0') + ':00+08:00')
      if (start >= cutoff) continue
    }
    grouped.set(key, [...(grouped.get(key) ?? []), { ...raw, day: key }])
  }
  let closed: Candle[] = []
  const observed: Candle[] = []
  let previousKey: string | null = null
  for (const [key, bars] of [...grouped].sort(([a], [b]) => a.localeCompare(b))) {
    const bar = bars[0]
    const complete = Date.parse(barEndAt(period, key)) <= cutoff
    const conflict = bars.some(b => !sameValues(bar, b))
    if (conflict || !bars.every(validCandle)) {
      issues.push((conflict ? 'conflicting_duplicate:' : 'invalid_ohlc:') + key)
      if (complete) { closed = []; previousKey = key }
      continue
    }
    if (!complete) {
      // A later full snapshot cannot recreate an earlier partial candle.
      if (Date.parse(series.source.fetchedAt) <= Date.parse(asOf)) observed.push({ ...bar })
      continue
    }
    if (previousKey && knownMinuteGap(previousKey, key, period)) { issues.push('missing_bar:' + key); closed = [] }
    closed.push({ ...bar })
    previousKey = key
  }
  if (issues.some(i => i.startsWith('invalid_bar_time'))) closed = []
  if (!closed.length) issues.push('closed_history_empty')
  return {
    symbol: series.symbol, period, asOf, adjustment: series.adjustment, source: { ...series.source }, closed, observed,
    lastClosedAt: closed.length ? barEndAt(period, closed.at(-1)!.day) : null, issues: [...new Set(issues)],
  }
}
