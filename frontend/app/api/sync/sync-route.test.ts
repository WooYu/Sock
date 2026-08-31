import { describe, expect, test, vi } from 'vitest'
import { GET } from './changes/route'
import { POST } from './mutations/route'

const applySyncMutation = vi.hoisted(() => vi.fn(async () => ({ applied: true, cursor: 4 })))
const pullSyncChanges = vi.hoisted(() => vi.fn(async () => ({ nextCursor: 5, changes: [] })))

vi.mock('@/lib/api/backend-client', () => ({ applySyncMutation, pullSyncChanges }))

describe('sync BFF', () => {
  test('forwards client identity and mutation', async () => {
    const response = await POST(new Request('http://localhost/api/sync/mutations', {
      method: 'POST',
      headers: { 'x-client-id': 'browser-1', authorization: 'Bearer token', 'content-type': 'application/json' },
      body: JSON.stringify({ idempotencyKey: 'k1', entityType: 'trades', entityId: 't1', operation: 'UPSERT', revision: 1, payload: {} }),
    }))
    expect(response.status).toBe(200)
    expect(applySyncMutation).toHaveBeenCalledWith(expect.objectContaining({ entityId: 't1' }), 'browser-1', 'Bearer token')
  })

  test('pulls changes from a cursor', async () => {
    const response = await GET(new Request('http://localhost/api/sync/changes?cursor=4'),)
    expect(response.status).toBe(200)
    expect(pullSyncChanges).toHaveBeenCalledWith(4, undefined, undefined)
  })
})
