import { aggregateCandles } from '@/features/chart/chart-math'
import { isCalendarDate, isIntradayPeriod, type ChartPeriod } from '@/features/chart/chart-periods'
import type { ChartSeries, PriceAdjustment } from '@/features/chart/chart-market-types'
import type { MarketSnapshot, Security } from '@/features/workspace/stock-workspace-types'
import { getMarketSnapshot, searchSecurities } from './backend-client'
import { getEastmoneyChartSeries, getEastmoneySnapshot, searchEastmoneySecurities } from './eastmoney-market'
import { isA50Futures, isMarketIndex, matchingMarketIndices, validMarketSymbol } from './market-symbol'
import { getPublicChartSeries, getPublicMarketSnapshot, PublicMarketError, searchPublicSecurities } from './public-market'

function validateSymbol(symbol: string) {
  if (!validMarketSymbol.test(symbol)) throw new PublicMarketError('MARKET_SYMBOL_INVALID', '证券代码格式不正确', 400)
}

function backendEnabled(symbol?: string) {
  return !!process.env.STOCKCAL_API_BASE_URL && (!symbol || !isMarketIndex(symbol))
}

async function fallback<T>(providers: Array<() => Promise<T>>): Promise<T> {
  for (const provider of providers) {
    try { return await provider() } catch (error) {
      if (error instanceof PublicMarketError && error.status === 400) throw error
    }
  }
  throw new PublicMarketError('MARKET_ALL_SOURCES_UNAVAILABLE', '各行情源暂不可用，请稍后重试', 502)
}

async function tushareSnapshot(symbol: string): Promise<MarketSnapshot> {
  const result = await getMarketSnapshot(symbol)
  if (!result || result.quote?.security?.code !== symbol || !Number.isFinite(result.quote.price) || result.quote.price <= 0
    || !Array.isArray(result.dailyCandles) || !result.dailyCandles.length || result.dailyCandles.some((c, i) => !isCalendarDate(c.day) || (i > 0 && c.day <= result.dailyCandles[i - 1].day)
      || ![c.open, c.high, c.low, c.close, c.volume].every(Number.isFinite) || Math.min(c.open, c.high, c.low, c.close) <= 0
      || c.volume < 0 || c.high < Math.max(c.open, c.close) || c.low > Math.min(c.open, c.close))
    || !result.source || typeof result.source.name !== 'string' || !result.source.name.trim() || typeof result.source.state !== 'string' || typeof result.source.online !== 'boolean' || !Number.isFinite(Date.parse(result.source.fetchedAt))) throw new Error('Invalid backend market data')
  // The legacy Tushare provider exposes raw daily data and no adjustment field.
  if (result.adjustment && result.adjustment !== 'none') throw new Error('Unsupported backend price basis')
  return { ...result, adjustment: 'none' }
}

export async function managedSnapshot(symbol: string): Promise<MarketSnapshot> {
  validateSymbol(symbol)
  if (isA50Futures(symbol)) return getEastmoneySnapshot(symbol)
  return fallback([
    () => getPublicMarketSnapshot(symbol),
    () => getEastmoneySnapshot(symbol),
    ...(backendEnabled(symbol) ? [() => tushareSnapshot(symbol)] : []),
  ])
}

export async function managedSeries(symbol: string, period: ChartPeriod, adjustment: PriceAdjustment): Promise<ChartSeries> {
  validateSymbol(symbol)
  if (isA50Futures(symbol)) return getEastmoneyChartSeries(symbol, period, adjustment)
  if (isIntradayPeriod(period) && adjustment !== 'none') throw new PublicMarketError('MARKET_ADJUSTMENT_UNSUPPORTED', '分时与分钟行情仅支持不复权', 400)
  return fallback([
    () => getPublicChartSeries(symbol, period, adjustment),
    () => getEastmoneyChartSeries(symbol, period, adjustment),
    ...(!isIntradayPeriod(period) && adjustment === 'none' && backendEnabled(symbol) ? [async () => {
      const snapshot = await tushareSnapshot(symbol)
      const bars = aggregateCandles(snapshot.dailyCandles, period)
      return { symbol, period, adjustment, kind: 'candles' as const, bars, source: snapshot.source, limitedHistory: true, note: 'Tushare 原始日线聚合，历史窗口较短，无法提供实时或复权行情。' }
    }] : []),
  ])
}

export async function managedSearch(query: string): Promise<Security[]> {
  const term = query.trim()
  if (!term) return []
  if (term.length > 80) throw new PublicMarketError('MARKET_QUERY_INVALID', '搜索内容过长', 400)
  const indices = matchingMarketIndices(term)
  if (indices.length && (!/^\d+$/.test(term) || term.startsWith('399'))) return indices
  try {
    const result = await fallback([
      () => searchPublicSecurities(term),
      () => searchEastmoneySecurities(term),
      ...(backendEnabled() ? [async () => {
        const securities = await searchSecurities(term)
        if (!Array.isArray(securities) || securities.some(item => !item || typeof item.code !== 'string' || !validMarketSymbol.test(item.code) || typeof item.name !== 'string')) throw new Error('Invalid backend search data')
        return securities
      }] : []),
    ])
    return [...indices, ...result.filter(item => !indices.some(index => index.code === item.code))]
  } catch (error) {
    if (indices.length) return indices
    throw error
  }
}
