import { beforeEach, expect, test } from 'vitest'
import { loadStudySelections, saveStudySelection } from './note-study-selections'
import type { NoteStudyRevision } from '../scenario/scenario-record-types'
import { NOTE_TAG_STORAGE_KEY } from './note-tags'
beforeEach(() => localStorage.clear())
const revision: NoteStudyRevision = { id: '10000000-0000-4000-8000-000000000001', owner: 'web:one', sourceFile: 'one.md', sourceHash: 'a'.repeat(64), sourceText: '原文', sourceUrl: 'https://test/one', channel: 'ai_semantic', parentRevisionId: null, legacyKey: null, payload: {}, createdAt: '2026-10-16T00:00:00Z', payloadHash: 'b'.repeat(64) }
test('stores independently by identity and leaves original manual tag versions untouched', () => {
  localStorage.setItem(NOTE_TAG_STORAGE_KEY, 'existing-manual-v3')
  saveStudySelection('web:one', revision)
  expect(loadStudySelections('web:one')[0].revisionId).toBe(revision.id)
  expect(loadStudySelections('web:two')).toEqual([])
  expect(localStorage.getItem(NOTE_TAG_STORAGE_KEY)).toBe('existing-manual-v3')
  saveStudySelection('web:one', { ...revision, id: '10000000-0000-4000-8000-000000000002' })
  expect(loadStudySelections('web:one')).toHaveLength(1)
  expect(loadStudySelections('web:one')[0].revisionId).toMatch(/2$/)
})
