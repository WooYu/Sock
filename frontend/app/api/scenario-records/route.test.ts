// @vitest-environment node
import { afterEach, expect, test, vi } from 'vitest'
import { GET, POST } from './route'
import catalog from '@/features/knowledge/note-tag-catalog.json'
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
test('rejects malformed JSON before contacting backend', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
  const response = await POST(new Request('http://test/api/scenario-records', { method: 'POST', body: '{bad' }))
  expect(response.status).toBe(400); expect(fetcher).not.toHaveBeenCalled()
})
test('imports the exact legacy version using verified source text and leaves forecast request unchanged', async () => {
  vi.stubEnv('STOCKCAL_RECORDS_API_BASE_URL', 'http://records.test')
  const old = catalog.documents[0]
  const binding = { revisionId: null, sourceHash: old.sourceHash, legacyKey: { legacyRecordId: old.id, level: old.level, sourceHash: old.sourceHash, tagVersion: old.version, channel: 'legacy' }, inlineVersion: old }
  const request = { snapshot: {}, noteBindings: [binding] }
  const bodies: Array<{ path: string; body: Record<string, unknown> }> = []
  vi.stubGlobal('fetch', vi.fn(async (path: string, init?: RequestInit) => { bodies.push({ path, body: JSON.parse(init!.body as string) }); return Response.json({ id: 'saved' }) }))
  const response = await POST(new Request('http://test/api/scenario-records', { method: 'POST', body: JSON.stringify(request) }))
  expect(response.status).toBe(200); expect(bodies).toHaveLength(2)
  expect(bodies[0].path).toMatch(/\/api\/v1\/note-studies$/)
  expect(bodies[0].body.payload).toEqual(old); expect(bodies[0].body.sourceHash).toBe(old.sourceHash)
  expect(bodies[1].body).toEqual(request)
})
test('reports unconfigured record channel and preserves backend conflicts', async () => {
  vi.stubEnv('STOCKCAL_RECORDS_API_BASE_URL', ''); vi.stubEnv('STOCKCAL_API_BASE_URL', '')
  expect((await GET(new Request('http://test/api/scenario-records'))).status).toBe(503)
  vi.stubEnv('STOCKCAL_RECORDS_API_BASE_URL', 'http://records.test')
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ message: 'same version conflict' }, { status: 409 })))
  const response = await POST(new Request('http://test/api/scenario-records', { method: 'POST', body: JSON.stringify({ snapshot: {}, noteBindings: [] }) }))
  expect(response.status).toBe(409); expect(await response.json()).toEqual({ message: 'same version conflict' })
})
