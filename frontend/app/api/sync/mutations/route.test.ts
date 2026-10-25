// @vitest-environment node
import { afterEach, expect, test, vi } from 'vitest'
import { POST } from './route'

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

test.each(['', '{"entityType":'])('rejects an empty or interrupted sync body without reaching the backend: %j', async body => {
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  const response = await POST(new Request('http://localhost/api/sync/mutations', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
  }))
  expect(response.status).toBe(400)
  expect(await response.json()).toEqual({ message: '同步变更格式不正确' })
  expect(fetcher).not.toHaveBeenCalled()
})

test('still forwards a valid mutation and its device identity', async () => {
  vi.stubEnv('STOCKCAL_API_BASE_URL', 'http://backend.example')
  const receipt = { applied: true, cursor: 7 }
  const fetcher = vi.fn(async () => Response.json(receipt))
  vi.stubGlobal('fetch', fetcher)
  const mutation = { idempotencyKey: 'phone-save', entityType: 'SHARED_DATA', entityId: 'stockcal:trades', operation: 'UPSERT', revision: 1, payload: { raw: '[]' } }
  const response = await POST(new Request('http://localhost/api/sync/mutations', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Client-Id': 'phone-device' }, body: JSON.stringify(mutation),
  }))
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual(receipt)
  expect(fetcher).toHaveBeenCalledWith('http://backend.example/api/v1/sync/mutations', expect.objectContaining({
    method: 'POST', body: JSON.stringify(mutation), headers: expect.objectContaining({ 'X-Client-Id': 'phone-device' }),
  }))
})
