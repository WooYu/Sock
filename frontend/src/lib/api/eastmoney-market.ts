import { aggregateCandles } from '@/features/chart/chart-math'
import { canonicalPeriodTime, isCalendarDate, isIntradayPeriod, type ChartPeriod } from '@/features/chart/chart-periods'
import type { ChartSeries, PriceAdjustment } from '@/features/chart/chart-market-types'
import type { Candle, MarketSnapshot, Security } from '@/features/workspace/stock-workspace-types'
import { isMarketIndex } from './market-symbol'
import { PublicMarketError } from './public-market'

const fail = () => new PublicMarketError('EASTMONEY_UNAVAILABLE', '东方财富行情暂不可用', 502)
const source = () => ({ name: '东方财富公开行情·延时', fetchedAt: new Date().toISOString(), state: 'DELAYED', online: true })

function market(symbol: string) {
  if (isMarketIndex(symbol)) return { secid: `1.${symbol.slice(2)}`, code: symbol.slice(2), exchange: 'SH' }
  if (!/^(?:6\d{5}|[03]\d{5}|[48]\d{5}|92\d{4})$/.test(symbol)) throw new PublicMarketError('MARKET_SYMBOL_INVALID', '请输入有效的证券代码', 400)
  const exchange = symbol.startsWith('6') ? 'SH' : /^[03]/.test(symbol) ? 'SZ' : 'BJ'
  return { secid: `${exchange === 'SH' ? 1 : exchange === 'SZ' ? 0 : 0}.${symbol}`, code: symbol, exchange }
}

async function request(host: 'push2' | 'push2his' | 'searchapi', path: string, params: Record<string, string>) {
  const url = new URL(`https://${host}.eastmoney.com${path}`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: controller.signal, headers: { Accept: 'application/json', Referer: 'https://quote.eastmoney.com/' } })
    if (!response.ok || Number(response.headers.get('content-length')) > 2_000_000) throw fail()
    const body = await response.arrayBuffer()
    if (body.byteLength > 2_000_000) throw fail()
    const json: unknown = JSON.parse(new TextDecoder().decode(body))
    if (!json || typeof json !== 'object' || Array.isArray(json)) throw fail()
    return json as Record<string, unknown>
  } catch { throw fail() } finally { clearTimeout(timer) }
}

function obj(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw fail()
  return value as Record<string, unknown>
}
function num(value: unknown, positive = false): number {
  if ((typeof value !== 'string' && typeof value !== 'number') || (typeof value === 'string' && !value.trim()) || !Number.isFinite(Number(value)) || Number(value) < 0 || (positive && Number(value) === 0)) throw fail()
  return Number(value)
}
function time(value: string, minute: boolean): string {
  if (!minute) { if (!isCalendarDate(value)) throw fail(); return value }
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value)) throw fail()
  const result = `${value.replace(' ', 'T')}:00+08:00`
  try { canonicalPeriodTime(result, 'intraday') } catch { throw fail() }
  return result
}

async function data(symbol: string, host: 'push2' | 'push2his', path: string, params: Record<string, string>) {
  const identity = market(symbol)
  const response = await request(host, path, { secid: identity.secid, ...params })
  if (response.rc !== 0) throw fail()
  const value = obj(response.data)
  if (value.code !== identity.code && value.f57 !== identity.code) throw fail()
  const returnedMarket = value.market ?? value.f13
  if (returnedMarket !== undefined && String(returnedMarket) !== identity.secid.split('.')[0]) throw fail()
  return value
}

