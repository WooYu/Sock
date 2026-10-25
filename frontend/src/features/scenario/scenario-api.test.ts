import { afterEach, expect, test, vi } from 'vitest'
import { listLearningSamples, saveForecast } from './scenario-api'
import { forecastFixture } from './scenario-test-fixtures'
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear() })
test('sends exact frozen request with identity and cancellation', async () => {
  localStorage.setItem('stockcal:sync-client-id', 'device')
  localStorage.setItem('stockcal.accessToken', 'test')
  const request = { snapshot: forecastFixture().snapshot, noteBindings: [] }
  const fetcher = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => Response.json({ id: 'record' })); vi.stubGlobal('fetch', fetcher)
  const signal = new AbortController().signal
  await saveForecast(request, signal)
  const [url, init] = fetcher.mock.calls[0]
  expect(url).toBe('/api/scenario-records'); expect(init?.signal).toBe(signal)
  expect(JSON.parse(init?.body as string)).toEqual(request)
  expect(new Headers(init?.headers).get('x-client-id')).toBe('device')
  expect(new Headers(init?.headers).get('authorization')).toBe('Bearer test')
})
test('serializes false eligibility and all filters without inventing records on error', async () => {
  const fetcher = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => Response.json({ message: '后端离线' }, { status: 503 })); vi.stubGlobal('fetch', fetcher)
  await expect(listLearningSamples({ symbol: '603533', forwardEligible: false, directionConfirmed: 'unknown', noteFile: '笔记.md' }, 'cursor')).rejects.toMatchObject({ status: 503 })
  const url = new URL(fetcher.mock.calls[0][0], 'http://test')
  expect(url.searchParams.get('forwardEligible')).toBe('false'); expect(url.searchParams.get('noteFile')).toBe('笔记.md')
  expect(url.searchParams.get('cursor')).toBe('cursor')
})
