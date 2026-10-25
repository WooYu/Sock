import { afterEach, expect, test, vi } from 'vitest'
import { browserMarketClient, clearMarketReads } from './browser-client'
import { cachedChartSeries, cachedMarketRead, resetMarketHistoryMemory, snapshotUrl, storeMarketRead } from './market-history-cache'
import { demoMarketSnapshot } from '@/lib/test/fixtures'

afterEach(() => { localStorage.clear(); resetMarketHistoryMemory(); clearMarketReads(); vi.useRealTimers(); vi.unstubAllGlobals() })
test('daily history survives page reload and a fresh cache avoids fetching', async () => {
  vi.setSystemTime(new Date('2026-10-19T10:00:00+08:00'))
  const market = { ...demoMarketSnapshot('600519'), adjustment: 'qfq' as const }
  storeMarketRead(snapshotUrl('600519'), market)
  resetMarketHistoryMemory()
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
  expect(await browserMarketClient.snapshot('600519')).toEqual(market)
  expect(fetcher).not.toHaveBeenCalled()
  expect(browserMarketClient.cachedSnapshot?.('000001')).toBeNull()
})
test('stale history remains available for display while refresh requests fresh data', async () => {
  vi.setSystemTime(new Date('2026-10-19T10:00:00+08:00'))
  const market = { ...demoMarketSnapshot('600519'), adjustment: 'qfq' as const }
  storeMarketRead(snapshotUrl('600519'), market)
  vi.setSystemTime(new Date('2026-10-19T10:06:00+08:00'))
  const fetcher = vi.fn(async () => Response.json(market)); vi.stubGlobal('fetch', fetcher)
  expect(browserMarketClient.cachedSnapshot?.('600519')).toEqual(market)
  expect(cachedMarketRead(snapshotUrl('600519'), true)).toBeNull()
  await browserMarketClient.snapshot('600519')
  expect(fetcher).toHaveBeenCalledTimes(1)
  clearMarketReads()
  await browserMarketClient.snapshot('600519')
  expect(fetcher).toHaveBeenCalledTimes(2)
})
test('history cache isolates symbol, period and adjustment, and discards old data', () => {
  vi.setSystemTime(new Date('2026-10-19T10:00:00+08:00'))
  storeMarketRead('/api/market/stocks/600519/candles?period=60m&adjustment=none', {
    symbol: '600519', period: '60m', adjustment: 'none', kind: 'candles', bars: [], limitedHistory: false,
    source: { name: 'test', fetchedAt: new Date().toISOString(), state: 'TEST', online: true },
  })
  resetMarketHistoryMemory()
  expect(cachedChartSeries('600519', '60m', 'none')).not.toBeNull()
  expect(cachedChartSeries('600519', 'day', 'qfq')).toBeNull()
  expect(cachedChartSeries('000001', '60m', 'none')).toBeNull()
  expect(cachedChartSeries('600519', '60m', 'qfq')).toBeNull()
  vi.setSystemTime(new Date('2026-10-27T10:00:00+08:00'))
  expect(cachedChartSeries('600519', '60m', 'none')).toBeNull()
})
