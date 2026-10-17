import { describe, expect, test } from 'vitest'
import { derivePeriodState, matchModeCandidates } from './scenario-state'
import { analysisInputFixture, seriesFixture } from './scenario-test-fixtures'
import type { AnalysisAnnotations, AnalysisPeriod, Confirmation, GranvilleEvent, PeriodInput } from './scenario-types'
import { barEndAt } from './scenario-calendar'

function dayInput(asOf = '2026-10-13T16:00:00+08:00', closes = [10, 11, 12]) {
  return analysisInputFixture(seriesFixture({ dates: ['2026-10-09', '2026-10-12', '2026-10-13'], closes, fetchedAt: asOf }), asOf).periods.day!
}
const event = (day: string, context: 'up' | 'down' = 'up', kind: 'anchor' | 'reset' = 'anchor'): GranvilleEvent => ({
  period: 'day', barKey: day, eventAt: day + 'T15:00:00+08:00', confirmedAt: day + 'T15:30:00+08:00', reason: '人工确认测试起点', context, kind,
})
const confirmation = (input: PeriodInput): Confirmation => ({
  period: input.period, barKey: input.closed.at(-1)!.day, eventAt: barEndAt(input.period, input.closed.at(-1)!.day),
  confirmedAt: input.asOf, reason: '人工核对合成测试走势',
})
describe('multi-period states and event anchors', () => {
  test('granville_requires_anchor', () => {
    expect(derivePeriodState(dayInput(), {}, 'live').granville.stage).toBeNull()
  })
  test('up_and_down_anchors_have_separate_context', () => {
    const state = derivePeriodState(dayInput(), { granvilleEvents: [event('2026-10-09'), event('2026-10-12', 'down')] }, 'live')
    expect(state.granville.context).toBe('down')
    expect(state.granville.stage).toBe(2)
    expect(state.granville.contextStages.up.stage).toBe(3)
  })
  test('reset_starts_stage_one', () => {
    const state = derivePeriodState(dayInput(), { granvilleEvents: [event('2026-10-09'), event('2026-10-13', 'up', 'reset')] }, 'live')
    expect(state.granville.stage).toBe(1)
    expect(state.granville.events).toHaveLength(2)
  })
  test('stage_counts_only_closed_bars_in_its_period', () => {
    const input = dayInput('2026-10-12T16:00:00+08:00')
    const hourly = { ...event('2026-10-09'), period: '60m' as const, barKey: '2026-10-12T10:30:00+08:00' }
    expect(derivePeriodState(input, { granvilleEvents: [event('2026-10-09'), hourly] }, 'live').granville.stage).toBe(2)
  })
  test('daily_downtrend_survives_30m_rebound', () => {
    const daily = dayInput()
    const minute = analysisInputFixture(seriesFixture({ period: '30m', closes: Array.from({ length: 22 }, (_, i) => 10 + i / 10) })).periods['30m']!
    const annotations: AnalysisAnnotations = { trends: {
      day: { ...confirmation(daily), direction: 'falling', style: 'unknown' },
      '30m': { ...confirmation(minute), direction: 'rising', style: 'unknown' },
    } }
    const states = { day: derivePeriodState(daily, annotations, 'live'), '30m': derivePeriodState(minute, annotations, 'live') }
    expect(states.day.direction).toBe('falling')
    expect(states['30m'].direction).toBe('rising')
  })
  test('future_confirmation_cannot_change_prior_state', () => {
    const input = dayInput('2026-10-12T16:00:00+08:00')
    const future = { ...confirmation(input), confirmedAt: '2026-10-13T16:00:00+08:00', direction: 'rising' as const, style: 'surging' as const }
    const state = derivePeriodState(input, { trends: { day: future } }, 'live')
    expect(state.confirmed).toBe(false)
    expect(state.style).toBe('unknown')
  })
  test('trend_confirmation_expires_when_origin_bar_changes', () => {
    const input = dayInput()
    const old = { ...event('2026-10-09'), direction: 'rising' as const, style: 'climbing' as const }
    expect(derivePeriodState(input, { trends: { day: old } }, 'live').confirmed).toBe(false)
  })
  test('replay_retains_the_actual_later_confirmation_time', () => {
    const input = dayInput('2026-10-12T16:00:00+08:00')
    const anchor = { ...event('2026-10-09'), confirmedAt: '2026-10-14T16:00:00+08:00' }
    expect(derivePeriodState(input, { granvilleEvents: [anchor] }, 'live').granville.stage).toBeNull()
    const replay = derivePeriodState(input, { granvilleEvents: [anchor] }, 'replay')
    expect(replay.granville.stage).toBe(2)
    expect(replay.granville.events[0].confirmedAt).toBe(anchor.confirmedAt)
  })
  test('known_discontinuity_blocks_cross_event_indicators', () => {
    const input = analysisInputFixture(seriesFixture({ closes: Array<number>(22).fill(10) })).periods.day!
    const state = derivePeriodState(input, { discontinuities: [{ period: 'day', barKey: input.closed.at(-2)!.day, reason: '已核实价格口径不连续' }] }, 'live')
    expect(state.facts.ma5).toBeNull()
    expect(state.issues).toContain('price_discontinuity')
  })
  test.each<AnalysisPeriod>(['day', '60m', '30m'])('constant %s has zero bandwidth and unknown style', period => {
    const input = analysisInputFixture(seriesFixture({ period, closes: Array<number>(22).fill(10) })).periods[period]!
    const state = derivePeriodState(input, {}, 'live')
    expect(state.facts.bandwidth).toBe(0)
    expect(state.style).toBe('unknown')
    expect(state.confirmed).toBe(false)
  })
})
describe('mode conditions', () => {
  test('confirmed_surge_is_an_uptrend_mode', () => {
    const input = dayInput()
    const annotations: AnalysisAnnotations = {
      trends: { day: { ...confirmation(input), direction: 'rising', style: 'surging' } },
      mode: { ...confirmation(input), id: 'trend_climb' },
      bottom: { period: 'day', kind: 'indicator', indicator: 'ma5', selectedAt: input.asOf, reason: '明确日MA5底线' },
    }
    expect(matchModeCandidates({ day: derivePeriodState(input, annotations, 'live') }, annotations).find(m => m.id === 'trend_climb')!.status).toBe('confirmed')
  })
  const mirror = (input: PeriodInput): AnalysisAnnotations => ({
    mirror: { period: 'day', linePrice: 11, selectedAt: '2026-10-09T16:00:00+08:00', breakBarKey: '2026-10-12', retestBarKey: '2026-10-13', direction: 'up', touchTolerance: 0, reason: '测试预选压力转支撑' },
    mode: { ...confirmation(input), id: 'mirror_retest' },
  })
  test('mirror_line_must_be_selected_before_break', () => {
    const input = dayInput(undefined, [10, 11.2, 11.1])
    const annotations = mirror(input)
    annotations.mirror!.selectedAt = '2026-10-12T16:00:00+08:00'
    const candidate = matchModeCandidates({ day: derivePeriodState(input, annotations, 'live') }, annotations).find(m => m.id === 'mirror_retest')!
    expect(candidate.status).toBe('insufficient')
    expect(candidate.missing).toContain('preselected_line')
  })
  test('mirror_distinguishes_retest_success_and_failure', () => {
    for (const [close, outcome] of [[11.1, 'support_confirmed'], [10.8, 'support_failed']] as const) {
      const input = dayInput(undefined, [10, 11.2, close])
      const annotations = mirror(input)
      const candidate = matchModeCandidates({ day: derivePeriodState(input, annotations, 'live') }, annotations).find(m => m.id === 'mirror_retest')!
      expect(candidate.mirrorOutcome).toBe(outcome)
    }
  })
  test('mirror_without_touch_tolerance_remains_insufficient', () => {
    const input = dayInput(undefined, [10, 11.2, 11.1])
    const annotations = mirror(input)
    annotations.mirror!.touchTolerance = null
    expect(matchModeCandidates({ day: derivePeriodState(input, annotations, 'live') }, annotations).find(m => m.id === 'mirror_retest')!.status).toBe('insufficient')
  })
})
