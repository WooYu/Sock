// @vitest-environment node
import { afterEach, describe, expect, test, vi } from 'vitest'

afterEach(() => vi.unstubAllGlobals())

describe('Eastmoney market adapter', () => {
  test('parses index trends without a fabricated average price', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ rc: 0, data: { code: '000852', preClose: 6427.17, trends: ['2026-10-28 09:30,0,6487.84,6487.84,6487.84,2,20000,6488'] } })))
    const result = await (await import('./eastmoney-market')).getEastmoneyChartSeries('sh000852', 'intraday', 'none')
    expect(result).toMatchObject({ source: { name: '东方财富公开行情·延时' }, previousClose: 6427.17, bars: [{ close: 6487.84, volume: 200 }] })
    expect(result.bars[0].averagePrice).toBeUndefined()
  })

  test('maps minute bars to canonical Shanghai time and preserves requested basis', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ rc: 0, data: { code: '300502', klines: ['2026-10-28 10:30,10,11,12,9,100,110000', '2026-10-28 11:30,11,12,13,10,200,220000'] } }))
    vi.stubGlobal('fetch', fetcher)
    const result = await (await import('./eastmoney-market')).getEastmoneyChartSeries('300502', '120m', 'none')
    expect(result).toMatchObject({ period: '120m', adjustment: 'none', bars: [{ day: '2026-10-28T11:30:00+08:00', open: 10, close: 12, volume: 30000 }] })
    expect(String(fetcher.mock.calls[0][0])).toContain('klt=60')
  })

  test('rejects a same-code result from the wrong exchange', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ rc: 0, data: { market: 0, code: '000852', klines: ['2026-10-28,10,11,12,9,100,110000'] } })))
    await expect((await import('./eastmoney-market')).getEastmoneyChartSeries('sh000852', 'day', 'none')).rejects.toMatchObject({ code: 'EASTMONEY_UNAVAILABLE' })
  })

  test('does not compute a fictitious index average across five sessions', async () => {
    const trends = ['2026-10-27 09:30,0,6400,6400,6400,2,10000,6401', '2026-10-28 09:30,0,6500,6500,6500,3,15000,6501']
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ rc: 0, data: { market: 1, code: '000852', trends } })))
    const result = await (await import('./eastmoney-market')).getEastmoneyChartSeries('sh000852', '5day', 'none')
    expect(result.bars.map(bar => bar.volume)).toEqual([200, 300])
    expect(result.bars.every(bar => bar.averagePrice === undefined)).toBe(true)
  })
})
