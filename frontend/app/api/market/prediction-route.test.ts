import { afterEach, describe, expect, test, vi } from 'vitest'
import { isPredictionSnapshot } from '@/features/chart/chart-types'
import { getPredictionSnapshot } from '@/lib/api/backend-client'
import { GET } from './stocks/[symbol]/prediction/route'

const snapshot = {
  symbol: '600519', period: 'day', generatedAt: '2026-09-04T09:00:00Z', modelVersion: 'baseline-v1',
  days: ['2026-09-08', '2026-09-09', '2026-09-10'].map((day) => ({
    day, open: 29, high: 31, low: 28, close: 30, rangeLow: 28, rangeHigh: 32, confidence: 0.7,
    ma5: 28, ma10: 25.5, ma20: 20.5, bollUpper: 32.03, bollMiddle: 20.5, bollLower: 8.97,
  })),
}

function callRoute(symbol = '600519', query = '?period=day', headers?: HeadersInit) {
  return GET(new Request(`http://localhost/api/market/stocks/${symbol}/prediction${query}`, { headers }), {
    params: Promise.resolve({ symbol }),
  })
}

describe('prediction BFF and backend client contract', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

  test('returns a typed three-day snapshot from the encoded backend URL without caching', async () => {
    vi.stubEnv('STOCKCAL_API_BASE_URL', 'https://backend.example/')
    const fetcher = vi.fn(async () => Response.json(snapshot))
    vi.stubGlobal('fetch', fetcher)
    const response = await callRoute()
    expect(response.status).toBe(200)
    expect(isPredictionSnapshot(await response.json())).toBe(true)
    expect(fetcher).toHaveBeenCalledWith('https://backend.example/api/v1/market/stocks/600519/prediction?period=day', expect.objectContaining({ cache: 'no-store' }))
    expect(await getPredictionSnapshot('A B', 'day')).toEqual(snapshot)
    expect(fetcher).toHaveBeenLastCalledWith('https://backend.example/api/v1/market/stocks/A%20B/prediction?period=day', expect.anything())
  })

  test('defaults to day and forwards bearer authentication', async () => {
    vi.stubEnv('STOCKCAL_API_BASE_URL', 'https://backend.example/')
    const fetcher = vi.fn(async () => Response.json(snapshot))
    vi.stubGlobal('fetch', fetcher)
    expect((await callRoute('600519', '', { Authorization: 'Bearer session-token' })).status).toBe(200)
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('?period=day'), expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer session-token' }),
    }))
  })

  test.each([400, 401, 404, 422, 503])('preserves backend status %s and its structured error', async (status) => {
    vi.stubEnv('STOCKCAL_API_BASE_URL', 'https://backend.example/')
    const body = { code: status === 422 ? 'PREDICTION_DATA_INSUFFICIENT' : 'BACKEND_ERROR', message: '暂不可用' }
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(body, { status })))
    const response = await callRoute()
    expect(response.status).toBe(status)
    expect(await response.json()).toEqual(body)
  })

  test('forwards week and month for backend daily-only validation', async () => {
    vi.stubEnv('STOCKCAL_API_BASE_URL', 'https://backend.example/')
    const fetcher = vi.fn(async () => Response.json({ code: 'PREDICTION_PERIOD_UNSUPPORTED' }, { status: 400 }))
    vi.stubGlobal('fetch', fetcher)
    for (const period of ['week', 'month']) {
      const response = await callRoute('600519', `?period=${period}`)
      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: 'PREDICTION_PERIOD_UNSUPPORTED' })
      expect(fetcher).toHaveBeenLastCalledWith(expect.stringContaining(`?period=${period}`), expect.anything())
    }
  })

  test('rejects invalid symbols and periods before requesting the backend', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    expect((await callRoute('bad-symbol')).status).toBe(400)
    expect((await callRoute('600519', '?period=year')).status).toBe(400)
    expect(fetcher).not.toHaveBeenCalled()
  })

  test('preserves non-JSON backend failure status without exposing its body', async () => {
    vi.stubEnv('STOCKCAL_API_BASE_URL', 'https://backend.example/')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>internal proxy details</html>', { status: 503 })))
    const response = await callRoute()
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ message: '后端请求失败：503' })
  })

  test('returns 502 for network failures', async () => {
    vi.stubEnv('STOCKCAL_API_BASE_URL', 'https://backend.example/')
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network failed') }))
    const response = await callRoute()
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ message: '预测暂时不可用' })
  })
})
