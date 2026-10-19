// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'
import { POST } from './route'
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
const request = () => new Request('http://test/api/note-tag-suggestions', { method: 'POST', body: JSON.stringify({ source: '均线', tags: ['topic.ma'], supplement: '用于风险控制' }) })
it('returns an explicit unavailable response without model credentials', async () => {
  vi.stubEnv('AI_API_KEY', '')
  expect((await POST(request())).status).toBe(503)
})
it('accepts grounded suggestions and rejects fabricated quotes', async () => {
  vi.stubEnv('AI_API_KEY', 'test')
  const suggestion = { tagId: 'purpose.risk', action: 'add', quote: '风险控制', reason: '用户说明用途', conflict: '' }
  const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(Response.json({ choices: [{ message: { content: JSON.stringify({ suggestions: [suggestion] }) } }] })))
  vi.stubGlobal('fetch', fetchMock)
  expect((await POST(request())).status).toBe(200)
  suggestion.quote = '不存在的引用'
  expect((await POST(request())).status).toBe(502)
})
