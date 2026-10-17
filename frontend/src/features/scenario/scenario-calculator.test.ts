import { describe, expect, test } from 'vitest'
import { computeReferences, createFlatScenario } from './scenario-calculator'
import { analysisInputFixture, seriesFixture, testCalendar } from './scenario-test-fixtures'
import type { AnalysisPeriod, Indicator, PriceReference } from './scenario-types'

const legacyIndicators = ['ma5', 'ma10', 'ma20', 'bollUpper', 'bollMiddle', 'bollLower']
const valueAt = (refs: PriceReference[], indicator: Indicator, h: number) => refs.find(r => r.indicator === indicator && r.target.horizon === h)?.value
const options = { period: 'day' as const, horizons: [1, 2, 3] as const, executionWindow: null }
const shockInput = () => analysisInputFixture(seriesFixture({ closes: [...Array<number>(19).fill(10), 11] }))
describe('scenario reference calculations', () => {
  test('retrospective_path_keeps_actual_selection_time_and_is_allowed_only_in_replay', () => {
    const input = shockInput(), scenario = createFlatScenario(input.periods.day!)
    scenario.selectedAt = '2027-01-01T00:00:00Z'
    const args = { ...options, horizons: [1, 2, 3] as [1, 2, 3], method: 'rolling_close' as const, scenario }
    expect(() => computeReferences(input, args)).toThrow(/时点/)
    expect(computeReferences(input, { ...args, kind: 'replay' }).filter(r => legacyIndicators.includes(r.indicator)).every(r => r.valid)).toBe(true)
  })
  test('average_delta_uses_last_three_indicator_values', () => {
    const refs = computeReferences(shockInput(), { ...options, horizons: [1, 2, 3], method: 'average_delta' })
    ;[10.3, 10.4, 10.5].forEach((v, i) => expect(valueAt(refs, 'ma5', i + 1)).toBeCloseTo(v, 10))
  })
  test('large_bull_flat_path_rolls_ma_and_boll', () => {
    const input = shockInput()
    const refs = computeReferences(input, { ...options, horizons: [1, 2, 3], method: 'rolling_close', scenario: createFlatScenario(input.periods.day!) })
    expect([1, 2, 3].map(h => valueAt(refs, 'ma5', h))).toEqual([10.4, 10.6, 10.8])
    expect(valueAt(refs, 'bollUpper', 1)).toBeCloseTo(10.7, 10)
    expect(valueAt(refs, 'bollUpper', 2)).toBeCloseTo(10.864142842854285, 10)
    expect(valueAt(refs, 'bollUpper', 3)).toBeCloseTo(11, 10)
  })
  test('twenty_bars_allow_rolling_but_not_three_boll_origins', () => {
    const input = shockInput()
    const avg = computeReferences(input, { ...options, horizons: [1, 2, 3], method: 'average_delta' })
    expect(avg.filter(r => r.indicator.startsWith('boll')).every(r => !r.valid && r.issues.includes('history_insufficient'))).toBe(true)
    const rolled = computeReferences(input, { ...options, horizons: [1, 2, 3], method: 'rolling_close', scenario: createFlatScenario(input.periods.day!) })
    expect(rolled.filter(r => legacyIndicators.includes(r.indicator)).every(r => r.valid)).toBe(true)
    expect(rolled.filter(r => r.indicator === 'ma250').every(r => !r.valid && r.value === null)).toBe(true)
  })
  test('invalid_extrapolated_boll_is_flagged', () => {
    const input = analysisInputFixture(seriesFixture({ closes: [20, 20, ...Array<number>(20).fill(10)] }))
    const refs = computeReferences(input, { ...options, horizons: [1], method: 'average_delta' })
    const bands = refs.filter(r => r.indicator.startsWith('boll'))
    expect(bands.every(r => !r.valid && r.issues.includes('invalid_boll_order'))).toBe(true)
    expect(valueAt(refs, 'bollUpper', 1)).toBeLessThan(valueAt(refs, 'bollLower', 1)!)
  })
  test('constant_prices_have_zero_bandwidth', () => {
    const input = analysisInputFixture(seriesFixture({ closes: Array<number>(22).fill(10) }))
    expect(computeReferences(input, { ...options, horizons: [1, 2, 3], method: 'average_delta' }).filter(r => legacyIndicators.includes(r.indicator)).every(r => r.valid && r.value === 10)).toBe(true)
  })
  test('last_delta_remains_an_explicit_comparison', () => {
    const refs = computeReferences(shockInput(), { ...options, horizons: [1], method: 'last_delta' })
    expect(valueAt(refs, 'ma5', 1)).toBeCloseTo(10.4)
    expect(refs.every(r => r.method === 'last_delta')).toBe(true)
  })
  test.each<AnalysisPeriod>(['60m', '30m'])('uses independent %s indicators and labels', period => {
    const input = analysisInputFixture(seriesFixture({ period, closes: [...Array<number>(19).fill(10), 11] }))
    const refs = computeReferences(input, { ...options, period, horizons: [1, 2, 3], method: 'rolling_close', scenario: createFlatScenario(input.periods[period]!) })
    expect([1, 2, 3].map(h => valueAt(refs, 'ma5', h))).toEqual([10.4, 10.6, 10.8])
    expect(refs.every(r => r.period === period)).toBe(true)
  })
  test('preopen_targets_from_today_use_horizons_2_3_4', () => {
    const input = analysisInputFixture(seriesFixture({ dates: ['2026-10-09'], closes: [10], fetchedAt: '2026-10-12T09:00:00+08:00' }))
    input.calendar = testCalendar
    const refs = computeReferences(input, { ...options, horizons: [2, 3, 4], method: 'average_delta' })
    expect([...new Set(refs.map(r => r.target.barKey))]).toEqual(['2026-10-13', '2026-10-14', '2026-10-15'])
  })
  test('scenario_origin_and_period_must_match', () => {
    const input = shockInput()
    const scenario = createFlatScenario(input.periods.day!)
    expect(() => computeReferences(input, { ...options, horizons: [1], method: 'rolling_close', scenario: { ...scenario, period: '30m' } })).toThrow(/情景/)
    expect(() => computeReferences(input, { ...options, horizons: [1], method: 'rolling_close', scenario: { ...scenario, originBarKey: '2026-01-01' } })).toThrow(/情景/)
  })
  test.each([0, -1, NaN, Infinity])('rejects invalid hypothetical close %s', close => {
    const input = shockInput()
    expect(() => computeReferences(input, { ...options, horizons: [1], method: 'rolling_close', scenario: { ...createFlatScenario(input.periods.day!), closes: [close] } })).toThrow(/情景收盘价必须/)
  })
  test('four_step_flat_scenario_is_available_without_probability', () => {
    const scenario = createFlatScenario(shockInput().periods.day!)
    expect(scenario.closes).toEqual([11, 11, 11, 11])
    expect(scenario.condition).toContain('保持')
    expect(scenario).not.toHaveProperty('probability')
  })
  test('rolling_does_not_fill_missing_observed_history_with_hypotheses', () => {
    const input = analysisInputFixture(seriesFixture({ closes: [10, 11] }))
    const refs = computeReferences(input, { ...options, horizons: [1, 2, 3], method: 'rolling_close', scenario: createFlatScenario(input.periods.day!) })
    expect(refs.every(r => !r.valid && r.issues.includes('history_insufficient'))).toBe(true)
  })
})

test('all eight MA windows produce four horizon references from sufficient history', () => {
  const input = analysisInputFixture(seriesFixture({ closes: Array.from({ length: 260 }, (_, i) => 100 + i), fetchedAt: '2027-12-31T23:00:00Z' }))
  const refs = computeReferences(input, { period: 'day', horizons: [1, 2, 3, 4], method: 'average_delta', executionWindow: null })
  for (const size of [5, 10, 20, 30, 60, 90, 120, 250]) {
    const current = 359 - (size - 1) / 2
    for (const h of [1, 2, 3, 4]) expect(valueAt(refs, `ma${size}` as Indicator, h)).toBeCloseTo(current + h, 10)
  }
})
