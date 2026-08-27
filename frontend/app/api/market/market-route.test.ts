import { describe, expect, test, vi } from 'vitest'
import { GET } from './stocks/[symbol]/snapshot/route'

vi.mock('@/lib/api/backend-client', () => ({
  getMarketSnapshot: vi.fn(async (symbol: string) => ({
    quote: { security: { code: symbol, name: '测试股票' }, price: 10 },
    dailyCandles: [],
    source: { name: 'test', state: 'OFFLINE_CACHE', online: false },
  })),
}))

describe('market BFF', () => {
  test('snapshot route validates symbol and returns backend JSON', async () => {
    const response = await GET(
      new Request('http://localhost/api/market/stocks/600519/snapshot'),
      { params: Promise.resolve({ symbol: '600519' }) },
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ quote: { security: { code: '600519' } } })
  })

  test('snapshot route rejects invalid symbols', async () => {
    const response = await GET(
      new Request('http://localhost/api/market/stocks/%3Cscript%3E/snapshot'),
      { params: Promise.resolve({ symbol: '<script>' }) },
    )
    expect(response.status).toBe(400)
  })
})