export async function getEastmoneyChartSeries(symbol: string, period: ChartPeriod, requested: PriceAdjustment): Promise<ChartSeries> {
  market(symbol)
  if (isIntradayPeriod(period) && requested !== 'none') throw new PublicMarketError('MARKET_ADJUSTMENT_UNSUPPORTED', '分时与分钟行情仅支持不复权', 400)
  const adjustment = isMarketIndex(symbol) ? 'none' : requested
  if (period === 'intraday' || period === '5day') {
    const entry = await data(symbol, 'push2his', '/api/qt/stock/trends2/get', { fields1: 'f1,f2,f3,f4,f5,f6,f7,f8', fields2: 'f51,f52,f53,f54,f55,f56,f57,f58', ndays: period === '5day' ? '5' : '1', iscr: '0' })
    if (!Array.isArray(entry.trends) || !entry.trends.length || entry.trends.length > 2000) throw fail()
    const points = new Map<string, Candle>()
    for (const row of entry.trends) {
      if (typeof row !== 'string') throw fail()
      const values = row.split(',')
      if (values.length < 8) throw fail()
      const day = time(values[0], true), price = num(values[2], true)
      const volume = num(values[5]) * 100, turnover = num(values[6])
      points.set(day, { day, endTime: day, open: price, high: price, low: price, close: price, volume, turnover, ...(!isMarketIndex(symbol) && num(values[7]) > 0 ? { averagePrice: num(values[7], true) } : {}) })
    }
    const bars = [...points.values()].sort((a, b) => a.day.localeCompare(b.day))
    return { symbol, period, adjustment, kind: 'intraday', bars, source: source(), limitedHistory: true, ...(period === 'intraday' && entry.preClose ? { previousClose: num(entry.preClose, true) } : {}), note: isMarketIndex(symbol) ? '指数分时点位，不绘制成交均价线。' : '东方财富分时采样，成交量为每分钟成交量。' }
  }
  const native = period === 'quarter' || period === 'year' ? 'month' : period === '120m' ? '60m' : period
  const klt: Record<string, string> = { '1m': '1', '5m': '5', '15m': '15', '30m': '30', '60m': '60', day: '101', week: '102', month: '103' }
  if (!klt[native]) throw fail()
  const entry = await data(symbol, 'push2his', '/api/qt/stock/kline/get', { fields1: 'f1,f2,f3,f4,f5,f6', fields2: 'f51,f52,f53,f54,f55,f56,f57', klt: klt[native], fqt: adjustment === 'qfq' ? '1' : adjustment === 'hfq' ? '2' : '0', end: '20500101', lmt: '640' })
  if (!Array.isArray(entry.klines) || !entry.klines.length || entry.klines.length > 2000) throw fail()
  const rows = new Map<string, Candle>()
  for (const row of entry.klines) {
    if (typeof row !== 'string') throw fail()
    const values = row.split(',')
    if (values.length < 7) throw fail()
    const endTime = time(values[0], isIntradayPeriod(native))
    const open = num(values[1], true), close = num(values[2], true), high = num(values[3], true), low = num(values[4], true)
    if (high < Math.max(open, close) || low > Math.min(open, close)) throw fail()
    rows.set(endTime, { day: canonicalPeriodTime(endTime, native), endTime, open, close, high, low, volume: num(values[5]) * 100, turnover: num(values[6]) })
  }
  const ordered = [...rows.values()].sort((a, b) => a.endTime!.localeCompare(b.endTime!))
  const bars = native !== period || isIntradayPeriod(native) ? aggregateCandles(ordered, period) : ordered
  return { symbol, period, adjustment, kind: 'candles', bars, source: source(), limitedHistory: bars.length < 250, ...(bars.length < 250 ? { note: `数据源返回 ${bars.length} 根行情，较长均线可能不足。` } : {}) }
}

export async function getEastmoneySnapshot(symbol: string): Promise<MarketSnapshot> {
  const identity = market(symbol)
  const adjustment = isMarketIndex(symbol) ? 'none' : 'qfq'
  const [entry, series] = await Promise.all([
    data(symbol, 'push2', '/api/qt/stock/get', { fields: 'f13,f43,f44,f45,f46,f47,f48,f57,f58,f59,f60' }),
    getEastmoneyChartSeries(symbol, 'day', adjustment),
  ])
  if (typeof entry.f58 !== 'string' || !entry.f58.trim()) throw fail()
  const decimals = num(entry.f59 ?? 2)
  if (!Number.isInteger(decimals) || decimals > 6) throw fail()
  const scale = 10 ** decimals
  const price = num(entry.f43, true) / scale, previousClose = num(entry.f60, true) / scale
  const open = num(entry.f46, true) / scale, high = num(entry.f44, true) / scale, low = num(entry.f45, true) / scale
  if (high < Math.max(open, price) || low > Math.min(open, price)) throw fail()
  return { adjustment, quote: { security: { code: isMarketIndex(symbol) ? symbol.toLowerCase() : symbol, name: entry.f58.trim(), exchange: identity.exchange }, price, previousClose, open, high, low, volume: num(entry.f47) * 100, turnover: num(entry.f48) }, dailyCandles: series.bars, source: series.source }
}

export async function searchEastmoneySecurities(query: string): Promise<Security[]> {
  const response = await request('searchapi', '/api/suggest/get', { input: query, type: '14', token: '' })
  const table = obj(response.QuotationCodeTable)
  if (table.Status !== 0 || !Array.isArray(table.Data) || table.Data.length > 100) throw fail()
  const results = new Map<string, Security>()
  for (const item of table.Data) {
    const entry = obj(item)
    if (entry.Classify !== 'AStock' || typeof entry.Code !== 'string' || typeof entry.Name !== 'string' || !entry.Name.trim()) continue
    try {
      const identity = market(entry.Code)
      if (entry.QuoteID !== identity.secid) continue
      results.set(entry.Code, { code: entry.Code, name: entry.Name.trim(), exchange: identity.exchange, ...(typeof entry.PinYin === 'string' ? { initials: entry.PinYin.toLowerCase() } : {}) })
    } catch { continue }
    if (results.size >= 20) break
  }
  return [...results.values()]
}
