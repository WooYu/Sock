import { beforeEach, expect, test, vi } from 'vitest'
import { isSharedDataKey, SharedDataSync } from './shared-data-sync'

function memoryStorage(): Storage {
  const data: Record<string, string> = {}
  return new Proxy(data, { get: (target, key) => key === 'getItem' ? (k: string) => target[k] ?? null : key === 'setItem' ? (k: string, v: string) => { target[k] = v } : key === 'removeItem' ? (k: string) => { delete target[k] } : target[key as string] }) as unknown as Storage
}
beforeEach(() => localStorage.clear())
test('shares edits and merges frozen records across independent devices, retaining offline work', async () => {
  const log: Array<Record<string, unknown>> = []
  let offline = false
  const request = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    if (offline) throw Error('offline')
    if (String(url).includes('changes')) {
      const cursor = Number(String(url).split('cursor=')[1])
      return Response.json({ nextCursor: log.length, changes: log.slice(cursor) })
    }
    const body = JSON.parse(String(init?.body))
    log.push({ ...body, cursor: log.length + 1 })
    return Response.json({ applied: true, cursor: log.length })
  }) as unknown as typeof fetch
  const a = memoryStorage(), b = memoryStorage(), key = 'stockcal.research-journal.v1:600519'
  const first = new SharedDataSync(a, request), second = new SharedDataSync(b, request)
  a.setItem(key, JSON.stringify({ schemaVersion: 1, stage: '研究中', records: [{ id: 'a', judgment: 'first' }] }))
  await first.sync(); await second.sync()
  expect(JSON.parse(b.getItem(key)!).stage).toBe('研究中')
  b.setItem(key, JSON.stringify({ schemaVersion: 1, stage: '待验证', records: [{ id: 'a' }, { id: 'b' }] }))
  offline = true
  await expect(second.sync()).rejects.toThrow('offline')
  expect(b.getItem('stockcal:shared-sync:v1')).toContain('pending')
  offline = false
  a.setItem(key, JSON.stringify({ schemaVersion: 1, stage: '研究中', records: [{ id: 'a' }, { id: 'c' }] }))
  await first.sync()
  await second.sync(); await first.sync()
  expect(JSON.parse(a.getItem(key)!).stage).toBe('待验证')
  expect(JSON.parse(a.getItem(key)!).records.map((r: { id: string }) => r.id)).toEqual(['a', 'c', 'b'])
})
test('never shares credentials, client identity or market caches', () => {
  for (const key of ['stockcal.accessToken', 'stockcal.refreshToken', 'stockcal:sync-client-id', 'stockcal:shared-sync:v1', 'stockcal:market-history:v1']) expect(isSharedDataKey(key)).toBe(false)
})

test('binds the native browser fetch receiver for background sync', async () => {
  vi.stubGlobal('fetch', function (this: unknown) {
    expect(this).toBe(globalThis)
    return Promise.resolve(Response.json({ nextCursor: 0, changes: [] }))
  })
  try { await new SharedDataSync(memoryStorage()).sync() }
  finally { vi.unstubAllGlobals() }
})
