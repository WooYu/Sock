import { describe, expect, test } from 'vitest'
import { evaluateRuleConditions, type RuleCondition, type RuleFacts } from './analysis-rule-evaluator'

const facts: RuleFacts = {
  closeAboveMa5: true,
  closeAboveMa20: true,
  closeAboveBollMiddle: true,
  ma5SlopePositive: true,
  bollMiddleSlopePositive: true,
  volumeRatio: 1.4,
  supportDistance: 0.03,
  granvilleDay: null,
  phase: null,
  marketPanic: null,
  relativeStrength: null,
  phase3Opening: null,
  mirrorRetest: null,
}

describe('evaluateRuleConditions', () => {
  test('matches a rule only when every condition is true', () => {
    const result = evaluateRuleConditions([
      { field: 'closeAboveMa5', operator: 'equals', value: 1 },
      { field: 'volumeRatio', operator: 'greaterThanOrEqual', value: 1.2 },
    ], facts)

    expect(result.status).toBe('matched')
    expect(result.conditions.every((condition) => condition.passed)).toBe(true)
  })

  test('reports a failed condition instead of partially matching', () => {
    const result = evaluateRuleConditions([{ field: 'volumeRatio', operator: 'lessThan', value: 1 }], facts)

    expect(result.status).toBe('not-matched')
    expect(result.failedConditions).toContain('volumeRatio < 1')
  })

  test('reports missing facts without inventing a result', () => {
    const condition: RuleCondition = { field: 'marketPanic', operator: 'equals', value: 1 }
    const result = evaluateRuleConditions([condition], facts)

    expect(result.status).toBe('insufficient')
    expect(result.missingFacts).toContain('marketPanic')
  })
})
