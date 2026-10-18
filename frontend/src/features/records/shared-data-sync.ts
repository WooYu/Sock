import { getAuthorizationHeader, getClientId } from './record-sync'

const stateKey = 'stockcal:shared-sync:v1'
const fixed = new Set(['stockcal:research-list:v1', 'stockcal.knowledge.v1', 'stockcal.note-tags.v1', 'stockcal.scenario-analysis.v1', 'stockcal.note-study-selections.v1', 'stockcal.scenario-cloud.v1', ...['predictions', 'trades', 'reviews', 'rules', 'preferences'].map(n => 'stockcal:' + n)])
export const isSharedDataKey = (key: string) => fixed.has(key) || key.startsWith('stockcal.research-journal.v1:') || key.startsWith('stockcal.indicator-audit.v1:')
type Pending = { raw: string | null; id: string; revision: number }
type State = { cursor: number; observed: Record<string, string | null>; pending: Record<string, Pending> }

/** Versioned records are append-only. Mutable fields use the last accepted save. */
export function mergeSharedData(remote: unknown, local: unknown): unknown {
  if (Array.isArray(remote) && Array.isArray(local)) {
    const values = new Map<string, unknown>()
    for (const value of [...remote, ...local]) {
      const item = value as Record<string, unknown>
      values.set(String(item.id ?? item.origin ?? item.revisionId ?? JSON.stringify(item)) + '@' + String(item.version ?? ''), value)
    }
    return [...values.values()]
  }
  if (remote && local && typeof remote === 'object' && typeof local === 'object' && !Array.isArray(remote) && !Array.isArray(local)) {
    const result = { ...remote, ...local } as Record<string, unknown>
    for (const key of Object.keys(result)) {
      const a = (remote as Record<string, unknown>)[key], b = (local as Record<string, unknown>)[key]
      if (key === 'records' && Array.isArray(a) && Array.isArray(b)) {
        const records = new Map<string, unknown>()
        for (const item of [...a, ...b]) {
          const r = item as Record<string, unknown>
          records.set(String(r.id) + '@' + String(r.version ?? '') + '@' + String(r.level ?? '') + '@' + String(r.sourceHash ?? ''), item)
        }
        result[key] = [...records.values()]
      } else if (key === 'scopes' && a && b && typeof a === 'object' && typeof b === 'object') {
        const scopes = { ...a, ...b } as Record<string, unknown>
        for (const scope of Object.keys(scopes)) scopes[scope] = mergeSharedData((a as Record<string, unknown>)[scope], (b as Record<string, unknown>)[scope] ?? (a as Record<string, unknown>)[scope])
        result[key] = scopes
      }
    }
    return result
  }
  return local
}

