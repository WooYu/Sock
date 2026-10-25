import type { DecisionAction, DecisionRule, MarketSnapshot, RuleCondition, Security } from '@/features/workspace/stock-workspace-types'
import { isPredictionSnapshot, type PredictionSnapshot } from '@/features/chart/chart-types'
import type { ChartPeriod } from '@/features/chart/chart-periods'
import type { ChartSeries, PriceAdjustment } from '@/features/chart/chart-market-types'
import { cachedMarketRead, invalidateMarketHistory, snapshotUrl, storeMarketRead } from './market-history-cache'

export type BrowserMarketClient = {
  search(query: string, signal?: AbortSignal): Promise<Security[]>
  snapshot(symbol: string, signal?: AbortSignal): Promise<MarketSnapshot>
  cachedSnapshot?(symbol: string): MarketSnapshot | null
  series(symbol: string, period: ChartPeriod, signal?: AbortSignal, adjustment?: PriceAdjustment): Promise<ChartSeries>
  prediction(symbol: string, signal?: AbortSignal): Promise<PredictionSnapshot>
  publishedRules?(signal?: AbortSignal): Promise<DecisionRule[]>
}

async function browserRequest<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`行情请求失败：${response.status}`)
  return response.json() as Promise<T>
}

// Share short-lived reads across the chart and analysis without sharing cancellation.
const marketReads = new Map<string, { expires: number; value: Promise<unknown> }>()
export function clearMarketReads() { marketReads.clear(); invalidateMarketHistory() }
function marketRead<T>(url: string, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))
  let entry = marketReads.get(url)
  if (!entry || entry.expires <= Date.now()) {
    const cached = cachedMarketRead<T>(url, true)
    const value = (cached ? Promise.resolve(cached) : browserRequest<T>(url).then(result => { storeMarketRead(url, result as MarketSnapshot | ChartSeries); return result }))
      .catch(error => { if (marketReads.get(url)?.value === value) marketReads.delete(url); throw error })
    entry = { expires: Date.now() + 15_000, value }
    if (marketReads.size >= 64) marketReads.delete(marketReads.keys().next().value!)
    marketReads.set(url, entry)
  }
  const shared = entry.value as Promise<T>
  if (!signal) return shared
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('Aborted', 'AbortError'))
    signal.addEventListener('abort', abort, { once: true })
    shared.then(value => { if (!signal.aborted) resolve(value) }, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}

export const browserMarketClient: BrowserMarketClient = {
  search: (query, signal) => browserRequest(`/api/market/search?q=${encodeURIComponent(query)}`, signal),
  snapshot: (symbol, signal) => marketRead(`/api/market/stocks/${encodeURIComponent(symbol)}/snapshot`, signal),
  cachedSnapshot: symbol => cachedMarketRead<MarketSnapshot>(snapshotUrl(symbol)),
  series: (symbol, period, signal, adjustment = ['intraday', '5day', '1m', '5m', '15m', '30m', '60m', '120m'].includes(period) ? 'none' : 'qfq') => period === 'day' && adjustment === 'qfq'
    ? browserMarketClient.snapshot(symbol, signal).then(market => ({ symbol, period, adjustment: market.adjustment ?? 'none', kind: 'candles', bars: market.dailyCandles, source: market.source, limitedHistory: market.dailyCandles.length < 250 }))
    : marketRead(`/api/market/stocks/${encodeURIComponent(symbol)}/candles?period=${encodeURIComponent(period)}&adjustment=${adjustment}`, signal),
  prediction: async (symbol, signal) => {
    const prediction = await browserRequest<unknown>(`/api/market/stocks/${encodeURIComponent(symbol)}/prediction?period=day`, signal)
    if (!isPredictionSnapshot(prediction) || prediction.symbol !== symbol || prediction.period !== 'day') {
      throw new Error('Invalid prediction response')
    }
    return prediction
  },
  publishedRules: async (signal) => {
    const rules = await browserRequest<Array<Record<string, unknown>>>('/api/knowledge/rules', signal)
    return rules
      .filter((rule) => rule.enabled !== false)
      .map(toDecisionRule)
      .filter((rule) => (rule.conditions?.length ?? 0) > 0)
  },
}

function toDecisionRule(rule: Record<string, unknown>): DecisionRule {
  const rawConditions = Array.isArray(rule.conditions) ? rule.conditions : []
  const conditions = rawConditions.flatMap((item) => isRuleCondition(item) ? [item] : [])
  return {
    ruleId: String(rule.id),
    version: 1,
    name: String(rule.name ?? '未命名规则'),
    action: isDecisionAction(rule.action) ? rule.action : 'WAIT',
    mode: typeof rule.mode === 'string' ? rule.mode : undefined,
    priority: typeof rule.priority === 'number' ? rule.priority : 50,
    evidence: Array.isArray(rule.evidenceIds) ? rule.evidenceIds.map((id) => ({ id: String(id), label: '知识库规则依据' })) : [],
    conditions,
    invalidationConditions: Array.isArray(rule.invalidationConditions) ? rule.invalidationConditions.map(String) : [],
    score: typeof rule.strength === 'number' ? rule.strength : undefined,
  }
}

function isRuleCondition(value: unknown): value is RuleCondition {
  if (!value || typeof value !== 'object') return false
  const condition = value as Record<string, unknown>
  return typeof condition.field === 'string'
    && (supportedConditionFields as readonly string[]).includes(condition.field)
    && typeof condition.operator === 'string'
    && (supportedConditionOperators as readonly string[]).includes(condition.operator)
    && typeof condition.value === 'number'
}

const supportedConditionFields = [
  'closeAboveMa5', 'closeAboveMa20', 'closeAboveBollMiddle', 'ma5SlopePositive',
  'bollMiddleSlopePositive', 'volumeRatio', 'supportDistance', 'granvilleDay',
  'phase', 'marketPanic', 'relativeStrength', 'phase3Opening', 'mirrorRetest',
] as const

const supportedConditionOperators = ['equals', 'greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual'] as const

function isDecisionAction(value: unknown): value is DecisionAction {
  return value === 'ENTER' || value === 'HOLD' || value === 'REDUCE' || value === 'EXIT' || value === 'AVOID' || value === 'WAIT'
}
