import { canonicalPeriodTime, isChartPeriod, isIntradayPeriod, type ChartPeriod } from '@/features/chart/chart-periods'
import { aggregateCandles } from '@/features/chart/chart-math'
import type { ChartSeries, PriceAdjustment } from '@/features/chart/chart-market-types'
import type { Candle, MarketSnapshot, Security } from '@/features/workspace/stock-workspace-types'

export class PublicMarketError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message)
    this.name = 'PublicMarketError'
  }
}

const unavailable = () => new PublicMarketError('PUBLIC_MARKET_UNAVAILABLE', '公开行情服务暂时不可用，请稍后重试', 502)
const invalidData = () => new PublicMarketError('PUBLIC_MARKET_INVALID_DATA', '公开行情数据未通过校验，请稍后重试', 502)
const noData = () => new PublicMarketError('PUBLIC_MARKET_NO_DATA', '该股票暂未返回可用行情', 404)
const SOURCE_NAME = '腾讯公开行情·延时'
const CACHE_LIMIT = 128
const cache = new Map<string, { expiresAt: number; promise: Promise<unknown> }>()
const allowedEndpoints = new Set([
  'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get',
  'https://ifzq.gtimg.cn/appstock/app/kline/mkline',
  'https://web.ifzq.gtimg.cn/appstock/app/minute/query',
  'https://smartbox.gtimg.cn/s3/',
])

function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const existing = cache.get(key)
  if (existing && existing.expiresAt > now) return existing.promise as Promise<T>
  if (existing) cache.delete(key)
  for (const [oldKey, entry] of cache) if (entry.expiresAt <= now) cache.delete(oldKey)
  while (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!)
  const promise = load().catch((error: unknown) => {
    if (cache.get(key)?.promise === promise) cache.delete(key)
    throw error
  })
  cache.set(key, { expiresAt: now + ttl, promise })
  return promise
}

/** Only the fixed public endpoints above are reachable; the browser never supplies an upstream URL. */
async function requestText(url: URL, encoding = 'utf-8'): Promise<string> {
  if (!allowedEndpoints.has(`${url.origin}${url.pathname}`)) throw unavailable()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(url.toString(), { cache: 'no-store', redirect: 'error', signal: controller.signal, headers: { Accept: 'application/json, text/plain' } })
    if (!response.ok) throw unavailable()
    if (Number(response.headers.get('content-length')) > 2_000_000) throw invalidData()
    const bytes = await response.arrayBuffer()
    if (bytes.byteLength > 2_000_000) throw invalidData()
    return new TextDecoder(encoding).decode(bytes)
  } catch (error) {
    if (controller.signal.aborted) throw new PublicMarketError('PUBLIC_MARKET_TIMEOUT', '公开行情请求超时，请重试', 504)
    if (error instanceof PublicMarketError) throw error
    throw unavailable()
  } finally {
    clearTimeout(timer)
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalidData()
  return value as Record<string, unknown>
}

function number(value: unknown, minimum = 0): number {
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !value.trim())) throw invalidData()
  const result = Number(value)
  if (!Number.isFinite(result) || result < minimum) throw invalidData()
  return result
}

function positive(value: unknown): number {
  const result = number(value)
  if (result <= 0) throw invalidData()
  return result
}

function optionalPositive(value: unknown): number | undefined {
  return value === undefined || value === null || value === '' || value === '0' || value === 0 ? undefined : positive(value)
}

function marketCode(symbol: string): string {
  if (!/^(?:6\d{5}|[03]\d{5}|[48]\d{5}|92\d{4})$/.test(symbol)) throw new PublicMarketError('MARKET_SYMBOL_INVALID', '请输入有效的六位 A 股代码', 400)
  return `${symbol.startsWith('6') ? 'sh' : /^[03]/.test(symbol) ? 'sz' : 'bj'}${symbol}`
}

