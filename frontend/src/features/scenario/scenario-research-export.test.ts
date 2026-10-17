import { expect, test } from 'vitest'
import { buildResearchExport, freezeLegacyBindings } from './scenario-research-export'
import { researchEvaluation, researchRecord } from './scenario-research-test-fixtures'
import catalog from '../knowledge/note-tag-catalog.json'
import type { NoteTagRecord } from '../knowledge/note-tags'
test('exports frozen forecast, exact evaluation versions and all available provenance without latest-tag substitution', () => {
  const record = researchRecord(); const evaluation = researchEvaluation()
  record.noteBindings = [{ status: 'unresolved', sourceHash: 'd'.repeat(64), revisionId: null, legacyKey: { legacyRecordId: 'old', level: 'document', sourceHash: 'd'.repeat(64), tagVersion: 2, channel: 'legacy' }, inlineVersion: null, study: null }]
  const output = buildResearchExport(record, { latestStatus: evaluation, latestSuccessful: evaluation }, [evaluation])
  expect(output.forecast).toEqual(record); expect(output.evaluations[0].id).toBe(evaluation.id)
  expect(output.actualEvidence[0].candleHash).toBe('b'.repeat(64))
  expect(output.noteBindings[0].legacyKey?.tagVersion).toBe(2); expect(output.missingEvidence).toContain('unresolved_note_reference:old')
  record.snapshot.id = 'changed-after-export'
  expect(output.forecast.snapshot.id).not.toBe('changed-after-export')
})
test('legacy evidence selects the exact source/tag version rather than current latest tags', () => {
  const old = catalog.documents[0] as NoteTagRecord, latest = { ...old, version: 3 }
  const record = researchRecord(); record.snapshot.annotations.discontinuities = [{ period: 'day', barKey: '2026-10-09', reason: 'fixture',
    evidence: [{ recordId: old.id, tagVersion: 1, sourceHash: old.sourceHash, sourceUrl: old.sourceUrl, startLine: 1, endLine: 1, quote: old.sourceExcerpt }] }]
  const bindings = freezeLegacyBindings(record.snapshot, [old, latest])
  expect(bindings[0].legacyKey?.tagVersion).toBe(1); expect(bindings[0].inlineVersion?.version).toBe(1)
})
