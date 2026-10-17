import { expect, test } from 'vitest'
import { analysisInputFixture, seriesFixture } from './scenario-test-fixtures'
import { adaptivePeriodPlan, scopedPeriodInput } from './scenario-period-policy'
import { barEndAt } from './scenario-calendar'
import type { AnalysisAnnotations, AnalysisInput, AnalysisPeriod } from './scenario-types'

function input(periods: AnalysisPeriod[] = ['day']): AnalysisInput {
  const result = analysisInputFixture(seriesFixture({ closes: Array<number>(22).fill(10) }))
  for (const period of periods) result.periods[period] = analysisInputFixture(seriesFixture({ period, closes: Array<number>(22).fill(10) })).periods[period]
  return result
}
function clear(i: AnalysisInput, period: AnalysisPeriod): AnalysisAnnotations {
  const bar = i.periods[period]!.closed.at(-1)!
  const c = { period, barKey: bar.day, eventAt: barEndAt(period, bar.day), confirmedAt: i.asOf, reason: '人工核对规律明确' }
  return { trends: { [period]: { ...c, direction: 'rising', style: 'climbing' } }, mode: { ...c, id: 'trend_climb' },
    bottom: { period, kind: 'indicator', indicator: 'ma5', selectedAt: i.asOf, reason: c.reason } }
}
test('daily_is_sufficient_until_the_user_needs_a_lower_period', () => {
  expect(adaptivePeriodPlan(input(), {})).toMatchObject({ clearPeriod: null, primaryPeriod: 'day', includedPeriods: ['day'], nextPeriod: '60m', nextKind: 'clarify' })
})
test('clear_daily_stops_at_daily_and_allows_only_one_optional_hour_check', () => {
  const i = input(), a = clear(i, 'day')
  expect(adaptivePeriodPlan(i, a)).toMatchObject({ clearPeriod: 'day', primaryPeriod: 'day', includedPeriods: ['day'], maxPeriod: '60m', nextPeriod: '60m', nextKind: 'verify' })
  const all = input(['day', '60m', '30m'])
  expect(adaptivePeriodPlan(all, clear(all, 'day'))).toMatchObject({ clearPeriod: 'day', includedPeriods: ['day', '60m'], nextPeriod: null })
  expect(scopedPeriodInput(all, clear(all, 'day')).periods['30m']).toBeUndefined()
  expect(all.periods['30m']).toBeDefined()
})
test('unclear_daily_then_clear_hour_stops_there_with_one_optional_30m_check', () => {
  const i = input(['day', '60m'])
  expect(adaptivePeriodPlan(i, clear(i, '60m'))).toMatchObject({ clearPeriod: '60m', primaryPeriod: '60m', includedPeriods: ['day', '60m'], maxPeriod: '30m', nextPeriod: '30m', nextKind: 'verify' })
})
test('unconfirmed_or_stale_or_short_history_does_not_claim_a_clear_pattern', () => {
  const i = input(), a = clear(i, 'day')
  a.trends!.day!.barKey = i.periods.day!.closed.at(-2)!.day
  a.trends!.day!.eventAt = barEndAt('day', a.trends!.day!.barKey)
  expect(adaptivePeriodPlan(i, a).clearPeriod).toBeNull()
  const short = analysisInputFixture(seriesFixture({ closes: Array<number>(10).fill(10) }))
  expect(adaptivePeriodPlan(short, clear(short, 'day')).clearPeriod).toBeNull()
  const unknown = clear(i, 'day'); unknown.trends!.day!.direction = 'unknown'
  expect(adaptivePeriodPlan(i, unknown).clearPeriod).toBeNull()
})
test('when_all_periods_remain_unclear_the_smallest_period_does_not_trigger_more_work', () => {
  expect(adaptivePeriodPlan(input(['day', '60m', '30m']), {})).toMatchObject({ clearPeriod: null, primaryPeriod: '30m', nextPeriod: null })
})
