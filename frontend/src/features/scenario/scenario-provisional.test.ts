import { expect, test } from 'vitest'
import { computeProvisionalAnalysis } from './scenario-provisional'
import { analysisInputFixture, seriesFixture } from './scenario-test-fixtures'
import { buildScenarioAnalysis } from './scenario-engine'

function partialInput() {
  const dates = Array.from({ length: 20 }, (_, i) => new Date(Date.UTC(2026, 8, 23 + i)).toISOString().slice(0, 10))
  return analysisInputFixture(seriesFixture({ dates, closes: [...Array<number>(19).fill(10), 11], fetchedAt: '2026-10-12T14:15:00+08:00' }))
}
test('partial_daily_close_is_an_explicit_assumption_and_does_not_change_formal_history', () => {
  const input = partialInput()
  const temporary = computeProvisionalAnalysis(input, 'day', [1, 2, 3])!
  expect(temporary.kind).toBe('provisional')
  expect(temporary.condition).toContain('假设')
  expect(temporary.references.filter(r => r.indicator === 'ma5').map(r => r.value)).toEqual([10.4, 10.6, 10.8])
  expect(temporary.indicators.ma5).toBeCloseTo(10.2)
  expect(input.periods.day!.closed).toHaveLength(19)
})
test('later_full_candle_cannot_recreate_an_earlier_partial_observation', () => {
  const input = partialInput()
  input.periods.day!.source.fetchedAt = '2026-10-12T16:00:00+08:00'
  expect(computeProvisionalAnalysis(input, 'day', [1, 2, 3])).toBeNull()
})
test('provisional_levels_are_separate_from_formal_rules_and_coverage_references', () => {
  const input = partialInput()
  const analysis = buildScenarioAnalysis(input, {}, { id: 'partial-case', version: 1, kind: 'live', createdAt: input.asOf, registry: [],
    scenarios: [], horizons: [1, 2, 3], executionWindow: null })
  expect(analysis.provisional).toHaveLength(1)
  expect(analysis.references.every(r => r.originBarKey === '2026-10-11')).toBe(true)
  expect(analysis.states.day!.shockConfirmed).toBe(false)
})
