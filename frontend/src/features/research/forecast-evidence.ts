import type { DecisionRule, StockAnalysis } from '../workspace/stock-workspace-types'
import type { MergedLevel } from '../scenario/scenario-types'
import type { HistoricalMatch } from './research-context'

const fields: Record<string, string[]> = { ma5: ['closeAboveMa5', 'ma5SlopePositive'],
  ma20: ['closeAboveMa20'], bollMiddle: ['closeAboveBollMiddle', 'bollMiddleSlopePositive'] }

export function levelEvidence(level: MergedLevel, close: number, rules: DecisionRule[], analysis: StockAnalysis | null | undefined, history: HistoricalMatch[]) {
  // Published rule evaluation is daily. Never silently transfer it to intraday references.
  const indicators = new Set(level.references.filter(r => r.period === 'day').map(r => r.indicator))
  const matchingRules = rules.filter(rule => rule.evidence.length && analysis?.ruleEvaluations?.some(e => e.ruleId === rule.ruleId && e.status === 'matched')
    && rule.conditions?.some(c => [...indicators].some(i => fields[i]?.includes(c.field))))
  const change = close > 0 ? (level.value / close - 1) * 100 : null
  // This is an outcome-distance comparison, not a hit probability or a target forecast.
  const comparableHistory = change === null ? [] : history.filter(h => Math.abs(h.followThroughReturn - change) <= 1)
  return { matchingRules, comparableHistory, change }
}
