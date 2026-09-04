import { emptyRuleFacts, evaluateRuleConditions, type RuleFacts } from './analysis-rule-evaluator'
import type { Candle, DecisionEvidence, DecisionRule, MarketSnapshot, OperationCycle, StockAnalysis, StrategyMode } from '../workspace/stock-workspace-types'

const MIN_HISTORY = 20

export function analyzeMarketSnapshot(market: MarketSnapshot, cycle: OperationCycle = 'swing', rules: DecisionRule[] = []): StockAnalysis {
  const candles = [...(market.dailyCandles ?? [])].sort((a, b) => a.day.localeCompare(b.day))
  if (candles.length < MIN_HISTORY) return emptyAnalysis('历史数据不足，等待至少20根日K线', ['至少20根日K线'])

  const last = candles[candles.length - 1]
  const ma5 = sma(candles, 5)
  const ma20 = sma(candles, 20)
  const previousMa5 = sma(candles.slice(0, -1), 5)
  const currentBoll = bollinger(candles, 20)
  const previousBoll = bollinger(candles.slice(0, -1), 20)
  const support = Math.min(...candles.slice(-20).map((candle) => candle.low))
  const resistance = Math.max(...candles.slice(-20).map((candle) => candle.high))
  const facts = buildFacts(candles, last, ma5, ma20, previousMa5, currentBoll, previousBoll, support)
  const evidence: DecisionEvidence[] = [
    { id: 'indicator:ma5', label: 'MA5 斜率向上', detail: `当前 ${ma5.toFixed(2)}，上一值 ${previousMa5.toFixed(2)}` },
    { id: 'indicator:boll-middle', label: '收盘站上 BOLL 中轨', detail: `收盘 ${last.close.toFixed(2)}，中轨 ${currentBoll.middle.toFixed(2)}` },
  ]
  const candidateRules = rules
  const ruleEvaluations = candidateRules.map((rule) => {
    const result = evaluateRuleConditions(rule.conditions, facts)
    return {
      ruleId: rule.ruleId,
      status: result.status,
      conditions: result.conditions.map((item) => ({ field: item.condition.field, actual: item.actual, passed: item.passed })),
      missingFacts: result.missingFacts,
      failedConditions: result.failedConditions,
    }
  })
  const matchedRules = candidateRules.filter((rule, index) => ruleEvaluations[index].status === 'matched')
  const missingFacts = unique(ruleEvaluations.flatMap((evaluation) => evaluation.status === 'insufficient' ? evaluation.missingFacts : []))
  const state = market.source.state.toLowerCase()
  if (!market.source.online || state === 'stale' || state === 'offline') return emptyAnalysis('行情数据已过期或离线，等待刷新后再判断', ['行情新鲜度'])

  const conflict = findConflict(matchedRules)
  const topRule = [...matchedRules].sort((left, right) => right.priority - left.priority)[0]
  const action = conflict?.blocking ? 'WAIT' : topRule?.action ?? 'WAIT'
  const conflicts = conflict?.names ?? []
  const reason = conflict?.blocking
    ? `规则冲突：${conflicts.join('、')}，等待更多条件确认`
    : topRule
      ? `命中规则：${topRule.name}`
      : missingFacts.length
        ? `条件不足：缺少${missingFacts.join('、')}`
        : '当前没有已确认的适用规则，等待方向确认'
  const direction = action === 'ENTER' || action === 'HOLD' ? 'bullish' : action === 'EXIT' || action === 'REDUCE' || action === 'AVOID' ? 'bearish' : facts.ma5SlopePositive === true && facts.closeAboveMa20 === true ? 'neutral' : 'bearish'
  const matchedEvidence = matchedRules.flatMap((rule) => rule.evidence)
  const invalidationConditions = unique(matchedRules.flatMap((rule) => rule.invalidationConditions ?? []))
  const decision: StockAnalysis['decision'] = {
    action,
    mode: topRule ? strategyMode(topRule.mode) : undefined,
    reason,
    matchedRules,
    ruleEvaluations,
    missingFacts,
    conflicts,
    invalidationConditions,
    evidence: uniqueEvidence([...evidence, ...matchedEvidence]),
  }
  const range = resistance - support
  return {
    support,
    resistance,
    target: action === 'ENTER' ? resistance + range : null,
    direction,
    confidence: null,
    directionStrength: action === 'WAIT' ? 0 : topRule?.score ?? 0,
    matchedRules,
    ruleEvaluations,
    future: buildFuture(candles, cycle, ma5, ma20, currentBoll),
    decision,
  }
}

