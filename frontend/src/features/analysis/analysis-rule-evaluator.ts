import type { RuleCondition, RuleConditionField, RuleConditionOperator } from '../workspace/stock-workspace-types'
export type { RuleCondition } from '../workspace/stock-workspace-types'

export type RuleFacts = Record<RuleConditionField, number | boolean | string | null>

export type EvaluatedCondition = {
  condition: RuleCondition
  actual: number | boolean | string | null
  passed: boolean | null
}

export type RuleConditionResult = {
  status: 'matched' | 'not-matched' | 'insufficient'
  conditions: EvaluatedCondition[]
  missingFacts: string[]
  failedConditions: string[]
}

export function evaluateRuleConditions(conditions: RuleCondition[] | undefined, facts: RuleFacts): RuleConditionResult {
  if (!conditions?.length) {
    return { status: 'insufficient', conditions: [], missingFacts: ['规则条件'], failedConditions: [] }
  }

  const evaluated = conditions.map((condition) => {
    const actual = facts[condition.field]
    return { condition, actual, passed: actual == null ? null : compare(actual, condition.operator, condition.value) }
  })
  const missingFacts = evaluated.filter((item) => item.passed === null).map((item) => item.condition.field)
  const failedConditions = evaluated.filter((item) => item.passed === false).map((item) => describeCondition(item.condition))
  return {
    status: failedConditions.length ? 'not-matched' : missingFacts.length ? 'insufficient' : 'matched',
    conditions: evaluated,
    missingFacts,
    failedConditions,
  }
}

export function describeCondition(condition: RuleCondition) {
  const operator: Record<RuleConditionOperator, string> = {
    equals: '=',
    greaterThan: '>',
    greaterThanOrEqual: '≥',
    lessThan: '<',
    lessThanOrEqual: '≤',
  }
  return `${condition.field} ${operator[condition.operator]} ${condition.value}`
}

function compare(actual: number | boolean | string, operator: RuleConditionOperator, expected: number) {
  const left = typeof actual === 'boolean' ? (actual ? 1 : 0) : actual
  if (typeof left !== 'number') return false
  switch (operator) {
    case 'equals': return left === expected
    case 'greaterThan': return left > expected
    case 'greaterThanOrEqual': return left >= expected
    case 'lessThan': return left < expected
    case 'lessThanOrEqual': return left <= expected
  }
}

export function emptyRuleFacts(): RuleFacts {
  return {
    closeAboveMa5: null,
    closeAboveMa20: null,
    closeAboveBollMiddle: null,
    ma5SlopePositive: null,
    bollMiddleSlopePositive: null,
    volumeRatio: null,
    supportDistance: null,
    granvilleDay: null,
    phase: null,
    marketPanic: null,
    relativeStrength: null,
    phase3Opening: null,
    mirrorRetest: null,
  }
}
