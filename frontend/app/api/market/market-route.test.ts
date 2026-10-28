// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const providerSnapshot = { code: 0, data: { sz300502: { qfqday: [['2026-09-15', '10', '11', '12', '9', '100'], ['2026-09-16', '11', '12', '13', '10', '150']], qt: { sz300502: ['51', '新易盛', '300502', '12', '11', '11', '150'] } } } }
const callSnapshot = async (symbol = '300502') => (await import('./stocks/[symbol]/snapshot/route')).GET(new Request(`http://localhost/api/market/stocks/${symbol}/snapshot`), { params: Promise.resolve({ symbol }) })
const callSearch = async (query: string) => (await import('./search/route')).GET(new Request(`http://localhost/api/market/search?q=${encodeURIComponent(query)}`))

describe('market BFF source selection', () => {
  beforeEach(() => { vi.resetModules(); vi.stubEnv('STOCKCAL_API_BASE_URL', '') })
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

  test('uses real public candles and the provider security name when no backend is configured', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(providerSnapshot)))
    const response = await callSnapshot()
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ quote: { security: { code: '300502', name: '新易盛', exchange: 'SZ' }, price: 12, previousClose: 11 }, dailyCandles: [{ volume: 10000 }, { volume: 15000 }], source: { name: '腾讯公开行情·延时', online: true, state: 'DELAYED' } })
  })

  test('prefers Tencent even when a backend is configured', async () => {
    vi.stubEnv('STOCKCAL_API_BASE_URL', 'https://backend.example/')
    const fetcher = vi.fn(async () => Response.json(providerSnapshot))
    vi.stubGlobal('fetch', fetcher)
    const response = await callSnapshot('300502')
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ source: { name: '腾讯公开行情·延时' }, quote: { price: 12 } })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  test('reports all providers unavailable without leaking errors', async () => {
    vi.stubEnv('STOCKCAL_API_BASE_URL', 'https://backend.example/')
    const fetcher = vi.fn(async () => new Response('private upstream details', { status: 503 }))
    vi.stubGlobal('fetch', fetcher)
    const response = await callSnapshot()
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ code: 'MARKET_ALL_SOURCES_UNAVAILABLE', message: '各行情源暂不可用，请稍后重试' })
    expect(fetcher).toHaveBeenCalledTimes(4)
  })

  test('does not mix backend quotes into Tencent adjusted history', async () => {
    vi.stubEnv('STOCKCAL_API_BASE_URL', 'https://backend.example/')
    const fetcher = vi.fn(async (url: string) => url.startsWith('https://backend.example/')
      ? Response.json({ quote: { security: { code: '300502', name: '新易盛' }, price: 12 }, dailyCandles: [], source: { name: '后端日线' } })
      : Response.json(providerSnapshot))
    vi.stubGlobal('fetch', fetcher)
    const response = await callSnapshot()
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ adjustment: 'qfq', quote: { price: 12 }, dailyCandles: [{ close: 11 }, { close: 12 }], source: { name: '腾讯公开行情·延时' } })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  test('rejects invalid symbols before requesting data', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    expect((await callSnapshot('<script>')).status).toBe(400)
    expect((await callSnapshot('httpsbad')).status).toBe(400)
    expect(fetcher).not.toHaveBeenCalled()
  })

  test('offers exact-code search from a verified public snapshot', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(providerSnapshot)))
    const response = await callSearch('300502')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([{ code: '300502', name: '新易盛', exchange: 'SZ' }])
  })

  test('preserves the configured backend search path', async () => {
    vi.stubEnv('STOCKCAL_API_BASE_URL', 'https://backend.example/')
    const fetcher = vi.fn(async () => Response.json([{ code: '300502', name: '新易盛' }]))
    vi.stubGlobal('fetch', fetcher)
    const response = await callSearch('新易盛')
    expect(response.status).toBe(200)
    expect(await response.json()).toHaveLength(1)
    expect(fetcher).toHaveBeenCalledWith('https://backend.example/api/v1/market/search?q=%E6%96%B0%E6%98%93%E7%9B%9B', expect.anything())
  })

  test('returns a safe public provider failure without exposing upstream text', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>secret provider details</html>', { status: 503 })))
    const response = await callSnapshot()
    expect(response.status).toBe(502)
    expect(JSON.stringify(await response.json())).not.toContain('secret')
  })
})

test('supports index search and snapshots with a legacy backend configured', async () => {
  vi.stubEnv('STOCKCAL_API_BASE_URL', 'https://backend.example/')
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ code: 0, data: { sh000001: { day: [['2026-09-16', '10', '11', '12', '9', '100']], qt: { sh000001: ['1', '上证指数', '000001', '11', '10', '10', '100'] } } } }))
  vi.stubGlobal('fetch', fetcher)
  try {
    const search = await callSearch('上证指数')
    expect(await search.json()).toMatchObject([{ code: 'sh000001', name: '上证指数' }])
    expect(fetcher).not.toHaveBeenCalled()
    const snapshot = await callSnapshot('sh000001')
    expect(snapshot.status).toBe(200)
    expect(await snapshot.json()).toMatchObject({ adjustment: 'none', quote: { security: { code: 'sh000001', exchange: 'SH' } } })
    expect(String(fetcher.mock.calls[0][0])).toContain('web.ifzq.gtimg.cn')
  } finally { vi.unstubAllGlobals(); vi.unstubAllEnvs() }
})

test('routes CSI 1000 to the public provider with a configured backend', async () => {
  vi.stubEnv('STOCKCAL_API_BASE_URL', 'https://backend.example/')
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ code: 0, data: { sh000852: { day: [['2026-09-16', '10', '11', '12', '9', '100']], qt: { sh000852: ['1', '中证1000', '000852', '11', '10', '10', '100'] } } } }))
  vi.stubGlobal('fetch', fetcher)
  try {
    expect(await (await callSearch('中证1000')).json()).toMatchObject([{ code: 'sh000852' }])
    expect(await (await callSnapshot('sh000852')).json()).toMatchObject({ adjustment: 'none', quote: { security: { code: 'sh000852' } } })
    expect(String(fetcher.mock.calls[0][0])).toContain('web.ifzq.gtimg.cn')
  } finally { vi.unstubAllGlobals(); vi.unstubAllEnvs() }
})