function calendarDate(value: unknown): string {
  if (typeof value !== 'string') throw invalidData()
  const compact = /^\d{8}$/.test(value) ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : value
  if (!/^\d{4}-\d{2}-\d{2}$/.test(compact)) throw invalidData()
  const date = new Date(`${compact}T00:00:00Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== compact) throw invalidData()
  return compact
}

function minuteTime(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{12}$/.test(value)) throw invalidData()
  const day = calendarDate(value.slice(0, 8))
  const hour = Number(value.slice(8, 10)), minute = Number(value.slice(10, 12))
  if (hour > 23 || minute > 59) throw invalidData()
  return `${day}T${value.slice(8, 10)}:${value.slice(10, 12)}:00+08:00`
}

function canonical(time: string, period: ChartPeriod): string {
  try { return canonicalPeriodTime(time, period) } catch { throw invalidData() }
}

async function providerEntry(url: URL, code: string): Promise<Record<string, unknown>> {
  const text = await requestText(url)
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { throw invalidData() }
  const response = object(parsed)
  if (response.code !== 0) throw unavailable()
  const data = object(response.data)
  if (!data[code]) throw noData()
  return object(data[code])
}

function source(fetchedAt: string): MarketSnapshot['source'] {
  return { name: SOURCE_NAME, fetchedAt, state: 'DELAYED', online: true }
}

function quoteFields(entry: Record<string, unknown>, code: string): unknown[] | undefined {
  if (!entry.qt || typeof entry.qt !== 'object') return undefined
  const quote = (entry.qt as Record<string, unknown>)[code]
  return Array.isArray(quote) ? quote : undefined
}

type NativeSeries = { bars: Candle[]; entry: Record<string, unknown>; fetchedAt: string }

function nativeSeries(symbol: string, period: ChartPeriod, adjustment: PriceAdjustment): Promise<NativeSeries> {
  const code = marketCode(symbol)
  const minute = /^\d+m$/.test(period)
  const field = minute ? `m${period.slice(0, -1)}` : `${adjustment === 'none' ? '' : adjustment}${period}`
  const url = new URL(minute ? 'https://ifzq.gtimg.cn/appstock/app/kline/mkline' : 'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get')
  url.searchParams.set('param', minute ? `${code},${field},,640` : `${code},${period},,,640,${adjustment === 'none' ? '' : adjustment}`)
  return cached(`native:${code}:${period}:${adjustment}`, minute ? 15_000 : 30_000, async () => {
    const entry = await providerEntry(url, code)
    const rows = entry[field]
    if (!Array.isArray(rows)) throw invalidData()
    if (!rows.length) throw noData()
    if (rows.length > 2000) throw invalidData()
    const byEnd = new Map<string, Candle>()
    for (const row of rows) {
      if (!Array.isArray(row) || row.length < 6) throw invalidData()
      const endTime = minute ? minuteTime(row[0]) : calendarDate(row[0])
      const open = positive(row[1]), close = positive(row[2]), high = positive(row[3]), low = positive(row[4]), volume = number(row[5]) * 100
      if (!Number.isFinite(volume) || high < Math.max(open, close) || low > Math.min(open, close)) throw invalidData()
      byEnd.set(endTime, { day: canonical(endTime, period), endTime, open, close, high, low, volume })
    }
    // A provider can repeat an in-progress native bucket under an updated end date.
    // Keep its latest complete snapshot instead of summing cumulative native volume twice.
    const ordered = [...byEnd.values()].sort((a, b) => a.endTime!.localeCompare(b.endTime!))
    const byTime = new Map<string, Candle>()
    for (const bar of ordered) byTime.set(bar.day, bar)
    // Minute rows contain interval volume. Include the opening-auction row when
    // it folds into the first completed bar instead of dropping those shares.
    const bars = minute ? aggregateCandles(ordered, period) : [...byTime.values()].sort((a, b) => a.day.localeCompare(b.day))
    return { bars, entry, fetchedAt: new Date().toISOString() }
  })
}

function intradaySeries(symbol: string): Promise<ChartSeries> {
  const code = marketCode(symbol)
  return cached(`intraday:${code}`, 15_000, async () => {
    const url = new URL('https://web.ifzq.gtimg.cn/appstock/app/minute/query')
    url.searchParams.set('code', code)
    const entry = await providerEntry(url, code)
    const data = object(entry.data)
    const day = calendarDate(data.date)
    if (!Array.isArray(data.data)) throw invalidData()
    if (!data.data.length) throw noData()
    if (data.data.length > 1500) throw invalidData()
    const samples = new Map<string, { price: number; volume: number; amount: number }>()
    for (const sample of data.data) {
      if (typeof sample !== 'string') throw invalidData()
      const values = sample.trim().split(/\s+/)
      if (values.length < 4 || !/^\d{4}$/.test(values[0])) throw invalidData()
      const time = minuteTime(`${day.replaceAll('-', '')}${values[0]}`)
      const clock = Number(values[0])
      if (!((clock >= 930 && clock <= 1130) || (clock >= 1300 && clock <= 1500))) continue
      samples.set(canonical(time, 'intraday'), { price: positive(values[1]), volume: number(values[2]) * 100, amount: number(values[3]) })
    }
    const bars: Candle[] = []
    let previousVolume = 0, previousAmount = 0
    for (const [time, sample] of [...samples].sort(([a], [b]) => a.localeCompare(b))) {
      if (!Number.isFinite(sample.volume) || sample.volume < previousVolume || sample.amount < previousAmount || (sample.volume === 0 && sample.amount > 0)) throw invalidData()
      bars.push({ day: time, endTime: time, open: sample.price, high: sample.price, low: sample.price, close: sample.price, volume: sample.volume - previousVolume, turnover: sample.amount - previousAmount, ...(sample.volume > 0 ? { averagePrice: sample.amount / sample.volume } : {}) })
      previousVolume = sample.volume
      previousAmount = sample.amount
    }
    if (!bars.length) throw noData()
    return { symbol, period: 'intraday', adjustment: 'none', kind: 'intraday', bars, previousClose: optionalPositive(quoteFields(entry, code)?.[4]), source: source(new Date().toISOString()), limitedHistory: true, note: '当日正常交易时段的价格采样，不含盘后定价；均价为累计成交额/累计成交量，柱形为每分钟成交量。' }
  })
}

export async function getPublicChartSeries(symbol: string, period: ChartPeriod = 'day', adjustment: PriceAdjustment = 'none'): Promise<ChartSeries> {
  marketCode(symbol)
  if (!isChartPeriod(period)) throw new PublicMarketError('MARKET_PERIOD_INVALID', '不支持的行情周期', 400)
  if (!['none', 'qfq', 'hfq'].includes(adjustment)) throw new PublicMarketError('MARKET_ADJUSTMENT_INVALID', '不支持的复权方式', 400)
  if (isIntradayPeriod(period) && adjustment !== 'none') throw new PublicMarketError('MARKET_ADJUSTMENT_UNSUPPORTED', '分时与分钟行情仅支持不复权', 400)
  if (period === 'intraday') {
    const result = await intradaySeries(symbol)
    return { ...result, bars: result.bars.map((bar) => ({ ...bar })) }
  }
  const nativePeriod = period === 'quarter' || period === 'year' ? 'month' : period === '120m' ? '60m' : period
  const loaded = await nativeSeries(symbol, nativePeriod, adjustment)
  const bars = period === nativePeriod ? loaded.bars.map((bar) => ({ ...bar })) : aggregateCandles(loaded.bars, period)
  const limitedHistory = bars.length < 250
  return { symbol, period, adjustment, kind: 'candles', bars, source: source(loaded.fetchedAt), limitedHistory, ...(adjustment === 'none' ? { previousClose: optionalPositive(quoteFields(loaded.entry, marketCode(symbol))?.[4]) } : {}), ...(limitedHistory ? { note: `数据源仅返回 ${bars.length} 根该周期行情，较长均线可能暂无足够样本。` } : {}) }
}

export async function getPublicMarketSnapshot(symbol: string): Promise<MarketSnapshot> {
  const code = marketCode(symbol)
  const loaded = await nativeSeries(symbol, 'day', 'none')
  const fields = quoteFields(loaded.entry, code)
  if (!fields || fields[2] !== symbol || typeof fields[1] !== 'string' || !fields[1].trim()) throw invalidData()
  const price = positive(fields[3])
  const open = optionalPositive(fields[5]), high = optionalPositive(fields[33]), low = optionalPositive(fields[34])
  if ((high !== undefined && high < Math.max(price, open ?? price)) || (low !== undefined && low > Math.min(price, open ?? price))) throw invalidData()
  const amount = typeof fields[35] === 'string' ? fields[35].split('/')[2] : undefined
  const turnover = amount ? number(amount) : optionalPositive(fields[37]) !== undefined ? number(fields[37]) * 10000 : undefined
  return { quote: { security: { code: symbol, name: fields[1].trim(), exchange: code.slice(0, 2).toUpperCase() }, price, previousClose: optionalPositive(fields[4]), open, high, low, volume: fields[6] === undefined ? undefined : number(fields[6]) * 100, turnover }, dailyCandles: loaded.bars.map((bar) => ({ ...bar })), source: source(loaded.fetchedAt) }
}

export async function searchPublicSecurities(query: string): Promise<Security[]> {
  const term = query.trim()
  if (!term) return []
  if (term.length > 80) throw new PublicMarketError('MARKET_QUERY_INVALID', '搜索内容过长，请输入股票代码、名称或拼音', 400)
  if (/^\d{6}$/.test(term)) {
    try { return [(await getPublicMarketSnapshot(term)).quote.security] } catch (error) {
      if (error instanceof PublicMarketError && (error.status === 400 || error.status === 404)) return []
      throw error
    }
  }
  return cached(`search:${term}`, 60_000, async () => {
    const url = new URL('https://smartbox.gtimg.cn/s3/')
    url.searchParams.set('q', term)
    url.searchParams.set('t', 'all')
    const text = await requestText(url, 'gbk')
    const match = /^\s*v_(?:hint|suggest)\s*=\s*("(?:\\.|[^"\\])*")\s*;?\s*$/.exec(text)
    if (!match) throw invalidData()
    let value: unknown
    try { value = JSON.parse(match[1]) } catch { throw invalidData() }
    if (typeof value !== 'string') throw invalidData()
    if (value === 'N' || value === '') return []
    const results = new Map<string, Security>()
    for (const item of value.split('^')) {
      const [exchange, symbol, name, initials, kind] = item.split('~')
      if (kind !== 'GP-A' || !name?.trim() || !['sh', 'sz', 'bj'].includes(exchange)) continue
      try { if (marketCode(symbol) !== `${exchange}${symbol}`) continue } catch { continue }
      if (!results.has(symbol)) results.set(symbol, { code: symbol, name: name.trim(), exchange: exchange.toUpperCase(), ...(initials ? { initials } : {}) })
      if (results.size === 20) break
    }
    return [...results.values()]
  })
}
