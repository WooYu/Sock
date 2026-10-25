import type { MarketSnapshot } from '@/features/workspace/stock-workspace-types'
import type { ChartSeries, PriceAdjustment } from '@/features/chart/chart-market-types'
import type { ChartPeriod } from '@/features/chart/chart-periods'

const KEY = 'stockcal.market-history.v1'
const MAX_AGE = 7 * 24 * 3600_000
type Entry = { url: string; savedAt: number; value: MarketSnapshot | ChartSeries }
let invalidatedAt = 0
let memory: Entry[] | null = null
export function resetMarketHistoryMemory() { memory = null }
function entries(): Entry[] {
  if (memory) return memory.filter(e => e.savedAt <= Date.now() && Date.now() - e.savedAt < MAX_AGE)
  try {
    const data: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    memory = Array.isArray(data) ? data.filter((e): e is Entry => e && typeof e.url === 'string' && /^\/api\/market\/stocks\/[A-Za-z0-9]+\/(snapshot|candles\?)/.test(e.url)
      && Number.isFinite(e.savedAt) && e.savedAt <= Date.now() && Date.now() - e.savedAt < MAX_AGE && e.value && typeof e.value === 'object'
      && e.value.source && typeof e.value.source.name === 'string' && Number.isFinite(Date.parse(e.value.source.fetchedAt))
      && (e.url.endsWith('/snapshot') ? Array.isArray(e.value.dailyCandles) && e.value.quote?.security?.code === e.url.split('/')[4] && e.value.adjustment === 'qfq'
        : Array.isArray(e.value.bars) && e.value.symbol === e.url.split('/')[4])) : []
    return memory
  } catch { return [] }
}
export function cachedMarketRead<T>(url: string, freshOnly = false): T | null {
  const entry = entries().find(e => e.url === url)
  const ttl = url.includes('period=') && /period=(intraday|5day|\d+m)/.test(url) ? 60_000 : 5 * 60_000
  return entry && (!freshOnly || entry.savedAt > invalidatedAt && Date.now() - entry.savedAt < ttl) ? entry.value as T : null
}
export function storeMarketRead(url: string, value: MarketSnapshot | ChartSeries) {
  try {
    const next = [{ url, savedAt: Date.now(), value }, ...entries().filter(e => e.url !== url)].slice(0, 64)
    // Leave room for drawings and notes in the same origin's storage quota.
    while (next.length > 1 && JSON.stringify(next).length > 1_500_000) next.pop()
    memory = next
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch { /* Storage being full or disabled must never block market loading. */ }
}
export function invalidateMarketHistory() { invalidatedAt = Date.now() }
export const snapshotUrl = (symbol: string) => `/api/market/stocks/${encodeURIComponent(symbol)}/snapshot`
export function cachedChartSeries(symbol: string, period: ChartPeriod, adjustment: PriceAdjustment): ChartSeries | null {
  if (period === 'day' && adjustment === 'qfq') {
    const market = cachedMarketRead<MarketSnapshot>(snapshotUrl(symbol))
    return market ? { symbol, period, adjustment, kind: 'candles', bars: market.dailyCandles, source: market.source, limitedHistory: market.dailyCandles.length < 250 } : null
  }
  const result = cachedMarketRead<ChartSeries>(`/api/market/stocks/${encodeURIComponent(symbol)}/candles?period=${encodeURIComponent(period)}&adjustment=${adjustment}`)
  return result?.period === period && result.adjustment === adjustment ? result : null
}
