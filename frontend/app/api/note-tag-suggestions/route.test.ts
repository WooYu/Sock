// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { POST } from './route'
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
beforeEach(() => { vi.stubEnv('VERCEL', ''); vi.stubEnv('STOCKCAL_TAG_REMOTE', '') })
const request = () => new Request('http://test/api/note-tag-suggestions', { method: 'POST', body: JSON.stringify({ source: '均线', tags: ['topic.ma'], supplement: '用于风险控制' }) })
it('uses the server worker for production supplementary suggestions', async () => {
  vi.stubEnv('VERCEL', '1')
  vi.stubEnv('STOCKCAL_RECORDS_API_BASE_URL', 'https://backend.test')
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ suggestions: [] }))
  vi.stubGlobal('fetch', fetchMock)
  expect((await POST(request())).status).toBe(200)
  expect(fetchMock).toHaveBeenCalledWith(new URL('https://backend.test/api/v1/note-tag-suggestions'), expect.objectContaining({ method: 'POST' }))
})
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
