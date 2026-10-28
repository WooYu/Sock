// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const tencent = { code: 0, data: { sz300502: { qfqday: [['2026-10-28', '10', '11', '12', '9', '100']], qt: { sz300502: ['51', '新易盛', '300502', '11', '10', '10', '100'] } } } }
const eastDaily = { rc: 0, data: { code: '300502', klines: ['2026-10-28,10,11,12,9,100,110000'] } }
const eastQuote = { rc: 0, data: { f57: '300502', f58: '新易盛', f59: 2, f43: 1100, f60: 1000, f46: 1000, f44: 1200, f45: 900, f47: 100, f48: 110000 } }
const backend = { quote: { security: { code: '300502', name: '新易盛', exchange: 'SZ' }, price: 11, previousClose: 10 }, dailyCandles: [{ day: '2026-10-28', open: 10, close: 11, high: 12, low: 9, volume: 10000 }], source: { name: 'Tushare Pro 日线', fetchedAt: '2026-10-29T00:00:00Z', state: 'DELAYED', online: true } }
const bad = () => new Response('unavailable', { status: 503 })

describe('managed market sources', () => {
  beforeEach(() => { vi.resetModules(); vi.stubEnv('STOCKCAL_API_BASE_URL', 'https://backend.example') })
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

  test('prefers Tencent without querying other sources', async () => {
    const fetcher = vi.fn(async () => Response.json(tencent)); vi.stubGlobal('fetch', fetcher)
    expect(await (await import('./market-manager')).managedSnapshot('300502')).toMatchObject({ source: { name: '腾讯公开行情·延时' }, adjustment: 'qfq' })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  test('falls back to validated Eastmoney snapshot and preserves its adjustment and source', async () => {
    const urls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
      const url = String(input); urls.push(url)
      if (url.includes('gtimg.cn')) return bad()
      if (url.includes('/kline/get')) return Response.json(eastDaily)
      if (url.includes('/stock/get')) return Response.json(eastQuote)
      return bad()
    }))
    const snapshot = await (await import('./market-manager')).managedSnapshot('300502')
    expect(snapshot).toMatchObject({ adjustment: 'qfq', quote: { price: 11, security: { code: '300502' } }, dailyCandles: [{ volume: 10000 }], source: { name: '东方财富公开行情·延时' } })
    expect(urls.some(url => url.includes('fqt=1'))).toBe(true)
    expect(urls.some(url => url.includes('backend.example'))).toBe(false)
  })

  test('uses Tushare raw daily snapshot only after both public sources fail', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => String(input).startsWith('https://backend.example') ? Response.json(backend) : bad()))
    const api = await import('./market-manager')
    expect(await api.managedSnapshot('300502')).toMatchObject({ adjustment: 'none', source: { name: 'Tushare Pro 日线' } })
    expect(await api.managedSeries('300502', 'week', 'none')).toMatchObject({ adjustment: 'none', limitedHistory: true, source: { name: 'Tushare Pro 日线' } })
    await expect(api.managedSeries('300502', 'day', 'qfq')).rejects.toMatchObject({ code: 'MARKET_ALL_SOURCES_UNAVAILABLE' })
    await expect(api.managedSeries('300502', '60m', 'none')).rejects.toMatchObject({ code: 'MARKET_ALL_SOURCES_UNAVAILABLE' })
  })

  test('rejects malformed Eastmoney and mismatched backend instruments', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
      const url = String(input)
      if (url.includes('/kline/get')) return Response.json({ ...eastDaily, data: { ...eastDaily.data, code: '600519' } })
      if (url.includes('/stock/get')) return Response.json(eastQuote)
      if (url.startsWith('https://backend.example')) return Response.json({ ...backend, quote: { ...backend.quote, security: { code: '600519' } } })
      return bad()
    }))
    await expect((await import('./market-manager')).managedSnapshot('300502')).rejects.toMatchObject({ code: 'MARKET_ALL_SOURCES_UNAVAILABLE' })
  })

  test('falls back to Eastmoney search before backend and preserves explicit index identity', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => String(input).includes('searchapi.eastmoney.com')
      ? Response.json({ QuotationCodeTable: { Status: 0, Data: [{ Classify: 'AStock', Code: '300502', Name: '新易盛', QuoteID: '0.300502', PinYin: 'XYS' }] } }) : bad()))
    const api = await import('./market-manager')
    expect(await api.managedSearch('新易盛')).toEqual([{ code: '300502', name: '新易盛', exchange: 'SZ', initials: 'xys' }])
    expect(await api.managedSearch('中证1000')).toMatchObject([{ code: 'sh000852' }])
  })

  test.each([
    ['创业板指', 'sz399006', '创业板指'],
    ['399006', 'sz399006', '创业板指'],
    ['中证100', 'sz399903', '中证100'],
    ['399903', 'sz399903', '中证100'],
    ['A50', 'sz399310', '国证A50'],
    ['399310', 'sz399310', '国证A50'],
  ])('finds %s as the explicitly named index', async (query, symbol, name) => {
    vi.stubGlobal('fetch', vi.fn(async () => bad()))
    const results = await (await import('./market-manager')).managedSearch(query)
    expect(results).toMatchObject([{ code: symbol, name }])
    if (query === '中证100') expect(results.some(item => item.code === 'sh000852')).toBe(false)
  })

  test.each(['sz399006', 'sz399903', 'sz399310'])('fetches %s as a raw index, never a stock', async symbol => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ code: 0, data: { [symbol]: { day: [['2026-10-28', '10', '11', '12', '9', '100']], qt: { [symbol]: ['1', '测试指数', symbol.slice(2), '11', '10', '10', '100'] } } } }))
    vi.stubGlobal('fetch', fetcher)
    const api = await import('./market-manager')
    expect(await api.managedSnapshot(symbol)).toMatchObject({ adjustment: 'none', quote: { security: { code: symbol, exchange: 'SZ' } } })
    expect(new URL(fetcher.mock.calls[0][0] as string).searchParams.get('param')).toBe(`${symbol},day,,,640,`)
  })
})