export class SharedDataSync {
  private state: State
  private running = false
  constructor(private storage: Storage, private request: typeof fetch = fetch) {
    const raw = storage.getItem(stateKey)
    this.state = raw ? JSON.parse(raw) as State : { cursor: 0, observed: {}, pending: {} }
    if (!Number.isSafeInteger(this.state.cursor) || !this.state.observed || !this.state.pending) throw new Error('共享同步记录损坏，原值已保留')
  }
  private persist() { this.storage.setItem(stateKey, JSON.stringify(this.state)) }
  capture = () => {
    const keys = new Set([...Object.keys(this.state.observed), ...Object.keys(this.storage).filter(isSharedDataKey)])
    for (const key of keys) {
      const raw = this.storage.getItem(key)
      if (raw === this.state.observed[key]) continue
      if (raw !== null) { try { JSON.parse(raw) } catch { continue } }
      this.state.pending[key] = { raw, id: crypto.randomUUID(), revision: Date.now() }
      this.state.observed[key] = raw
    }
    this.persist()
  }
  async sync() {
    if (this.running) return
    this.running = true
    try {
      const run = async () => {
        const latest = this.storage.getItem(stateKey)
        if (latest) this.state = JSON.parse(latest) as State
        await this.syncData()
      }
      if (navigator.locks) await navigator.locks.request('stockcal:shared-data-sync', run)
      else await run()
    } finally { this.running = false }
  }
  private async syncData() {
    this.capture()
    if (!navigator.onLine) { window.dispatchEvent(new CustomEvent('stockcal:shared-sync-status', { detail: '离线 · 联网后自动同步' })); return }
    const authorization = getAuthorizationHeader()
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-Client-Id': getClientId(), ...(authorization ? { Authorization: authorization } : {}) }
    const response = await this.request('/api/sync/changes?cursor=' + this.state.cursor, { headers, cache: 'no-store', signal: AbortSignal.timeout(15000) })
    if (!response.ok) throw new Error('共享读取失败')
    const data = await response.json() as { nextCursor: number; changes: { entityType: string; entityId: string; revision: number; operation: string; payload: { raw?: string } }[] }
    if (!Number.isSafeInteger(data.nextCursor) || data.nextCursor < this.state.cursor || !Array.isArray(data.changes)) throw new Error('共享响应无效')
    // Capture edits made while the network request was in flight.
    this.capture()
    for (const change of data.changes) {
      if (['predictions', 'trades', 'reviews', 'rules', 'preferences'].includes(change.entityType)) {
        const legacyKey = 'stockcal:' + change.entityType
        const records = JSON.parse(this.storage.getItem(legacyKey) ?? '[]') as Record<string, unknown>[]
        const next = records.filter(record => record.id !== change.entityId)
        if (change.operation !== 'DELETE') next.push({ ...change.payload, id: change.entityId })
        const raw = JSON.stringify(next)
        this.storage.setItem(legacyKey, raw)
        this.state.observed[legacyKey] = raw
        if (this.state.pending[legacyKey]) this.state.pending[legacyKey] = { raw, id: crypto.randomUUID(), revision: Date.now() }
        window.dispatchEvent(new StorageEvent('storage', { key: legacyKey }))
        continue
      }
      if (change.entityType !== 'SHARED_DATA' || !isSharedDataKey(change.entityId)) continue
      const key = change.entityId, pending = this.state.pending[key]
      const remote = change.operation === 'DELETE' ? null : change.payload.raw
      if (remote === undefined) throw new Error('共享内容无效')
      if (pending) {
        if (remote !== null && pending.raw !== null) pending.raw = JSON.stringify(mergeSharedData(JSON.parse(remote), JSON.parse(pending.raw)))
        // A changed body must receive a fresh idempotency key after a lost acknowledgement.
        pending.id = crypto.randomUUID()
        pending.revision = Math.max(pending.revision, change.revision + 1)
      }
      const next = pending ? pending.raw : remote
      if (next !== this.storage.getItem(key)) {
        if (next === null) this.storage.removeItem(key); else this.storage.setItem(key, next)
        window.dispatchEvent(new StorageEvent('storage', { key, newValue: next }))
      }
      this.state.observed[key] = next
    }
    this.state.cursor = data.nextCursor
    this.persist()
    for (const [key, pending] of Object.entries(this.state.pending)) {
      const sent = { ...pending }
      const result = await this.request('/api/sync/mutations', { method: 'POST', headers, signal: AbortSignal.timeout(15000), body: JSON.stringify({ idempotencyKey: sent.id, entityType: 'SHARED_DATA', entityId: key, operation: sent.raw === null ? 'DELETE' : 'UPSERT', revision: sent.revision, payload: sent.raw === null ? {} : { raw: sent.raw } }) })
      if (!result.ok) throw new Error(result.status === 409 ? '数据已更新，正在重新合并' : '共享保存失败')
      // Persist the receipt before continuing. New edits are captured next round.
      delete this.state.pending[key]
      this.persist()
    }
    window.dispatchEvent(new CustomEvent('stockcal:shared-sync-status', { detail: '已同步 · 所有账号共享' }))
  }
}
