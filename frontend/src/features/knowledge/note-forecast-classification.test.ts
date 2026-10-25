import { expect, test } from 'vitest'
import catalog from './note-tag-catalog.json'
import { activeTagRecord, type NoteTagRecord } from './note-tags'
import { classifyNoteForForecast, forecastRegistryForRecords, FORECAST_ROLES } from './note-forecast-classification'
import { buildScenarioRuleRegistry } from '../scenario/scenario-rule-registry'
import results from './note-tag-ai-results.json'
import { applyAIOriginalTags, type AIOriginalTags, type NoteCatalog } from './note-tags'

const fragments = catalog.fragments as NoteTagRecord[]
const registry = buildScenarioRuleRegistry(fragments)
test('source-bound entry principles have an executable role regardless of descriptive tag revision', () => {
  const record = fragments.find(record => record.id === 'fragment:买股原则2.md:b3-r01')!
  expect(classifyNoteForForecast(record, registry)).toContainEqual(expect.objectContaining({ role: 'entry', status: 'defined', ruleIds: ['daily_ma20_entry_filter'] }))
  expect(classifyNoteForForecast({ ...record, tags: ['kind.case'] }, registry)).toEqual(classifyNoteForForecast(record, registry))
  expect(forecastRegistryForRecords(fragments, registry)).toHaveLength(12)
  const stale = { ...record, sourceHash: '0'.repeat(64), status: 'reviewed' as const }
  expect(classifyNoteForForecast(stale, registry).some(item => item.status === 'defined')).toBe(false)
  expect(forecastRegistryForRecords([stale], registry)).toEqual([])
})
test('whole-note roles aggregate matching fragment sources without promoting keyword candidates to rules', () => {
  const note = catalog.documents.find(record => record.file === '买股原则2.md') as NoteTagRecord
  expect(classifyNoteForForecast(note, registry).some(item => item.role === 'entry' && item.status === 'defined')).toBe(true)
  const crossing = activeTagRecord(catalog.documents.find(record => record.file === '01-ma-golden-cross.md') as NoteTagRecord)
  expect(classifyNoteForForecast(crossing, registry)).toContainEqual(expect.objectContaining({ role: 'entry', status: 'candidate', ruleIds: [] }))
  expect(forecastRegistryForRecords([crossing], registry)).toEqual([])
})
test('later source quotations require a matching frozen binding, not a local fabricated citation', () => {
  const source = { ...fragments[0], id: 'later', sourceExcerpt: '原文开头', evidence: [{ ...fragments[0].evidence[0], quote: '仅当均线向上时才参与做多。', startLine: 20, endLine: 20 }] }
  expect(classifyNoteForForecast(source, registry).map(item => item.role)).toEqual(['unclassified'])
  expect(classifyNoteForForecast(source, registry, source)).toContainEqual(expect.objectContaining({ role: 'entry', status: 'candidate' }))
  const changed = { ...source, evidence: [{ ...source.evidence[0], quote: '卖出并止损。' }] }
  expect(classifyNoteForForecast(changed, registry, source).map(item => item.role)).toEqual(['unclassified'])
  expect(classifyNoteForForecast({ ...source, sourceHash: '0'.repeat(64) }, registry, source).map(item => item.role)).toEqual(['unclassified'])
})
test('supplements, forged quotes, attachment captions and metadata do not create forecast roles', () => {
  const base = fragments[0]
  for (const quote of ['![买入公式](image.png)', '[卖出案例](https://example.invalid?a=b)', 'title: 买入条件', 'https://example.invalid/计算公式']) {
    const record = { ...base, id: 'attachment', sourceExcerpt: quote, supplement: '按MA5止损',
      sourceReferences: [], evidence: [{ ...base.evidence[0], quote }], tags: ['topic.formula', 'topic.buy'] }
    expect(classifyNoteForForecast(record, registry).map(item => item.role)).toEqual(['unclassified'])
  }
  expect(classifyNoteForForecast({ ...base, id: 'forged', sourceExcerpt: '无条件说明', sourceReferences: [] }, registry).map(item => item.role)).toEqual(['unclassified'])
})

test('reports catalog coverage separately from numerical forecast accuracy', () => {
  const active = applyAIOriginalTags(catalog as NoteCatalog, results.records as AIOriginalTags[])
  const documents = active.documents.map(activeTagRecord)
  const records = [...documents, ...fragments.map(activeTagRecord)]
  const canonical = new Map([...active.documents, ...fragments].map(record => [record.id, record]))
  const classes = records.map(record => ({ record, roles: classifyNoteForForecast(record, registry, canonical.get(record.id)) }))
  const sourceIds = new Set(registry.flatMap(rule => rule.evidence.map(e => e.recordId)))
  console.info('FORECAST_ROLE_AUDIT', JSON.stringify({ documents: documents.length, fragments: fragments.length,
    untaggedDocuments: documents.filter(record => !record.tags.length).length, rules: registry.length, executableSourceFragments: sourceIds.size,
    definedDocuments: classes.filter(item => item.record.level === 'document' && item.roles.some(role => role.status === 'defined')).length,
    roles: Object.fromEntries(Object.keys(FORECAST_ROLES).map(role => [role, classes.filter(item => item.roles.some(item => item.role === role)).length])),
  }))
  expect(sourceIds.size).toBe(10)
})
