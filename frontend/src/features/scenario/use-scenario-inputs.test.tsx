import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { useScenarioInputs } from './use-scenario-inputs'
import { seriesFixture } from './scenario-test-fixtures'
import type { AnalysisPeriod } from './scenario-types'
import type { ChartSeries } from '../chart/chart-market-types'
import type { ChartPeriod } from '../chart/chart-periods'

const clock = () => '2026-12-31T23:00:00Z'
const defaultArgs = { calendar: null, sourceMode: 'real' as const, clock }
describe('scenario input lifecycle', () => {
  test('shared_asof_is_latched_after_data_capture_so_current_observations_are_available', async () => {
    let time = '2026-10-12T14:15:00+08:00'
    const clock = () => time
    const client = { series: async (symbol: string, period: ChartPeriod) => {
      time = '2026-10-12T14:15:02+08:00'
      return seriesFixture({ symbol, period: period as AnalysisPeriod, fetchedAt: '2026-10-12T14:15:01+08:00',
        ...(period === 'day' ? { dates: ['2026-10-09', '2026-10-12'], closes: [10, 11] } : {}) })
    } }
    const { result } = renderHook(() => useScenarioInputs({ ...defaultArgs, symbol: '603533', client, clock }))
    await waitFor(() => expect(result.current.input).not.toBeNull())
    expect(result.current.input!.asOf).toBe('2026-10-12T14:15:02+08:00')
    expect(result.current.input!.periods.day!.observed).toHaveLength(1)
    expect(result.current.loadedAt).toBe('2026-10-12T14:15:02+08:00')
  })
  test('daily_first_then_hour_then_30m_only_on_explicit_requests_with_shared_asof', async () => {
    const client = { series: vi.fn(async (symbol: string, period: ChartPeriod) => seriesFixture({ symbol, period: period as AnalysisPeriod })) }
    const { result } = renderHook(() => useScenarioInputs({ ...defaultArgs, symbol: '603533', client }))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(client.series.mock.calls.map(call => call[1])).toEqual(['day'])
    expect(result.current.input!.periods['60m']).toBeUndefined()
    expect(result.current.input!.periods['30m']).toBeUndefined()
    await act(() => result.current.loadPeriod('60m'))
    expect(result.current.input!.periods['60m']).toBeDefined()
    expect(result.current.input!.periods['30m']).toBeUndefined()
    await act(() => result.current.loadPeriod('30m'))
    expect(result.current.input!.periods['30m']!.asOf).toBe(result.current.input!.asOf)
    expect(result.current.input!.periods['30m']!.closed).toHaveLength(2)
  })
  test('failed_30m_preserves_parent_inputs', async () => {
    const client = { series: async (symbol: string, period: ChartPeriod) => {
      if (period === '30m') throw new Error('30分钟暂缺')
      return seriesFixture({ symbol, period: period as AnalysisPeriod })
    } }
    const { result } = renderHook(() => useScenarioInputs({ ...defaultArgs, symbol: '603533', client }))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    const priorDay = result.current.input!.periods.day
    await act(() => result.current.loadPeriod('60m'))
    await act(() => result.current.loadPeriod('30m'))
    expect(result.current.status).toBe('partial')
    expect(result.current.input!.periods.day).toEqual(priorDay)
    expect(result.current.input!.loadIssues['30m']).toContain('30分钟暂缺')
  })
  test('cannot_skip_the_hour_period_and_pending_deeper_responses_cannot_restore_excluded_data', async () => {
    let release!: (value: ChartSeries) => void
    const client = { series: vi.fn((symbol: string, period: ChartPeriod) => period === '30m'
      ? new Promise<ChartSeries>(resolve => { release = resolve })
      : Promise.resolve(seriesFixture({ symbol, period: period as AnalysisPeriod }))) }
    const { result } = renderHook(() => useScenarioInputs({ ...defaultArgs, symbol: '603533', client }))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    await expect(result.current.loadPeriod('30m')).rejects.toThrow(/逐级/)
    expect(client.series.mock.calls.some(call => call[1] === '30m')).toBe(false)
    await act(() => result.current.loadPeriod('60m'))
    let pending!: Promise<void>
    act(() => { pending = result.current.loadPeriod('30m') })
    act(() => result.current.retainThrough('60m'))
    await act(async () => { release(seriesFixture({ period: '30m' })); await pending })
    expect(result.current.input!.periods['30m']).toBeUndefined()
    expect(result.current.status).toBe('ready')
  })
  test('old_symbol_resolution_is_ignored', async () => {
    const pending: Array<() => void> = []
    const client = { series: (symbol: string, period: ChartPeriod) => symbol === '603533'
      ? new Promise<ChartSeries>(resolve => { pending.push(() => resolve(seriesFixture({ symbol, period: period as AnalysisPeriod }))) })
      : Promise.resolve(seriesFixture({ symbol, period: period as AnalysisPeriod })) }
    const { result, rerender } = renderHook(({ symbol }) => useScenarioInputs({ ...defaultArgs, symbol, client }), { initialProps: { symbol: '603533' } })
    rerender({ symbol: '000001' })
    await waitFor(() => expect(result.current.input?.symbol).toBe('000001'))
    await act(async () => { pending.forEach(resolve => resolve()); await Promise.resolve() })
    expect(result.current.input!.symbol).toBe('000001')
    expect(Object.values(result.current.input!.periods).every(p => p.symbol === '000001')).toBe(true)
  })
  test('aborts_on_unmount', async () => {
    const signals: AbortSignal[] = []
    const client = { series: async (symbol: string, period: ChartPeriod, signal?: AbortSignal) => {
      if (signal) signals.push(signal)
      return seriesFixture({ symbol, period: period as AnalysisPeriod })
    } }
    const { result, unmount } = renderHook(() => useScenarioInputs({ ...defaultArgs, symbol: '603533', client }))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    unmount()
    expect(signals.length).toBeGreaterThan(0)
    expect(signals.every(signal => signal.aborted)).toBe(true)
  })
  test('refresh_keeps_open_30m_in_the_new_generation', async () => {
    const client = { series: async (symbol: string, period: ChartPeriod) => seriesFixture({ symbol, period: period as AnalysisPeriod }) }
    const { result } = renderHook(() => useScenarioInputs({ ...defaultArgs, symbol: '603533', client }))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    await act(() => result.current.loadPeriod('60m'))
    await act(() => result.current.loadPeriod('30m'))
    await act(() => result.current.refresh())
    expect(result.current.input!.periods['30m']).toBeDefined()
    expect(Object.values(result.current.input!.periods).every(p => p.asOf === result.current.input!.asOf)).toBe(true)
  })
  test('demo_mode_is_explicit_and_never_becomes_real', async () => {
    const client = { series: async (symbol: string, period: ChartPeriod) => seriesFixture({ symbol, period: period as AnalysisPeriod }) }
    const { result } = renderHook(() => useScenarioInputs({ ...defaultArgs, sourceMode: 'demo', symbol: 'DEMO', client }))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.input!.sourceMode).toBe('demo')
  })
  test('trimming_after_parent_confirmation_stops_future_refreshes_from_loading_deeper_periods', async () => {
    const client = { series: vi.fn(async (symbol: string, period: ChartPeriod) => seriesFixture({ symbol, period: period as AnalysisPeriod })) }
    const { result } = renderHook(() => useScenarioInputs({ ...defaultArgs, symbol: '603533', client }))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    await act(() => result.current.loadPeriod('60m'))
    await act(() => result.current.loadPeriod('30m'))
    act(() => result.current.retainThrough('60m'))
    expect(result.current.input!.periods['30m']).toBeUndefined()
    client.series.mockClear()
    await act(() => result.current.refresh())
    expect(client.series.mock.calls.map(call => call[1])).toEqual(['day', '60m'])
  })
})
