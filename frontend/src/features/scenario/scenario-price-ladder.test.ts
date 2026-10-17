import { describe, expect, test } from 'vitest'
import { analysisInputFixture, seriesFixture, testCalendar } from './scenario-test-fixtures'
import { buildDailyPriceLadder, resolveDailyPriceLimit } from './scenario-price-ladder'
import type { DailyPriceSelection, MergedLevel } from './scenario-types'

const input = () => analysisInputFixture(seriesFixture({ closes: Array<number>(22).fill(10) }))
const selection = (): DailyPriceSelection => ({ limit: resolveDailyPriceLimit('603533', '掌阅科技') })
const groups = (...prices: number[]): MergedLevel[] => prices.map((value, i) => ({ id: 'group-' + i, value, references: [] }))

describe('single-session daily-close price ladder', () => {
  test('bounds_both_sides_and_reports_signed_changes_without_clamping_outliers', () => {
    const refs = groups(8.99, 9.1, 10.2, 10.7, 11, 11.001)
    const result = buildDailyPriceLadder(input(), refs, selection())
    expect(result.anchor).toMatchObject({ close: 10, barKey: '2026-09-22' })
    expect(result.band).toEqual({ lower: 9, upper: 11 })
    expect(result.up.map(p => p.value)).toEqual([10.2, 10.7, 11])
    expect(result.up[0].changeRatio).toBeCloseTo(0.02)
    expect(result.down).toHaveLength(1)
    expect(result.down.find(p => p.value === 9.1)?.changeRatio).toBeCloseTo(-0.09)
    expect(result.excludedGroupIds).toEqual(['group-0', 'group-5'])
    expect(result.up.at(-1)?.groupIds).toEqual(['group-4'])
    expect(refs.at(-1)?.value).toBe(11.001)
  })
  test.each([0, 1, 2, 7])('returns_all_%i_computed_prices_without_padding_or_truncating', count => {
    const prices = Array.from({ length: count }, (_, i) => 10.05 + i * 0.12)
    const result = buildDailyPriceLadder(input(), groups(...prices), selection())
    expect(result.up).toHaveLength(count)
    expect(result.down).toHaveLength(0)
    expect(result.definitionVersion).toBe('daily-close-levels-v2')
    expect(result.selection).not.toHaveProperty('count')
    for (const side of [result.up, result.down]) {
      expect(new Set(side.map(p => p.value)).size).toBe(side.length)
      for (const p of side) {
        expect(p.value).toBeGreaterThanOrEqual(9)
        expect(p.value).toBeLessThanOrEqual(11)
        expect(p.changeRatio).toBeCloseTo(p.value / 10 - 1)
        expect(p.kind).toBe('merged')
        expect(p.groupIds).toHaveLength(1)
      }
    }
  })
  test('uses_completed_daily_close_even_when_hourly_and_observed_daily_prices_differ', () => {
    const day = analysisInputFixture(seriesFixture({ closes: [10, 50], dates: ['2026-09-21', '2026-09-22'], fetchedAt: '2026-09-22T14:00:00+08:00' }))
    const hour = analysisInputFixture(seriesFixture({ period: '60m', closes: [20], fetchedAt: day.asOf }))
    day.periods['60m'] = hour.periods['60m']
    expect(buildDailyPriceLadder(day, [], selection()).anchor?.close).toBe(10)
  })
  test('rounds_limits_half_up_to_cents_and_collapses_identical_display_prices', () => {
    const day = analysisInputFixture(seriesFixture({ closes: [19.95] }))
    const result = buildDailyPriceLadder(day, groups(20.001, 20.004, 19.95, 21.951), selection())
    expect(result.band).toEqual({ lower: 17.96, upper: 21.95 })
    expect(result.up.filter(p => p.value === 20)).toHaveLength(1)
    expect(result.up.find(p => p.value === 20)?.groupIds).toEqual(['group-0', 'group-1'])
    expect([...result.up, ...result.down].every(p => p.value !== 19.95)).toBe(true)
    expect(result.excludedGroupIds).toContain('group-3')
  })
  test('retains_all_computed_levels_in_distance_order_and_does_not_fill_empty_low_price_results', () => {
    const result = buildDailyPriceLadder(input(), groups(10.9, 10.1, 10.4, 10.2), selection())
    expect(result.up.map(p => p.value)).toEqual([10.1, 10.2, 10.4, 10.9])
    const tiny = analysisInputFixture(seriesFixture({ closes: [0.3] }))
    const resultWithoutCandidates = buildDailyPriceLadder(tiny, [], selection())
    expect(resultWithoutCandidates.up).toEqual([])
    expect(resultWithoutCandidates.down).toEqual([])
    expect(resultWithoutCandidates.issues).toEqual([])
  })
  test('missing_daily_data_or_unverified_limit_does_not_manufacture_a_band', () => {
    const hour = analysisInputFixture(seriesFixture({ period: '60m', closes: [10] }))
    expect(buildDailyPriceLadder(hour, [], selection())).toMatchObject({ anchor: null, band: null, up: [], down: [] })
    expect(buildDailyPriceLadder(input(), [], { limit: resolveDailyPriceLimit('603533', '*ST测试') }))
      .toMatchObject({ band: null, up: [], down: [], issues: ['price_limit_unverified'] })
  })
  test.each([
    ['603533', '掌阅科技', 0.1], ['300750', '宁德时代', 0.2], ['301001', undefined, 0.2],
    ['688981', '中芯国际', 0.2], ['920001', undefined, 0.3], ['830001', undefined, 0.3],
    ['603533', '*ST测试', null], ['603533', 'ST测试', null], ['603533', 'N测试', null],
    ['603533', 'C测试', null], ['603533', '退市测试', null], ['123456', undefined, null],
  ])('resolves_%s_%s_without_assuming_all_stocks_share_one_rule', (code, name, ratio) => {
    expect(resolveDailyPriceLimit(code, name).ratio).toBe(ratio)
  })
  test('new_calculations_reject_fixed_counts_and_invalid_limits', () => {
    expect(() => buildDailyPriceLadder(input(), [], { ...selection(), count: 3 } as unknown as DailyPriceSelection)).toThrow()
    expect(() => buildDailyPriceLadder(input(), [], { limit: { source: 'manual', ratio: -0.1, label: '错误' } })).toThrow()
  })
  test.each(['calendar', '60m', '30m'] as const)('suppresses_a_stale_daily_anchor_proven_by_%s', proof => {
    const asOf = '2026-10-15T16:00:00+08:00'
    const stale = analysisInputFixture(seriesFixture({ closes: [10], dates: ['2026-10-12'], fetchedAt: asOf }))
    if (proof === 'calendar') stale.calendar = testCalendar
    else stale.periods[proof] = analysisInputFixture(seriesFixture({ period: proof, closes: [12],
      dates: ['2026-10-15T15:00:00+08:00'], fetchedAt: asOf })).periods[proof]
    expect(buildDailyPriceLadder(stale, groups(12), selection())).toMatchObject({ anchor: { close: 10 }, band: null,
      up: [], down: [], issues: ['daily_close_stale'] })
  })
  test('a_current_intraday_bar_does_not_invalidate_the_previous_session_close', () => {
    const asOf = '2026-10-15T10:45:00+08:00'
    const current = analysisInputFixture(seriesFixture({ closes: [10], dates: ['2026-10-14'], fetchedAt: asOf }))
    current.calendar = testCalendar
    current.periods['60m'] = analysisInputFixture(seriesFixture({ period: '60m', closes: [12],
      dates: ['2026-10-15T10:30:00+08:00'], fetchedAt: asOf })).periods['60m']
    expect(buildDailyPriceLadder(current, [], selection())).toMatchObject({ band: { lower: 9, upper: 11 }, issues: [] })
  })
  test('collapsed_low_price_bounds_require_tick_rule_verification_instead_of_a_false_band', () => {
    const tiny = input()
    Object.assign(tiny.periods.day!.closed.at(-1)!, { open: 0.05, close: 0.05, high: 0.06, low: 0.04 })
    expect(buildDailyPriceLadder(tiny, [], selection())).toMatchObject({ anchor: { close: 0.05 }, band: null,
      up: [], down: [], issues: ['price_limit_tick_unverified'] })
  })
})
