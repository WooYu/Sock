// @vitest-environment node
import { expect, test } from 'vitest'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { listProposals, getProposal } from './note-study-proposals'
test('all 146 frozen studies have original byte hashes, 271 claims, and attachment limitations', () => {
  const index = listProposals()
  expect(index.documentCount).toBe(146); expect(index.claimCount).toBe(271); expect(index.uninspectedAttachmentCount).toBe(53)
  for (const entry of index.entries) {
    const full = getProposal(entry.file)!
    expect(createHash('sha256').update(full.sourceText).digest('hex')).toBe(entry.sourceHash)
    expect(full.study.status).toBe('ai_candidate')
    for (const claim of full.study.claims) expect(claim.evaluationStatus).toBe('untested')
  }
  expect(getProposal('../../secret')).toBeNull()
  expect(execFileSync('node', ['scripts/build-note-study.mjs', '--check'], { encoding: 'utf8' })).toContain('146')
})
