import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { NoteStudyWorkbench } from './note-study-workbench'
import catalog from './note-tag-catalog.json'
import type { NoteTagRecord } from './note-tags'
import { NOTE_TAG_STORAGE_KEY } from './note-tags'
const file = '01-ma-golden-cross.md', hash = catalog.documents[0].sourceHash
const study = { file, sourceHash: hash, studyRevisionId: 'study-one', status: 'ai_candidate', summary: '文字学习候选', tags: ['topic.ma5'], roles: ['trend'], evidence: [{ tagId: 'topic.ma5', startLine: 1, endLine: 1, quote: '原文', reason: '原文提及' }], claims: [{ claimId: 'claim1', name: '候选条件', kind: 'condition', formula: null, inputs: ['MA5'], periods: ['day'], applicability: ['上涨'], invalidation: [], gaps: ['阈值缺失'], computability: 'needs_definition', evaluationStatus: 'untested', evidence: [{ startLine: 1, endLine: 1, quote: '原文' }] }], gaps: ['待补定义'], attachments: { present: true, status: 'not_inspected', note: '附件未读' }, userRuleConflicts: ['旧笔记强制算全部周期'], readCoverage: { fromLine: 1, throughLine: 1 }, sourceUrl: 'https://test/note' }
beforeEach(() => localStorage.clear()); afterEach(() => vi.unstubAllGlobals())
test('reads candidate evidence, imports and selects a separate study without overwriting manual v3', async () => {
  const own = { ...catalog.documents[0], version: 3 } as NoteTagRecord
  localStorage.setItem(NOTE_TAG_STORAGE_KEY, 'manual-v3-unchanged')
  let imported = false
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith('/api/note-studies') && init?.method === 'POST') { imported = true; return Response.json({ ...JSON.parse(init.body as string), id: '10000000-0000-4000-8000-000000000001', owner: 'web:device', createdAt: '2026-10-16T00:00:00Z', payloadHash: 'b'.repeat(64) }) }
    if (url.startsWith('/api/note-studies')) return Response.json({ items: [], nextCursor: null, asOf: '2026-10-16T00:00:00Z' })
    if (url.includes('?file=')) return Response.json({ sourceText: '原文', study })
    return Response.json({ documentCount: 146, claimCount: 271, uninspectedAttachmentCount: 53, entries: [{ file, title: '均线笔记', sourceHash: hash, summary: study.summary, roles: study.roles, tags: study.tags, claimCount: 1, attachmentStatus: 'not_inspected' }] })
  }))
  render(<NoteStudyWorkbench currentTags={[own]} />)
  await screen.findByText('候选条件'); expect(screen.getByText(/53.*附件/)).toBeInTheDocument()
  expect(screen.getByText('阈值缺失')).toBeInTheDocument(); expect(screen.getAllByText(/未测试/).length).toBeGreaterThan(0)
  await userEvent.click(screen.getByRole('button', { name: '保存研究建议' }))
  await waitFor(() => expect(imported).toBe(true))
  await userEvent.click(await screen.findByRole('button', { name: '选为后续分析依据' }))
  await screen.findByText(/已选用.*仍未启用新公式/)
  expect(localStorage.getItem(NOTE_TAG_STORAGE_KEY)).toBe('manual-v3-unchanged')
})
