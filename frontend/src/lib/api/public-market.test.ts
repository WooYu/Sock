// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const daily = [['2026-09-15', '10', '11', '12', '9', '100'], ['2026-09-16', '11', '12', '13', '10', '150']]
function payload(key: string, rows: unknown, symbol = 'sz300502') {
  return { code: 0, data: { [symbol]: { [key]: rows, qt: { [symbol]: ['51', '新易盛', symbol.slice(2), '12', '11', '11', '150'] } } } }
}
const load = () => import('./public-market')

describe('Tencent public market adapter', () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks() })

  test('uses unadjusted daily data by default, converts lots to shares, and preserves actual provider identity', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(payload('day', daily)))
    vi.stubGlobal('fetch', fetcher)
    const { getPublicChartSeries, getPublicMarketSnapshot } = await load()
    const series = await getPublicChartSeries('300502')
    expect(series).toMatchObject({ symbol: '300502', period: 'day', adjustment: 'none', kind: 'candles', bars: [{ day: '2026-09-15', close: 11, volume: 10000 }, { day: '2026-09-16', close: 12, volume: 15000 }], limitedHistory: true })
    const snapshot = await getPublicMarketSnapshot('300502')
    expect(snapshot.quote).toMatchObject({ security: { code: '300502', name: '新易盛', exchange: 'SZ' }, price: 12, previousClose: 11, volume: 15000 })
    expect(snapshot.source).toMatchObject({ name: '腾讯公开行情·延时', state: 'DELAYED', online: true })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(new URL(fetcher.mock.calls[0][0] as string).searchParams.get('param')).toBe('sz300502,day,,,640,')
  })

  test.each([['600519', 'sh600519'], ['000001', 'sz000001'], ['430047', 'bj430047'], ['832982', 'bj832982'], ['920001', 'bj920001']])('routes A-share %s to its actual exchange', async (code, symbol) => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(payload('day', daily, symbol)))
    vi.stubGlobal('fetch', fetcher)
    const result = await (await load()).getPublicChartSeries(code)
    expect(result.symbol).toBe(code)
    expect(new URL(fetcher.mock.calls[0][0] as string).searchParams.get('param')).toBe(`${symbol},day,,,640,`)
  })

  test('canonicalizes native week bars while retaining their provider end date', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(payload('qfqweek', [['2026-09-11', '10', '11', '12', '9', '100'], ['2026-09-16', '11', '12', '13', '10', '150']]))))
    const result = await (await load()).getPublicChartSeries('300502', 'week', 'qfq')
    expect(result.bars).toMatchObject([{ day: '2026-09-07', endTime: '2026-09-11' }, { day: '2026-09-14', endTime: '2026-09-16' }])
    expect(result.adjustment).toBe('qfq')
    expect(result.previousClose).toBeUndefined()
  })

  test.each(['quarter', 'year'] as const)('aggregates %s from native monthly history rather than truncating daily history', async (period) => {
    const rows = [['2026-01-30', '10', '11', '12', '9', '10'], ['2026-02-27', '11', '12', '14', '8', '20'], ['2026-03-31', '12', '15', '17', '10', '30'], ['2026-04-30', '15', '16', '18', '14', '40']]
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(payload('hfqmonth', rows)))
    vi.stubGlobal('fetch', fetcher)
    const result = await (await load()).getPublicChartSeries('300502', period, 'hfq')
    expect(new URL(fetcher.mock.calls[0][0] as string).searchParams.get('param')).toBe('sz300502,month,,,640,hfq')
    expect(result.bars).toHaveLength(period === 'quarter' ? 2 : 1)
    expect(result.bars[0]).toMatchObject(period === 'quarter' ? { day: '2026-01-01', open: 10, close: 15, high: 17, low: 8, volume: 6000, endTime: '2026-03-31' } : { day: '2026-01-01', open: 10, close: 16, high: 18, low: 8, volume: 10000, endTime: '2026-04-30' })
  })

  test('parses real minute-bar timestamps and fractional lots without relabeling their adjustment', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(payload('m1', [['202609160931', '10', '11', '12', '9', '50.5', {}, '1.20']]))))
    const result = await (await load()).getPublicChartSeries('300502', '1m')
    expect(result).toMatchObject({ adjustment: 'none', kind: 'candles', bars: [{ day: '2026-09-16T09:31:00+08:00', volume: 5050 }] })
  })

  test('retains auction volume when the 09:30 sample shares the first minute bucket', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(payload('m1', [['202609160930', '10', '10', '10', '10', '2'], ['202609160931', '10', '11', '11', '9', '3']]))))
    const result = await (await load()).getPublicChartSeries('300502', '1m')
    expect(result.bars).toMatchObject([{ day: '2026-09-16T09:31:00+08:00', open: 10, close: 11, high: 11, low: 9, volume: 500 }])
  })

  test('aggregates 120-minute bars separately for morning and afternoon sessions', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(payload('m60', [['202609161030', '10', '11', '12', '9', '100'], ['202609161130', '11', '12', '13', '10', '150'], ['202609161400', '12', '13', '14', '11', '200'], ['202609161500', '13', '14', '15', '12', '250']]))))
    const result = await (await load()).getPublicChartSeries('300502', '120m')
    expect(result.bars).toMatchObject([{ day: '2026-09-16T11:30:00+08:00', open: 10, close: 12, high: 13, low: 9, volume: 25000 }, { day: '2026-09-16T15:00:00+08:00', open: 12, close: 14, high: 15, low: 11, volume: 45000 }])
  })

  test('keeps intraday as price samples, differences cumulative volume and computes cumulative VWAP', async () => {
    const data = { date: '20260916', data: ['0930 10.00 2 2000.00', '0931 11.00 5 5200.00', '1500 12.00 8 9000.00', '1506 12.00 9 10200.00'] }
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(payload('data', data))))
    const result = await (await load()).getPublicChartSeries('300502', 'intraday')
    expect(result.kind).toBe('intraday')
    expect(result.previousClose).toBe(11)
    expect(result.bars).toHaveLength(3)
    expect(result.bars[1]).toMatchObject({ day: '2026-09-16T09:31:00+08:00', open: 11, close: 11, high: 11, low: 11, volume: 300, turnover: 3200, averagePrice: 10.4 })
    expect(result.note).toContain('不含盘后')
  })

  test('orders and de-duplicates updated provider rows before making a time series', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(payload('day', [daily[1], daily[0], ['2026-09-16', '11', '12.5', '13', '10', '170']]))))
    const result = await (await load()).getPublicChartSeries('300502')
    expect(result.bars.map((bar) => [bar.day, bar.close, bar.volume])).toEqual([['2026-09-15', 11, 10000], ['2026-09-16', 12.5, 17000]])
  })

  test.each([
    { rows: [['2026-02-30', '10', '11', '12', '9', '100']] },
    { rows: [['2026-09-16', '10', '11', '10.5', '9', '100']] },
    { rows: [['2026-09-16', '10', 'NaN', '12', '9', '100']] },
    { rows: [['2026-09-16', '10', '11', '12', '9', '-1']] },
  ])('rejects malformed OHLC, volume and dates without manufacturing candles', async ({ rows }) => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(payload('day', rows))))
    await expect((await load()).getPublicChartSeries('300502')).rejects.toMatchObject({ status: 502, code: 'PUBLIC_MARKET_INVALID_DATA' })
  })

  test('distinguishes an empty history from a valid short history', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(payload('day', []))))
    await expect((await load()).getPublicChartSeries('300502')).rejects.toMatchObject({ status: 404, code: 'PUBLIC_MARKET_NO_DATA' })
  })

  test('refuses an adjusted response when the provider returns only raw data', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(payload('day', daily))))
    await expect((await load()).getPublicChartSeries('300502', 'day', 'qfq')).rejects.toMatchObject({ status: 502 })
  })

  test('rejects unsupported symbols and minute adjustments before making an upstream request', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    const api = await load()
    await expect(api.getPublicChartSeries('123456')).rejects.toMatchObject({ status: 400 })
    await expect(api.getPublicChartSeries('300502', '1m', 'qfq')).rejects.toMatchObject({ status: 400, code: 'MARKET_ADJUSTMENT_UNSUPPORTED' })
    expect(fetcher).not.toHaveBeenCalled()
  })

  test('rejects declining cumulative intraday volume', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(payload('data', { date: '20260916', data: ['0930 10 10 10000', '0931 10 5 5000'] }))))
    await expect((await load()).getPublicChartSeries('300502', 'intraday')).rejects.toMatchObject({ status: 502 })
  })

  test('coalesces requests, expires cached data and does not poison retries with failed responses', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('unavailable', { status: 503 })).mockImplementation(async () => Response.json(payload('day', daily)))
    vi.stubGlobal('fetch', fetcher)
    const api = await load()
    await expect(api.getPublicChartSeries('300502')).rejects.toMatchObject({ status: 502 })
    const [a, b] = await Promise.all([api.getPublicChartSeries('300502'), api.getPublicChartSeries('300502')])
    expect(a.bars).toEqual(b.bars)
    expect(fetcher).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(61000)
    await api.getPublicChartSeries('300502')
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  test('aborts a stalled provider request and returns a safe timeout error', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal!.addEventListener('abort', () => reject(new DOMException('private transport details', 'AbortError'))))))
    const result = (await load()).getPublicChartSeries('300502').catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(12000)
    expect(await result).toMatchObject({ status: 504, code: 'PUBLIC_MARKET_TIMEOUT' })
  })

  test('parses smartbox escaped names and excludes funds and mismatched market codes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(String.raw`v_hint="sz~300502~\u65b0\u6613\u76db~xys~GP-A^jj~001258~基金~jj~KJ^sh~000001~错误证券~bad~GP-A^sz~300502~重复~xys~GP-A";`)))
    expect(await (await load()).searchPublicSecurities('xys')).toEqual([{ code: '300502', name: '新易盛', exchange: 'SZ', initials: 'xys' }])
  })

  test('does not evaluate script returned by smartbox', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('globalThis.pwned = true;')))
    await expect((await load()).searchPublicSecurities('xys')).rejects.toMatchObject({ status: 502 })
  })
})
