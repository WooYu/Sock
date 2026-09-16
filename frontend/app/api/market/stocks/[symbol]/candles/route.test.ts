// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const call = async (query = '', symbol = '300502') => (await import('./route')).GET(new Request(`http://localhost/api/market/stocks/${symbol}/candles${query}`), { params: Promise.resolve({ symbol }) })

describe('public multi-period candle endpoint', () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => vi.unstubAllGlobals())

  test('defaults to unadjusted daily candles and retains limited-history metadata', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ code: 0, data: { sz300502: { day: [['2026-09-16', '10', '11', '12', '9', '50']] } } })))
    const response = await call()
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ symbol: '300502', period: 'day', adjustment: 'none', limitedHistory: true, bars: [{ volume: 5000 }], source: { state: 'DELAYED' } })
  })

  test('honors an explicitly selected calendar period and adjustment', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ code: 0, data: { sz300502: { qfqweek: [['2026-09-16', '10', '11', '12', '9', '50']] } } })))
    const response = await call('?period=week&adjustment=qfq')
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ period: 'week', adjustment: 'qfq', bars: [{ day: '2026-09-14', endTime: '2026-09-16' }] })
  })

  test.each(['?period=bad', '?period=1m&adjustment=qfq', '?period=day&adjustment=split', '?period=intraday&adjustment=hfq'])('rejects invalid requests %s without an upstream fetch', async (query) => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    expect((await call(query)).status).toBe(400)
    expect(fetcher).not.toHaveBeenCalled()
  })

  test('reports missing data independently of a provider error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ code: 0, data: {} })))
    const missing = await call()
    expect(missing.status).toBe(404)
    expect(await missing.json()).toMatchObject({ code: 'PUBLIC_MARKET_NO_DATA' })
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('internal network address') }))
    const failed = await call()
    expect(failed.status).toBe(502)
    expect(JSON.stringify(await failed.json())).not.toContain('internal')
  })
})
