// @vitest-environment node
import { afterEach, expect, test, vi } from 'vitest'
import { researchRequest } from './research-backend-client'
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
test('uses independent record address and only forwards identity headers', async () => {
  vi.stubEnv('STOCKCAL_RECORDS_API_BASE_URL', 'http://records.test:8080')
  vi.stubEnv('STOCKCAL_API_BASE_URL', '')
  const fetcher = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => Response.json({ ok: true })); vi.stubGlobal('fetch', fetcher)
  const result = await researchRequest('/api/v1/scenario-records', {}, new Headers({ 'x-client-id': 'device', authorization: 'Bearer test', cookie: 'private' }))
  expect(result).toEqual({ ok: true })
  expect(fetcher.mock.calls[0][0]).toBe('http://records.test:8080/api/v1/scenario-records')
  const init = fetcher.mock.calls[0][1] as RequestInit
  expect(new Headers(init.headers).get('x-client-id')).toBe('device')
  expect(new Headers(init.headers).get('authorization')).toBe('Bearer test')
  expect(new Headers(init.headers).has('cookie')).toBe(false)
  expect(init.cache).toBe('no-store'); expect(process.env.STOCKCAL_API_BASE_URL).toBe('')
})
test('falls back to old backend and reports missing configuration explicitly', async () => {
  vi.stubEnv('STOCKCAL_RECORDS_API_BASE_URL', '')
  vi.stubEnv('STOCKCAL_API_BASE_URL', 'http://old.test')
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ok: true })))
  await expect(researchRequest('/api/v1/note-studies')).resolves.toEqual({ ok: true })
  vi.stubEnv('STOCKCAL_API_BASE_URL', '')
  await expect(researchRequest('/api/v1/note-studies')).rejects.toMatchObject({ status: 503 })
})
test.each([401,409])('preserves backend status %i', async status => {
  vi.stubEnv('STOCKCAL_RECORDS_API_BASE_URL', 'http://records.test')
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ message: 'conflict' }, { status })))
  await expect(researchRequest('/api/v1/scenario-records')).rejects.toMatchObject({ status, body: { message: 'conflict' } })
})
test('rejects arbitrary upstream paths', async () => {
  vi.stubEnv('STOCKCAL_RECORDS_API_BASE_URL', 'http://records.test')
  await expect(researchRequest('https://foreign.test')).rejects.toThrow()
})
