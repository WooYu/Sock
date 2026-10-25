import { describe, expect, test } from 'vitest'
import { evaluateIndicatorError, evaluateRangeCoverage } from './scenario-evaluation'
import { analysisInputFixture, forecastFixture, seriesFixture } from './scenario-test-fixtures'

function executionInput() {
  const series = seriesFixture({ dates: ['2026-10-12'], closes: [10.5], fetchedAt: '2026-10-12T16:00:00+08:00' })
  series.bars[0].low = 10.35; series.bars[0].high = 10.65
  return analysisInputFixture(series).periods.day!
}
describe('range coverage and indicator accuracy are separate', () => {
  test.each(['day', '60m'] as const)('does_not_invent_%s_coverage_between_disjoint_candle_ranges', period => {
    const { snapshot, window } = forecastFixture()
    const span = { ...window, period, endAt: period === 'day' ? '2026-10-13T15:00:00+08:00' : '2026-10-12T11:30:00+08:00' }
    snapshot.references.forEach(r => { r.executionWindow = span })
    const dates = period === 'day' ? ['2026-10-12', '2026-10-13'] : ['2026-10-12T10:30:00+08:00', '2026-10-12T11:30:00+08:00']
    const actual = analysisInputFixture(seriesFixture({ period, dates, closes: [9, 12], fetchedAt: '2026-10-13T16:00:00+08:00' })).periods[period]!
    const result = evaluateRangeCoverage(snapshot, actual, span)
    expect(result.eligible).toBe(true)
    expect(result.references.map(r => r.covered)).toEqual([false, false, false])
  })
  test('current_window_can_cover_future_second_reference', () => {
    const { snapshot, window } = forecastFixture()
    const result = evaluateRangeCoverage(snapshot, executionInput(), window)
    expect(result.eligible).toBe(true)
    expect(result.references.map(r => r.covered)).toEqual([true, true, false])
    expect(result.coveredCount).toBe(2)
    expect(result.anyCovered).toBe(true)
    expect(snapshot.references[1].target.barKey).toBe('2026-10-13')
    expect(result).not.toHaveProperty('profit')
  })
  test('plan_after_window_start_is_ineligible', () => {
    const { snapshot, window } = forecastFixture()
    snapshot.createdAt = '2026-10-12T10:00:00+08:00'
    expect(evaluateRangeCoverage(snapshot, executionInput(), window).issues).toContain('plan_after_window_start')
  })
  test('replay_does_not_claim_a_real_forward_plan', () => {
    const { snapshot, window } = forecastFixture()
    snapshot.kind = 'replay'
    expect(evaluateRangeCoverage(snapshot, executionInput(), window).eligible).toBe(false)
  })
  test('daily_range_cannot_evaluate_partial_day', () => {
    const { snapshot, window } = forecastFixture()
    const partial = { ...window, endAt: '2026-10-12T10:30:00+08:00' }
    snapshot.references.forEach(r => { r.executionWindow = partial })
    expect(evaluateRangeCoverage(snapshot, executionInput(), partial).issues).toContain('finer_bars_required')
  })
  test('unfinished_window_is_observation_not_a_miss', () => {
    const { snapshot, window } = forecastFixture()
    const actual = { ...executionInput(), asOf: '2026-10-12T14:00:00+08:00' }
    const result = evaluateRangeCoverage(snapshot, actual, window)
    expect(result.issues).toContain('window_not_finished')
    expect(result.anyCovered).toBeNull()
  })
  test('invalid_execution_window_returns_a_missing_result', () => {
    const { snapshot, window } = forecastFixture()
    const result = evaluateRangeCoverage(snapshot, executionInput(), { ...window, startAt: 'invalid' })
    expect(result.issues).toContain('invalid_execution_window')
    expect(result.anyCovered).toBeNull()
  })
  test('actual_indicator_uses_target_bar_not_latest_bar', () => {
    const { snapshot } = forecastFixture()
    const prior = snapshot.input.periods.day!.closed
    const dates = [...prior.map(b => b.day), '2026-10-12', '2026-10-13', '2026-10-14']
    const actual = analysisInputFixture(seriesFixture({ dates, closes: [...prior.map(b => b.close), 11.2, 10.2, 13], fetchedAt: '2026-10-14T16:00:00+08:00' })).periods.day!
    const result = evaluateIndicatorError(snapshot, actual)
    expect(result.references[0].actualValue).toBeCloseTo(10.44, 10)
    expect(result.references[0].absoluteError).toBeCloseTo(0.04, 10)
    expect(result.references[0].relativeError).toBeCloseTo(0.04 / 10.44, 10)
    expect(snapshot.references[0].value).toBe(10.4)
  })
  test('missing_target_is_not_zero_error', () => {
    const { snapshot } = forecastFixture()
    const result = evaluateIndicatorError(snapshot, snapshot.input.periods.day!)
    expect(result.references.every(r => r.status === 'insufficient' && r.absoluteError === null)).toBe(true)
  })
})
