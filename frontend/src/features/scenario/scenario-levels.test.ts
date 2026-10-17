import { describe, expect, test } from 'vitest'
import { mergeReferenceLevels } from './scenario-levels'
import type { PriceReference } from './scenario-types'

function ref(id: string, value: number, period: PriceReference['period'] = 'day'): PriceReference {
  return { id, value, period, indicator: 'ma5', method: 'average_delta', scenarioId: null, originBarKey: '2026-10-09',
    originEndAt: '2026-10-09T15:00:00+08:00', asOf: '2026-10-09T16:00:00+08:00', target: { horizon: 1, barKey: null, endAt: null, issues: ['calendar_missing'] },
    executionWindow: null, valid: true, issues: [] }
}
describe('source-preserving reference groups', () => {
  test('complete_link_does_not_chain_three_nearby_prices', () => {
    const groups = mergeReferenceLevels([ref('a', 10), ref('b', 10.09), ref('c', 10.18)])
    expect(groups.map(g => g.references.map(r => r.id))).toEqual([['a', 'b'], ['c']])
    expect(groups[0].value).toBeCloseTo(10.045)
  })
  test('within_one_percent_uses_arithmetic_mean_of_all_prices_not_median', () => {
    const groups = mergeReferenceLevels([ref('day', 10), ref('hour', 10.01, '60m'), ref('30m', 10.08, '30m')])
    expect(groups).toHaveLength(1)
    expect(groups[0].value).toBeCloseTo(10.03, 12)
    expect(groups[0].references.map(r => r.period)).toEqual(['day', '60m', '30m'])
  })
  test.each([[99.5, 100.5], [9.95, 10.05], [19.9, 20.1]])('one_percent_boundary_%s_%s_is_inclusive_but_prices_outside_are_separate', (low, high) => {
    expect(mergeReferenceLevels([ref('a', low), ref('b', high)])).toHaveLength(1)
    expect(mergeReferenceLevels([ref('a', low), ref('b', high + 0.0001)])).toHaveLength(2)
  })
  test('zero_tolerance_keeps_distinct_representable_prices_separate', () => {
    expect(mergeReferenceLevels([ref('a', 9.95), ref('b', 9.950000000000001)], 0)).toHaveLength(2)
  })
  test('grouping_is_order_independent_and_does_not_round_before_comparing', () => {
    const input = [ref('a', 10), ref('b', 10.09), ref('c', 10.18)]
    expect(mergeReferenceLevels([...input].reverse())).toEqual(mergeReferenceLevels(input))
    expect(mergeReferenceLevels([ref('a', 99.5), ref('b', 100.5001)]).map(g => g.value)).toEqual([99.5, 100.5001])
  })
  test('same_price_keeps_period_and_horizon_sources', () => {
    const hour = { ...ref('hour', 10, '60m'), target: { horizon: 2 as const, barKey: null, endAt: null, issues: [] } }
    const [group] = mergeReferenceLevels([ref('day', 10), hour])
    expect(group.references.map(r => [r.period, r.target.horizon])).toEqual([['day', 1], ['60m', 2]])
  })
  test('duplicate_ids_are_counted_once', () => {
    const a = ref('a', 10)
    expect(mergeReferenceLevels([a, a])[0].references).toHaveLength(1)
  })
  test('invalid_prices_do_not_enter_merged_levels', () => {
    expect(mergeReferenceLevels([{ ...ref('a', -1), valid: false }, { ...ref('b', 10), value: null, valid: false }])).toEqual([])
  })
})
