// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { extract } from '../../../scripts/note-tag-extraction.mjs'
import { extractNoteTags } from './note-tag-extraction'
import type { NoteTagRecord } from '@/features/knowledge/note-tags'

vi.mock('../../../scripts/note-tag-extraction.mjs', async importOriginal => ({ ...await importOriginal<typeof import('../../../scripts/note-tag-extraction.mjs')>(), extract: vi.fn() }))
vi.mock('@/lib/ai-config', () => ({ getAIConfiguration: () => ({ apiKey: 'test', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', codexModel: 'local-config-default' }) }))
const source = '均线用于判断趋势。'
const record = { id: 'note:test.md', sourceHash: createHash('sha256').update(source).digest('hex') } as NoteTagRecord
const tag = (tagId: string) => ({ tagId, quote: source, startLine: 1, endLine: 1, reason: '全文核心意图' })
beforeEach(() => vi.clearAllMocks())
it('adopts only consensus and preserves both models evidence, disagreements and provenance', async () => {
  vi.mocked(extract).mockResolvedValueOnce({ tags: [tag('topic.ma'), tag('topic.climb')], note: '一' }).mockResolvedValueOnce({ tags: [tag('topic.ma')], note: '二' })
  const result = await extractNoteTags(record, source)
  expect(result.candidate?.tags).toEqual(['topic.ma'])
  expect(result.candidate?.evidence).toHaveLength(2)
  expect(result.candidate?.extraction.disagreements).toEqual([{ tagId: 'topic.climb', model: 'DeepSeek · deepseek-chat' }])
  expect(result.candidate?.extraction.promptHash).toMatch(/^[a-f0-9]{64}$/)
  expect(extract).toHaveBeenCalledWith(expect.objectContaining({ provider: 'codex' }), source)
})
it('preserves one-sided success without pretending it is dual-model consensus', async () => {
  vi.mocked(extract).mockResolvedValueOnce({ tags: [tag('topic.ma')], note: '一' }).mockRejectedValueOnce(new Error('secret from provider'))
  const result = await extractNoteTags(record, source)
  expect(result.candidate).toBeNull()
  expect(result.models[0].tags).toEqual(['topic.ma'])
  expect(result.models[1].error).toContain('Codex')
  expect(JSON.stringify(result)).not.toContain('secret from provider')
})
it('rejects modified full text before model calls', async () => {
  await expect(extractNoteTags(record, source + '修改')).rejects.toThrow('原文内容已变化')
  expect(extract).not.toHaveBeenCalled()
})
