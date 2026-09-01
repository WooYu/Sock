import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { KeyLevelsPanel } from './key-levels-panel'
import { PatternsPanel } from './patterns-panel'

const analysis = {
  support: 1700,
  resistance: 1760,
  target: 1810,
  direction: 'bullish' as const,
  confidence: 0.82,
  directionStrength: 0.7,
  matchedRules: [],
  future: [],
  decision: {
    action: 'ENTER' as const,
    reason: '测试规则已命中',
    matchedRules: [],
    missingFacts: [],
    conflicts: [],
    invalidationConditions: [],
    evidence: [],
  },
}

describe('analysis panels', () => {
  test('key level evidence supports multiple expanded cards', async () => {
    render(<KeyLevelsPanel analysis={analysis} />)
    await userEvent.click(screen.getByRole('button', { name: '展开上涨关键区' }))
    await userEvent.click(screen.getByRole('button', { name: '展开下跌支撑区' }))
    expect(screen.getAllByText('计算依据')).toHaveLength(2)
    expect(screen.getAllByText(/触发条件/)).toHaveLength(2)
  })

  test('shows condition evaluation details for matched rules', () => {
    render(<PatternsPanel analysis={{ ...analysis, matchedRules: [{ ruleId: 'rule-1', version: 1, name: '站上 MA5', action: 'ENTER', priority: 10, evidence: [], conditions: [{ field: 'closeAboveMa5', operator: 'equals', value: 1 }] }], ruleEvaluations: [{ ruleId: 'rule-1', status: 'matched', conditions: [{ field: 'closeAboveMa5', actual: true, passed: true }], missingFacts: [], failedConditions: [] }] }} />)

    expect(screen.getByText('规则条件核验')).toBeInTheDocument()
    expect(screen.getByText('closeAboveMa5')).toBeInTheDocument()
    expect(screen.getByText('已满足')).toBeInTheDocument()
  })
})
