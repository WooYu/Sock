/** Synthetic data for tests only; these dates and prices are not exchange evidence. */
import type { ChartSeries } from '../chart/chart-market-types'
import type { AnalysisInput, AnalysisPeriod, TradingCalendar } from './scenario-types'
import { normalizeScenarioSeries } from './scenario-inputs'
import { sessionEnds } from './scenario-calendar'
import { buildScenarioAnalysis } from './scenario-engine'
import { consolidateReferencePrices } from './scenario-levels'

export const testCalendar: TradingCalendar = {
  fromDay: '2026-10-09', throughDay: '2026-10-15',
  tradingDays: ['2026-10-09', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15'],
  sourceUrl: 'https://test.invalid/synthetic-calendar', verifiedAt: '2026-09-01T00:00:00Z',
}
export function seriesFixture(options: {
  period?: AnalysisPeriod; symbol?: string; dates?: string[]; closes?: number[]; fetchedAt?: string
} = {}): ChartSeries {
  const { period = 'day', symbol = '603533', closes = [10, 11], fetchedAt = '2026-12-31T23:00:00Z' } = options
  const dates = options.dates ?? closes.map((_, i) => {
    const slots = sessionEnds(period)
    const day = new Date(Date.UTC(2026, 8, 1 + (period === 'day' ? i : Math.floor(i / slots.length)))).toISOString().slice(0, 10)
    return period === 'day' ? day : day + 'T' + slots[i % slots.length] + ':00+08:00'
  })
  return {
    symbol, period, adjustment: 'none', kind: 'candles', limitedHistory: false,
    bars: closes.map((close, i) => ({ day: dates[i], endTime: dates[i], open: close, close, high: close + 0.2, low: close - 0.2, volume: 1000 })),
    source: { name: '合成测试行情', fetchedAt, state: 'TEST', online: true },
  }
}
export function analysisInputFixture(series: ChartSeries = seriesFixture(), asOf = series.source.fetchedAt): AnalysisInput {
  const period = series.period as AnalysisPeriod
  return { symbol: series.symbol, asOf, sourceMode: 'real', calendar: null, periods: { [period]: normalizeScenarioSeries(series, asOf) }, loadIssues: {} }
}
export function forecastFixture() {
  const dates = Array.from({ length: 22 }, (_, i) => new Date(Date.UTC(2026, 8, 18 + i)).toISOString().slice(0, 10))
  const input = analysisInputFixture(seriesFixture({ dates, closes: [...Array<number>(21).fill(10), 11], fetchedAt: '2026-10-09T16:00:00+08:00' }))
  input.calendar = testCalendar
  const window = { period: 'day' as const, startAt: '2026-10-12T09:30:00+08:00', endAt: '2026-10-12T15:00:00+08:00' }
  const snapshot = buildScenarioAnalysis(input, {}, { id: 'forecast-fixture', version: 1, kind: 'live', registry: [], scenarios: [],
    createdAt: input.asOf, horizons: [1, 2, 3], executionWindow: window })
  snapshot.references = snapshot.references.filter(r => r.method === 'rolling_close' && r.indicator === 'ma5')
  Object.assign(snapshot, consolidateReferencePrices(snapshot.references, snapshot.scenarios, { method: 'rolling_close', scenarioIds: {} }))
  return { snapshot, window }
}
