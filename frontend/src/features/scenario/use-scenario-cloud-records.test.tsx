import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useScenarioCloudRecords, CLOUD_RECORDS_STORAGE_KEY, cloudRecordKey } from './use-scenario-cloud-records'
import { researchRecord, researchSnapshot } from './scenario-research-test-fixtures'

beforeEach(() => { localStorage.clear(); localStorage.setItem('stockcal:sync-client-id', 'device') })
afterEach(() => vi.unstubAllGlobals())
test('only server acknowledgement marks stored and duplicate clicks reuse the request', async () => {
  const snapshot = researchSnapshot(); let resolve!: (value: Response) => void
  const fetcher = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(() => new Promise<Response>(done => { resolve = done })); vi.stubGlobal('fetch', fetcher)
  const { result } = renderHook(() => useScenarioCloudRecords({ symbol: '603533', localRecords: [snapshot] }))
  await waitFor(() => expect(result.current.ready).toBe(true))
  let first!: Promise<void>; let second!: Promise<void>
  act(() => { first = result.current.saveFrozen(snapshot, []); second = result.current.saveFrozen(snapshot, []) })
  const key = cloudRecordKey(snapshot)
  await waitFor(() => expect(result.current.entries[key]?.status).toBe('pending'))
  expect(result.current.entries[key].receipt).toBeUndefined(); expect(fetcher).toHaveBeenCalledTimes(1)
  await act(async () => { resolve(Response.json(researchRecord(snapshot))); await Promise.all([first, second]) })
  expect(result.current.entries[key].status).toBe('stored')
  expect(result.current.entries[key].receipt?.serverReceivedAt).toBe('2026-10-16T08:00:00Z')
})
test('failed retry sends original immutable snapshot and restores receipt after remount', async () => {
  const snapshot = researchSnapshot(); let online = false
  const sent: unknown[] = []
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => { sent.push(JSON.parse(init!.body as string)); return online ? Response.json(researchRecord(snapshot)) : Response.json({ message: 'offline' }, { status: 503 }) }))
  const first = renderHook(() => useScenarioCloudRecords({ symbol: '603533', localRecords: [snapshot] }))
  await waitFor(() => expect(first.result.current.ready).toBe(true))
  await act(() => first.result.current.saveFrozen(snapshot, []))
  expect(first.result.current.entries[cloudRecordKey(snapshot)].status).toBe('retry'); first.unmount()
  const second = renderHook(() => useScenarioCloudRecords({ symbol: '603533', localRecords: [snapshot] }))
  await waitFor(() => expect(second.result.current.ready).toBe(true)); online = true
  await act(() => second.result.current.retry(snapshot.id, snapshot.version))
  expect(sent[1]).toEqual(sent[0]); expect(second.result.current.entries[cloudRecordKey(snapshot)].status).toBe('stored')
})
test('late response after identity switch cannot mark the new identity stored or persist its token', async () => {
  localStorage.setItem('stockcal.accessToken', 'secret-token-A')
  const snapshot = researchSnapshot(); let resolve!: (value: Response) => void
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(done => { resolve = done })))
  const { result } = renderHook(() => useScenarioCloudRecords({ symbol: '603533', localRecords: [snapshot] }))
  await waitFor(() => expect(result.current.ready).toBe(true)); let saving!: Promise<void>
  act(() => { saving = result.current.saveFrozen(snapshot, []) })
  await waitFor(() => expect(result.current.entries[cloudRecordKey(snapshot)]?.status).toBe('pending'))
  act(() => { localStorage.setItem('stockcal.accessToken', 'secret-token-B'); window.dispatchEvent(new Event('stockcal:identity-change')) })
  await waitFor(() => expect(result.current.entries[cloudRecordKey(snapshot)]?.status).toBe('retry'))
  await act(async () => { resolve(Response.json(researchRecord(snapshot))); await saving })
  expect(result.current.entries[cloudRecordKey(snapshot)]?.status).toBe('retry')
  expect(localStorage.getItem(CLOUD_RECORDS_STORAGE_KEY)).not.toContain('secret-token')
})
test('rejects acknowledgement that belongs to another snapshot', async () => {
  const snapshot = researchSnapshot()
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ...researchRecord(snapshot), clientRecordId: 'foreign' })))
  const { result } = renderHook(() => useScenarioCloudRecords({ symbol: '603533', localRecords: [snapshot] }))
  await waitFor(() => expect(result.current.ready).toBe(true)); await act(() => result.current.saveFrozen(snapshot, []))
  expect(result.current.entries[cloudRecordKey(snapshot)].status).toBe('retry')
})
