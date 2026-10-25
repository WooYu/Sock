// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import catalog from '@/features/knowledge/note-tag-catalog.json'
import { getProposal } from '@/lib/knowledge/note-study-proposals'
import { extractNoteTags } from '@/lib/knowledge/note-tag-extraction'
import { POST } from './route'

vi.mock('@/lib/knowledge/note-tag-extraction', () => ({ extractNoteTags: vi.fn() }))
const record = catalog.documents[0]
const request = (input: unknown) => new Request('http://test/api/note-tag-extraction', { method: 'POST', body: JSON.stringify(input) })
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('VERCEL', ''); vi.stubEnv('STOCKCAL_TAG_REMOTE', '') })
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
it('forwards production requests to the backend instead of spawning a local CLI', async () => {
  vi.stubEnv('VERCEL', '1')
  vi.stubEnv('STOCKCAL_RECORDS_API_BASE_URL', 'https://backend.test')
  const upstream = { id: record.id, sourceHash: record.sourceHash, candidate: null, models: [] }
  const fetchMock = vi.fn().mockResolvedValue(Response.json(upstream))
  vi.stubGlobal('fetch', fetchMock)
  const response = await POST(request(record))
  expect(await response.json()).toEqual(upstream)
  expect(fetchMock).toHaveBeenCalledWith(new URL('https://backend.test/api/v1/note-tag-extraction'), expect.objectContaining({ body: JSON.stringify({ id: record.id, sourceHash: record.sourceHash }) }))
  expect(extractNoteTags).not.toHaveBeenCalled()
})
it('rejects fragments, unknown notes and stale source versions before invoking models', async () => {
  expect((await POST(request({ id: '../secrets', sourceHash: record.sourceHash }))).status).toBe(404)
  expect((await POST(request({ id: record.id, sourceHash: 'stale' }))).status).toBe(409)
  expect((await POST(request({ id: catalog.fragments[0].id, sourceHash: catalog.fragments[0].sourceHash }))).status).toBe(404)
  expect(extractNoteTags).not.toHaveBeenCalled()
})
it('uses authoritative complete text and ignores client-supplied source and labels', async () => {
  vi.mocked(extractNoteTags).mockResolvedValue({ id: record.id, sourceHash: record.sourceHash, models: [], candidate: null })
  const response = await POST(request({ id: record.id, sourceHash: record.sourceHash, source: '伪造原文', tags: ['topic.ma'] }))
  expect(response.status).toBe(200)
  expect(extractNoteTags).toHaveBeenCalledWith(record, getProposal(record.file)!.sourceText)
})
it('coalesces duplicate requests for the same source version', async () => {
  let finish!: () => void
  vi.mocked(extractNoteTags).mockImplementation(() => new Promise(resolve => { finish = () => resolve({ id: record.id, sourceHash: record.sourceHash, models: [], candidate: null }) }))
  const first = POST(request(record)), second = POST(request(record))
  await vi.waitFor(() => expect(extractNoteTags).toHaveBeenCalledTimes(1))
  finish()
  expect((await first).status).toBe(200)
  expect((await second).status).toBe(200)
})
