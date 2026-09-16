import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { useChartSeries } from './use-chart-series'
import type { ChartSeries } from './chart-market-types'
import type { ChartPeriod } from './chart-periods'
import type { MarketSnapshot } from '../workspace/stock-workspace-types'

const market: MarketSnapshot = { quote: { security: { code: '300502', name: '新易盛' }, price: 30 }, dailyCandles: [{ day: '2026-09-16', open: 29, high: 31, low: 28, close: 30, volume: 1000 }], source: { name: 'test', fetchedAt: '2026-09-16T08:00:00Z', state: 'DELAYED', online: true } }
const response = (period: ChartPeriod): ChartSeries => ({ symbol: '300502', period, adjustment: 'none', kind: 'candles', bars: [{ ...market.dailyCandles[0], day: '2026-09-16T10:30:00+08:00' }], source: market.source, limitedHistory: true })

test('switching periods never relabels the previous dataset and ignores a late response', async () => {
  const pending: Record<string, (value: ChartSeries) => void> = {}
  const loader = vi.fn((_symbol: string, period: ChartPeriod) => new Promise<ChartSeries>((resolve) => { pending[period] = resolve }))
  const { result, rerender } = renderHook(({ period }: { period: ChartPeriod }) => useChartSeries(market, period, loader), { initialProps: { period: '30m' as ChartPeriod } })
  expect(result.current.data).toBeNull()
  rerender({ period: '60m' })
  await act(async () => { pending['60m'](response('60m')) })
  expect(result.current.data?.period).toBe('60m')
  await act(async () => { pending['30m'](response('30m')) })
  expect(result.current.data?.period).toBe('60m')
})

test('reports unavailable minute data without manufacturing it from daily candles', async () => {
  const loader = vi.fn(async () => { throw new Error('分钟行情不可用') })
  const { result } = renderHook(() => useChartSeries(market, '1m', loader))
  await waitFor(() => expect(result.current.error).toBe('分钟行情不可用'))
  expect(result.current.data).toBeNull()
})

test('an optional history fetch failure preserves available daily candles', async () => {
  const loader = vi.fn(async () => { throw new Error('长历史暂不可用') })
  const { result } = renderHook(() => useChartSeries(market, 'day', loader))
  await waitFor(() => expect(result.current.error).toBe('长历史暂不可用'))
  expect(result.current.data?.bars).toEqual(market.dailyCandles)
})

test('refreshing the market snapshot also refreshes an active minute series', async () => {
  const loader = vi.fn(async () => response('30m'))
  const { result, rerender } = renderHook(({ snapshot }) => useChartSeries(snapshot, '30m', loader), { initialProps: { snapshot: market } })
  await waitFor(() => expect(result.current.data?.period).toBe('30m'))
  rerender({ snapshot: { ...market, source: { ...market.source, fetchedAt: '2026-09-16T08:01:00Z' } } })
  await waitFor(() => expect(loader).toHaveBeenCalledTimes(2))
})
