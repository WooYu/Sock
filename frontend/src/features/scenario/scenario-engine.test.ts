import { expect, test } from 'vitest'
import { buildScenarioAnalysis } from './scenario-engine'
import { analysisInputFixture, seriesFixture } from './scenario-test-fixtures'
import { createFlatScenario } from './scenario-calculator'

const options = { id: 'test-analysis', version: 1, kind: 'live' as const, registry: [], scenarios: [], horizons: [1, 2, 3] as const, executionWindow: null }
test('consolidates_only_the_selected_method_across_periods_and_preserves_the_merge_definition', () => {
  const input = analysisInputFixture(seriesFixture({ closes: Array<number>(22).fill(10) }))
  input.periods['60m'] = analysisInputFixture(seriesFixture({ period: '60m', closes: Array<number>(22).fill(10.01) })).periods['60m']
  input.periods['30m'] = analysisInputFixture(seriesFixture({ period: '30m', closes: Array<number>(22).fill(10.08) })).periods['30m']
  const result = buildScenarioAnalysis(input, {}, { ...options, horizons: [1, 2, 3], createdAt: input.asOf,
    mergeSelection: { method: 'last_delta', scenarioIds: {} } })
  expect(result.consolidation).toMatchObject({ method: 'last_delta', tolerance: 0.01, aggregation: 'arithmetic_mean' })
  expect(result.mergedLevels).toHaveLength(1)
  expect(result.mergedLevels[0].value).toBeCloseTo(10.03, 10)
  expect(result.mergedLevels[0].references).toHaveLength(54)
  expect(result.mergedLevels[0].references.every(r => r.method === 'last_delta')).toBe(true)
})
test('rolling_consolidation_keeps_one_explicit_scenario_per_period_and_defaults_other_periods_to_base', () => {
  const input = analysisInputFixture(seriesFixture({ closes: [...Array<number>(21).fill(10), 11] }))
  input.periods['60m'] = analysisInputFixture(seriesFixture({ period: '60m', closes: Array<number>(22).fill(10) })).periods['60m']
  const pullback = { ...createFlatScenario(input.periods.day!), id: 'day-pullback', kind: 'pullback' as const, closes: [10, 10, 10] }
  const result = buildScenarioAnalysis(input, {}, { ...options, horizons: [1, 2, 3], createdAt: input.asOf, scenarios: [pullback],
    mergeSelection: { method: 'rolling_close', scenarioIds: { day: pullback.id } } })
  const references = result.mergedLevels.flatMap(g => g.references)
  expect(references.filter(r => r.period === 'day').every(r => r.scenarioId === pullback.id)).toBe(true)
  expect(references.filter(r => r.period === '60m').every(r => r.scenarioId?.startsWith('base:60m:'))).toBe(true)
  expect(references.every(r => r.method === 'rolling_close')).toBe(true)
  expect(references).toHaveLength(36)
})
test('builds_additive_analysis_with_original_inputs_and_all_methods', () => {
  const input = analysisInputFixture(seriesFixture({ closes: [...Array<number>(21).fill(10), 11] }))
  const result = buildScenarioAnalysis(input, {}, { ...options, horizons: [1, 2, 3], createdAt: input.asOf })
  expect(result.schemaVersion).toBe(1)
  expect([...new Set(result.references.map(r => r.method))]).toEqual(['average_delta', 'last_delta', 'rolling_close'])
  expect(result.input).toEqual(input)
  expect(result.input).not.toBe(input)
  expect(result).not.toHaveProperty('predictedClose')
})
test('engine_does_not_roll_across_a_marked_price_discontinuity', () => {
  const input = analysisInputFixture(seriesFixture({ closes: Array<number>(22).fill(10) }))
  const result = buildScenarioAnalysis(input, { discontinuities: [{ period: 'day', barKey: input.periods.day!.closed.at(-2)!.day, reason: '口径不连续' }] },
    { ...options, horizons: [1, 2, 3], createdAt: input.asOf })
  expect(result.references.every(r => !r.valid)).toBe(true)
  expect(result.input.periods.day!.closed).toHaveLength(22)
})
test('analysis_keeps_hypothetical_close_path_and_conditions', () => {
  const input = analysisInputFixture(seriesFixture({ closes: [...Array<number>(21).fill(10), 11] }))
  const path = { ...createFlatScenario(input.periods.day!), id: 'selected-pullback', kind: 'pullback' as const,
    closes: [10.5, 10.2, 10], condition: '人工选择的回踩价位路径' }
  const result = buildScenarioAnalysis(input, {}, { ...options, horizons: [1, 2, 3], createdAt: input.asOf, scenarios: [path] })
  expect(result).toHaveProperty('scenarios')
  expect(result.scenarios.find(s => s.id === path.id)).toEqual(path)
})
test.each(['advanced_origin', 'longer_horizon'])('inactive_%s_path_does_not_remove_other_analysis', reason => {
  const input = analysisInputFixture(seriesFixture({ closes: [...Array<number>(21).fill(10), 11] }))
  const path = { ...createFlatScenario(input.periods.day!), id: 'manual-path', kind: 'pullback' as const, closes: [10, 10, 10] }
  if (reason === 'advanced_origin') path.originBarKey = input.periods.day!.closed.at(-2)!.day
  const result = buildScenarioAnalysis(input, {}, { ...options, horizons: reason === 'advanced_origin' ? [1, 2, 3] : [2, 3, 4],
    scenarios: [path], createdAt: input.asOf })
  expect(result.references.length).toBeGreaterThan(0)
  expect(result.references.every(r => r.scenarioId !== path.id)).toBe(true)
  expect(result.inactiveScenarios?.[0].scenario).toEqual(path)
})
