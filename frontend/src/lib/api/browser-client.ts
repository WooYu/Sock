import type { DecisionAction, DecisionRule, MarketSnapshot, RuleCondition, Security } from '@/features/workspace/stock-workspace-types'

export type BrowserMarketClient = {
  search(query: string, signal?: AbortSignal): Promise<Security[]>
  snapshot(symbol: string, signal?: AbortSignal): Promise<MarketSnapshot>
  publishedRules?(signal?: AbortSignal): Promise<DecisionRule[]>
}

async function browserRequest<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`行情请求失败：${response.status}`)
  return response.json() as Promise<T>
}

export const browserMarketClient: BrowserMarketClient = {
  search: (query, signal) => browserRequest(`/api/market/search?q=${encodeURIComponent(query)}`, signal),
  snapshot: (symbol, signal) => browserRequest(`/api/market/stocks/${encodeURIComponent(symbol)}/snapshot`, signal),
  publishedRules: async (signal) => {
    const rules = await browserRequest<Array<Record<string, unknown>>>('/api/knowledge/rules', signal)
    return rules.filter((rule) => rule.enabled !== false).map(toDecisionRule)
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
