import { expect, test } from 'vitest'
import { levelEvidence } from './forecast-evidence'
import { forecastFixture } from '../scenario/scenario-test-fixtures'
import type { DecisionRule, StockAnalysis } from '../workspace/stock-workspace-types'

test('requires an actually matched rule, provenance and relevant daily indicator', () => {
  const level = forecastFixture().snapshot.mergedLevels[0]
  const rule = { ruleId: 'ma5', name: 'MA5', action: 'WAIT', version: 1, priority: 1,
    conditions: [{ field: 'closeAboveMa5', operator: 'equals', value: 1 }], evidence: [{ id: 'note:1', label: '原文' }] } as DecisionRule
  const analysis = { ruleEvaluations: [{ ruleId: 'ma5', status: 'matched' }] } as StockAnalysis
  expect(levelEvidence(level, 11, [rule], analysis, []).matchingRules).toEqual([rule])
  expect(levelEvidence(level, 11, [rule], null, []).matchingRules).toEqual([])
  expect(levelEvidence(level, 11, [{ ...rule, evidence: [] }], analysis, []).matchingRules).toEqual([])
  const hourly = { ...level, references: level.references.map(r => ({ ...r, period: '60m' as const })) }
  expect(levelEvidence(hourly, 11, [rule], analysis, []).matchingRules).toEqual([])
})

test('compares historical outcome distance transparently, never a fabricated probability', () => {
  const level = { ...forecastFixture().snapshot.mergedLevels[0], value: 11 }
  const historical = { startDay: '2026-01-01', endDay: '2026-01-10', followThroughDay: '2026-01-15', distance: .2, followThroughReturn: 10.5, closes: [1, 2] }
  expect(levelEvidence(level, 10, [], null, [historical]).comparableHistory).toEqual([historical])
  expect(levelEvidence(level, 10, [], null, [{ ...historical, followThroughReturn: -10 }]).comparableHistory).toEqual([])
  expect(levelEvidence(level, 0, [], null, [historical]).change).toBeNull()
})
