import { describe, expect, test } from 'vitest'
import catalog from '../knowledge/note-tag-catalog.json'
import type { NoteTagRecord } from '../knowledge/note-tags'
import { buildScenarioRuleRegistry } from './scenario-rule-registry'
import { evaluateScenarioRules } from './scenario-rules'
import { derivePeriodState } from './scenario-state'
import { analysisInputFixture, seriesFixture } from './scenario-test-fixtures'
import { barEndAt } from './scenario-calendar'
import type { AnalysisAnnotations, Confirmation, PeriodInput } from './scenario-types'

const registry = () => buildScenarioRuleRegistry(catalog.fragments as NoteTagRecord[])
const confirm = (input: PeriodInput): Confirmation => ({ period: input.period, barKey: input.closed.at(-1)!.day,
  eventAt: barEndAt(input.period, input.closed.at(-1)!.day), confirmedAt: input.asOf, reason: '人工确认合成案例' })
function climbing() {
  const input = analysisInputFixture(seriesFixture({ closes: [...Array<number>(21).fill(10), 11] }))
  const c = confirm(input.periods.day!)
  const annotations: AnalysisAnnotations = {
    trends: { day: { ...c, direction: 'rising', style: 'climbing' } }, mode: { ...c, id: 'trend_climb' }, holding: 'held',
    bottom: { period: 'day', kind: 'indicator', indicator: 'ma5', selectedAt: input.asOf, reason: '使用日MA5底线' },
  }
  return { input, annotations }
}
describe('source-backed scenario principles', () => {
  test('manual_hour_bottom_keeps_its_period_without_relabeling_a_daily_principle', () => {
    const input = analysisInputFixture(seriesFixture({ period: '60m', closes: [...Array<number>(21).fill(10), 11] }))
    const c = confirm(input.periods['60m']!)
    const annotations: AnalysisAnnotations = { trends: { '60m': { ...c, direction: 'rising', style: 'climbing' } },
      mode: { ...c, id: 'trend_climb' }, holding: 'held', bottom: { period: '60m', kind: 'indicator', indicator: 'ma5',
        selectedAt: input.asOf, reason: '人工选择小时MA5为观察底线' } }
    const result = evaluateScenarioRules(input, { '60m': derivePeriodState(input.periods['60m']!, annotations, 'live') }, annotations, registry())
    expect(result.risk).toEqual(expect.arrayContaining([expect.objectContaining({ ruleId: 'manual_selected_bottom', period: '60m', indicator: 'ma5', value: 10.2 })]))
    expect(result.risk.some(r => r.ruleId === 'trend_selected_bottom')).toBe(false)
  })
  test('range_boundaries_have_explicit_failure_and_become_invalid_after_close_breaks_out', () => {
    const input = analysisInputFixture(seriesFixture({ closes: Array<number>(22).fill(10) }))
    const c = confirm(input.periods.day!)
    const annotations: AnalysisAnnotations = { mode: { ...c, id: 'range' }, range: { ...c, lower: 9, upper: 11 } }
    const run = () => evaluateScenarioRules(input, { day: derivePeriodState(input.periods.day!, annotations, 'live') }, annotations, registry())
    expect(run().risk.filter(r => r.ruleId === 'manual_range').map(r => r.value)).toEqual([9, 11])
    input.periods.day!.closed.at(-1)!.close = 12
    const broken = run().risk.find(r => r.ruleId === 'manual_range_invalid')
    expect(broken?.condition).toContain('箱体已失效')
    expect(run().risk.some(r => r.ruleId === 'manual_range')).toBe(false)
  })
  test('mirror_risk_retains_preselected_line_and_failure_branch', () => {
    const input = analysisInputFixture(seriesFixture({ dates: ['2026-10-09', '2026-10-12', '2026-10-13'], closes: [10, 11.2, 11.1] }))
    const c = confirm(input.periods.day!)
    const annotations: AnalysisAnnotations = { mode: { ...c, id: 'mirror_retest' }, mirror: { period: 'day', linePrice: 11,
      selectedAt: '2026-10-09T16:00:00+08:00', breakBarKey: '2026-10-12', retestBarKey: '2026-10-13', direction: 'up', touchTolerance: 0, reason: '突破前选定' } }
    const result = evaluateScenarioRules(input, { day: derivePeriodState(input.periods.day!, annotations, 'live') }, annotations, registry())
    expect(result.risk).toEqual(expect.arrayContaining([expect.objectContaining({ ruleId: 'manual_mirror_line', value: 11, condition: expect.stringContaining('失守') })]))
  })
  test('tag_review_does_not_define_rule_conditions', () => {
    const rules = buildScenarioRuleRegistry([])
    expect(rules.every(r => r.undefinedConditions.some(m => m.startsWith('source_missing:')))).toBe(true)
    const reviewed = (catalog.fragments as NoteTagRecord[]).map(r => ({ ...r, status: 'reviewed' as const }))
    expect(buildScenarioRuleRegistry(reviewed).find(r => r.id === 'phase3_climb_upper')!.undefinedConditions).toContain('upper_touch_window')
  })
  test('missing_phase_does_not_match_surge_exit', () => {
    const { input, annotations } = climbing()
    annotations.trends!.day!.style = 'surging'
    annotations.granvilleEvents = [{ ...confirm(input.periods.day!), barKey: input.periods.day!.closed.at(-2)!.day,
      eventAt: barEndAt('day', input.periods.day!.closed.at(-2)!.day), context: 'up', kind: 'anchor' }]
    const result = evaluateScenarioRules(input, { day: derivePeriodState(input.periods.day!, annotations, 'live') }, annotations, registry())
    const rule = result.rules.find(r => r.ruleId === 'surge_stage_two')!
    expect(rule.status).toBe('insufficient')
    expect(rule.missing).toContain('phase3Opening')
  })
  test('surge_exit_requires_phase_anchor_and_style', () => {
    const { input, annotations } = climbing()
    const c = confirm(input.periods.day!)
    annotations.trends!.day!.style = 'surging'
    annotations.flags = { phase3Opening: { ...c, value: true }, doubleHigh: { ...c, value: false } }
    annotations.granvilleEvents = [{ ...c, barKey: input.periods.day!.closed.at(-2)!.day,
      eventAt: barEndAt('day', input.periods.day!.closed.at(-2)!.day), context: 'up', kind: 'anchor' }]
    const result = evaluateScenarioRules(input, { day: derivePeriodState(input.periods.day!, annotations, 'live') }, annotations, registry())
    expect(result.rules.find(r => r.ruleId === 'surge_stage_two')!.status).toBe('adopted')
    expect(result.risk.some(r => r.ruleId === 'surge_stage_two' && r.kind === 'deadline' && r.deadlineStage === 2)).toBe(true)
  })
  test('same_words_different_exceptions_are_not_duplicates', () => {
    const input = analysisInputFixture(seriesFixture({ closes: Array.from({ length: 22 }, (_, i) => 20 - i / 4) }))
    const first = registry().find(r => r.id === 'daily_ma20_entry_filter')!
    const rules = [first, { ...first, id: 'second', exceptions: ['dual_high'] }]
    const result = evaluateScenarioRules(input, { day: derivePeriodState(input.periods.day!, {}, 'live') }, {}, rules)
    expect(result.rules.every(r => r.status !== 'duplicate')).toBe(true)
  })
  test('identical_semantics_merge_sources_and_explain_duplicate', () => {
    const input = analysisInputFixture(seriesFixture({ closes: Array.from({ length: 22 }, (_, i) => 20 - i / 4) }))
    const first = registry().find(r => r.id === 'daily_ma20_entry_filter')!
    const result = evaluateScenarioRules(input, { day: derivePeriodState(input.periods.day!, {}, 'live') }, {}, [first, { ...first, id: 'same' }])
    expect(result.rules[1].status).toBe('duplicate')
    expect(result.rules[1].reason).toContain(first.id)
  })
  test('dedup_keeps_different_source_hashes', () => {
    const input = analysisInputFixture(seriesFixture({ closes: Array.from({ length: 22 }, (_, i) => 20 - i / 4) }))
    const first = registry().find(r => r.id === 'daily_ma20_entry_filter')!
    const second = { ...first, id: 'same-new-source', evidence: first.evidence.map(e => ({ ...e, sourceHash: 'f'.repeat(64) })) }
    const result = evaluateScenarioRules(input, { day: derivePeriodState(input.periods.day!, {}, 'live') }, {}, [first, second])
    expect(result.rules[0].evidence.some(e => e.sourceHash === first.evidence[0].sourceHash)).toBe(true)
    expect(result.rules[0].evidence.some(e => e.sourceHash === 'f'.repeat(64))).toBe(true)
  })
  test('equivalent_condition_order_is_deduplicated', () => {
    const input = analysisInputFixture(seriesFixture({ closes: Array.from({ length: 22 }, (_, i) => 20 - i / 4) }))
    const first = registry().find(r => r.id === 'daily_down_ma5_ma10_filter')!
    const second = { ...first, id: 'reordered', conditions: [...first.conditions].reverse() }
    const result = evaluateScenarioRules(input, { day: derivePeriodState(input.periods.day!, {}, 'live') }, {}, [first, second])
    expect(result.rules[1].status).toBe('duplicate')
  })
  test('30m_ma5_cannot_replace_daily_stop', () => {
    const { input, annotations } = climbing()
    input.periods['30m'] = analysisInputFixture(seriesFixture({ period: '30m', closes: Array<number>(22).fill(10.8) })).periods['30m']
    const result = evaluateScenarioRules(input, {
      day: derivePeriodState(input.periods.day!, annotations, 'live'), '30m': derivePeriodState(input.periods['30m']!, {}, 'live'),
    }, annotations, registry())
    const bottom = result.risk.find(r => r.ruleId === 'trend_selected_bottom')!
    expect(bottom.period).toBe('day')
    expect(bottom.indicator).toBe('ma5')
    expect(bottom.value).toBeCloseTo(10.2)
  })
  test('flat_position_gets_entry_filter_without_fake_profit', () => {
    const input = analysisInputFixture(seriesFixture({ closes: Array.from({ length: 22 }, (_, i) => 20 - i / 4) }))
    const result = evaluateScenarioRules(input, { day: derivePeriodState(input.periods.day!, {}, 'live') }, { holding: 'flat' }, registry())
    expect(result.entryBlocked).toBe(true)
    expect(result).not.toHaveProperty('profit')
  })
  test('manual_disable_keeps_source_and_reason', () => {
    const input = analysisInputFixture(seriesFixture())
    const result = evaluateScenarioRules(input, { day: derivePeriodState(input.periods.day!, {}, 'live') }, { disabledRules: { daily_ma20_entry_filter: '本轮只观察' } }, registry())
    expect(result.rules.find(r => r.ruleId === 'daily_ma20_entry_filter')).toMatchObject({ status: 'manual_disabled', reason: '本轮只观察' })
  })
})
