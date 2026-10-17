import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { useAutomaticForecast } from './use-automatic-forecast'
import { analysisInputFixture, seriesFixture } from '../scenario/scenario-test-fixtures'
import type { AnalysisPeriod, AnalysisAnnotations } from '../scenario/scenario-types'
import type { ChartPeriod } from '../chart/chart-periods'
import { buildScenarioAnalysis } from '../scenario/scenario-engine'
import { saveScenarioSnapshot } from '../scenario/scenario-ledger'
import { barEndAt } from '../scenario/scenario-calendar'

beforeEach(() => localStorage.clear())
const series = (symbol: string, period: ChartPeriod) => seriesFixture({ symbol, period: period as AnalysisPeriod,
  closes: Array.from({ length: 30 }, (_, i) => 10 + i * .1), fetchedAt: '2026-10-15T16:00:00+08:00' })

test('automatically descends day then hour then 30m and calculates all four horizons without saving confirmations', async () => {
  const client = { series: vi.fn(async (symbol: string, period: ChartPeriod) => series(symbol, period)) }
  const { result } = renderHook(() => useAutomaticForecast({ symbol: '603533', sourceMode: 'real', client }))
  await waitFor(() => expect(result.current.periods).toEqual(['day', '60m', '30m']), { timeout: 15000 })
  expect(client.series.mock.calls.findIndex(c => c[1] === '60m')).toBeLessThan(client.series.mock.calls.findIndex(c => c[1] === '30m'))
  expect(new Set(result.current.analysis!.references.map(r => r.target.horizon))).toEqual(new Set([1, 2, 3, 4]))
  expect(result.current.clearPeriod).toBeNull()
  expect(result.current.analysis!.annotations).toEqual({})
  expect(localStorage.length).toBe(0)
})

test('failed smaller period keeps valid daily and hour forecasts without retrying indefinitely', async () => {
  const client = { series: vi.fn(async (symbol: string, period: ChartPeriod) => {
    if (period === '30m') throw new Error('30分钟行情缺失')
    return series(symbol, period)
  }) }
  const { result } = renderHook(() => useAutomaticForecast({ symbol: '603533', sourceMode: 'real', client }))
  await waitFor(() => expect(result.current.analysis?.input.loadIssues['30m']).toContain('30分钟行情缺失'), { timeout: 15000 })
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.periods).toEqual(['day', '60m'])
  expect(result.current.analysis!.mergedLevels.length).toBeGreaterThan(0)
  expect(client.series.mock.calls.filter(c => c[1] === '30m')).toHaveLength(1)
})

test('a saved valid daily trend and mode stop automatic drilling at daily', async () => {
  const input = analysisInputFixture(series('603533', 'day'))
  const origin = input.periods.day!.closed.at(-1)!
  const confirmation = { period: 'day' as const, barKey: origin.day, eventAt: barEndAt('day', origin.day),
    confirmedAt: input.asOf, reason: '已核对趋势和模式' }
  const annotations: AnalysisAnnotations = { trends: { day: { ...confirmation, direction: 'rising', style: 'climbing' } },
    mode: { ...confirmation, id: 'trend_climb' }, bottom: { period: 'day', kind: 'indicator', indicator: 'ma5', selectedAt: input.asOf, reason: 'MA5位置' } }
  saveScenarioSnapshot(localStorage, buildScenarioAnalysis(input, annotations, { id: 'confirmed', version: 1, createdAt: input.asOf,
    kind: 'live', registry: [], scenarios: [], horizons: [1, 2, 3, 4], executionWindow: null }))
  const client = { series: vi.fn(async (symbol: string, period: ChartPeriod) => series(symbol, period)) }
  const { result } = renderHook(() => useAutomaticForecast({ symbol: '603533', sourceMode: 'real', client }))
  await waitFor(() => expect(result.current.clearPeriod).toBe('day'), { timeout: 15000 })
  expect(client.series.mock.calls.map(c => c[1])).toEqual(['day'])
})