function buildFacts(candles: Candle[], last: Candle, ma5: number, ma20: number, previousMa5: number, currentBoll: ReturnType<typeof bollinger>, previousBoll: ReturnType<typeof bollinger>, support: number): RuleFacts {
  const recentVolumes = candles.slice(-21, -1).map((candle) => candle.volume).filter((volume) => volume > 0)
  const averageVolume = recentVolumes.length ? recentVolumes.reduce((sum, value) => sum + value, 0) / recentVolumes.length : null
  const facts = emptyRuleFacts()
  facts.closeAboveMa20 = last.close >= ma20
  facts.closeAboveMa5 = last.close >= ma5
  facts.closeAboveBollMiddle = last.close >= currentBoll.middle
  facts.ma5SlopePositive = ma5 >= previousMa5
  facts.bollMiddleSlopePositive = currentBoll.middle >= previousBoll.middle
  facts.volumeRatio = averageVolume && last.volume > 0 ? last.volume / averageVolume : null
  facts.supportDistance = last.close === 0 ? null : Math.abs(last.close - support) / last.close
  return facts
}

function findConflict(rules: DecisionRule[]) {
  const bullish = rules.filter((rule) => rule.action === 'ENTER' || rule.action === 'HOLD')
  const bearish = rules.filter((rule) => rule.action === 'REDUCE' || rule.action === 'EXIT' || rule.action === 'AVOID')
  if (!bullish.length || !bearish.length) return null
  const highestBullish = Math.max(...bullish.map((rule) => rule.priority))
  const highestBearish = Math.max(...bearish.map((rule) => rule.priority))
  const names = [...bullish, ...bearish].sort((left, right) => right.priority - left.priority).map((rule) => rule.name)
  return { names, blocking: Math.abs(highestBullish - highestBearish) <= 10 }
}

function strategyMode(mode?: string): StrategyMode | undefined {
  const mapping: Record<string, StrategyMode> = {
    BASE_GRANVILLE: 'baseGranville', PHASE3_OPENING: 'phase3Opening', SEA_TURTLE: 'seaTurtle', REBOUND: 'rebound', MIRROR_RETEST: 'mirrorRetest', SIDEWAYS_PHASE3: 'sidewaysPhase3', MONTHLY_WAIT: 'monthlyWait', DEMON_STOCK: 'demonStock', EXCLUSION: 'exclusion',
  }
  return mode ? mapping[mode] : undefined
}

function emptyAnalysis(reason: string, missingFacts: string[]): StockAnalysis {
  return { support: null, resistance: null, target: null, direction: 'neutral', confidence: null, directionStrength: 0, matchedRules: [], ruleEvaluations: [], future: [], decision: { action: 'WAIT', reason, matchedRules: [], ruleEvaluations: [], missingFacts, conflicts: [], invalidationConditions: [], evidence: [] } }
}

function sma(candles: Candle[], period: number) {
  const values = candles.slice(-period).map((candle) => candle.close)
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function bollinger(candles: Candle[], period: number) {
  const values = candles.slice(-period).map((candle) => candle.close)
  const middle = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - middle) ** 2, 0) / values.length
  const deviation = Math.sqrt(variance)
  return { middle, upper: middle + deviation * 2, lower: middle - deviation * 2 }
}

function buildFuture(candles: Candle[], cycle: OperationCycle, ma5: number, ma20: number, boll: { upper: number; middle: number; lower: number }) {
  const sessions = cycle === 'short' ? 1 : cycle === 'long' ? 5 : 3
  const result: StockAnalysis['future'] = []
  let day = new Date(candles[candles.length - 1].day)
  for (let index = 0; index < sessions; index += 1) {
    day = nextWeekday(day)
    result.push({ day: day.toISOString(), maValues: { '5': ma5, '20': ma20 }, bollUpper: boll.upper, bollMiddle: boll.middle, bollLower: boll.lower })
  }
  return result
}

function nextWeekday(day: Date) {
  const next = new Date(day)
  do { next.setUTCDate(next.getUTCDate() + 1) } while (next.getUTCDay() === 0 || next.getUTCDay() === 6)
  return next
}

function unique(values: string[]) { return [...new Set(values)] }
function uniqueEvidence(values: DecisionEvidence[]) { return [...new Map(values.map((item) => [item.id, item])).values()] }
