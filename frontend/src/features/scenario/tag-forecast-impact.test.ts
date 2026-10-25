import { expect, test } from 'vitest'
import catalog from '../knowledge/note-tag-catalog.json'
import type { NoteTagRecord } from '../knowledge/note-tags'
import { buildScenarioRuleRegistry } from './scenario-rule-registry'
import { buildScenarioAnalysis } from './scenario-engine'
import { analysisInputFixture, seriesFixture } from './scenario-test-fixtures'
import { forecastRegistryForRecords } from '../knowledge/note-forecast-classification'
import { barEndAt } from './scenario-calendar'
import type { AnalysisAnnotations } from './scenario-types'

test.each(['rising', 'falling', 'flat'] as const)('tag ablation: %s prices and rule decisions ignore current descriptive labels', direction => {
  const closes = Array.from({ length: 30 }, (_, i) => 20 + (direction === 'flat' ? 0 : (direction === 'rising' ? 1 : -1) * i / 10))
  const input = analysisInputFixture(seriesFixture({ closes }))
  const original = catalog.fragments as NoteTagRecord[]
  // Preserve evidence: this isolates labels from removal of the source itself.
  const ablated = original.map(record => ({ ...record, tags: [] }))
  const replaced = original.map(record => ({ ...record, tags: ['topic.turtle', 'kind.case'] }))
  const run = (records: NoteTagRecord[]) => buildScenarioAnalysis(input, {}, {
    id: 'tag-ablation', version: 1, kind: 'live', createdAt: input.asOf,
    registry: buildScenarioRuleRegistry(records), scenarios: [], horizons: [1, 2, 3, 4],
    executionWindow: null, mergeSelection: { method: 'average_delta', scenarioIds: {} },
  })
  const baseline = run(original)
  expect(baseline.references.some(reference => reference.valid)).toBe(true)
  expect(run(ablated)).toEqual(baseline)
  expect(run(replaced)).toEqual(baseline)
  const withoutSources = run([])
  expect(withoutSources.references).toEqual(baseline.references)
  expect(withoutSources.mergedLevels).toEqual(baseline.mergedLevels)
  expect(withoutSources.rules).not.toEqual(baseline.rules)
})

test('forecast-role routing changes entry suitability on falling prices without inventing a new price formula', () => {
  const records = catalog.fragments as NoteTagRecord[]
  const input = analysisInputFixture(seriesFixture({ closes: Array.from({ length: 30 }, (_, i) => 20 - i / 10) }))
  const run = (registry: ReturnType<typeof buildScenarioRuleRegistry>) => buildScenarioAnalysis(input, {}, {
    id: 'role-impact', version: 1, kind: 'live', createdAt: input.asOf,
    registry, scenarios: [], horizons: [1, 2, 3, 4], executionWindow: null,
  })
  const indicatorsOnly = run([])
  const routed = run(forecastRegistryForRecords(records, buildScenarioRuleRegistry(records)))
  expect(indicatorsOnly.entryBlocked).toBe(false)
  expect(routed.entryBlocked).toBe(true)
  expect(routed.rules.find(rule => rule.ruleId === 'daily_ma20_entry_filter')).toMatchObject({ status: 'adopted', evidence: expect.any(Array) })
  expect(routed.references).toEqual(indicatorsOnly.references)
  expect(routed.mergedLevels).toEqual(indicatorsOnly.mergedLevels)
  expect(routed.rules.find(rule => rule.ruleId === 'phase3_climb_upper')?.status).not.toBe('adopted')
})

test('target-role routing adds a source-backed MA5 pressure only after the falling mode is confirmed', () => {
  const records = catalog.fragments as NoteTagRecord[]
  const input = analysisInputFixture(seriesFixture({ closes: Array.from({ length: 30 }, (_, i) => 20 - i / 10) }))
  const origin = input.periods.day!.closed.at(-1)!
  const confirmation = { period: 'day' as const, barKey: origin.day, eventAt: barEndAt('day', origin.day), confirmedAt: input.asOf, reason: '合成案例确认' }
  const annotations: AnalysisAnnotations = { mode: { ...confirmation, id: 'down_rebound' }, trends: { day: { ...confirmation, direction: 'falling', style: 'unknown' } } }
  const registry = forecastRegistryForRecords(records, buildScenarioRuleRegistry(records))
  const run = (annotations: AnalysisAnnotations) => buildScenarioAnalysis(input, annotations, {
    id: 'target-role', version: 1, kind: 'live', createdAt: input.asOf,
    registry, scenarios: [], horizons: [1, 2, 3, 4], executionWindow: null,
  })
  expect(run({}).risk.some(risk => risk.ruleId === 'rebound_ma5_pressure')).toBe(false)
  const pressure = run(annotations).risk.find(risk => risk.ruleId === 'rebound_ma5_pressure')!
  expect(pressure).toMatchObject({ indicator: 'ma5', period: 'day', value: 17.3 })
  expect(pressure.evidence.length).toBeGreaterThan(0)
})
