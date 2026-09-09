import { migrateWorkspace, type ChartPeriod, type ChartWorkspaceV2 } from './chart-types'
import { deserializeChartWorkspace, isChartWorkspaceV2, mergeChartWorkspace, serializeChartWorkspace } from './chart-workspace-state'

const cursorKey = 'stockcal:chart-sync-cursor'
const queueKey = 'stockcal:chart-sync-queue:v2'
const journalPrefix = 'stockcal:chart-sync-mutation:v2:'
const acknowledgedPrefix = 'stockcal:chart-sync-ack:v2:'
const recoveryPrefix = 'stockcal:chart-sync-recovery:v2:'
const journalReadyKey = 'stockcal:chart-sync-journal:v2'
export const chartWorkspaceChangedEvent = 'stockcal:chart-workspace-updated'
export type ChartSyncQueueEntry = { id: string; sequence: number; workspace: ChartWorkspaceV2 }

class ChartSyncRequestError extends Error {
  constructor(readonly status: number) { super(`Chart sync request failed: ${status}`) }
}

export function chartWorkspaceEntityId(workspace: Pick<ChartWorkspaceV2, 'symbol' | 'period'>) {
  return `${workspace.symbol}:${workspace.period}`
}

const headers = (clientId?: string, authorization?: string) => ({ Accept: 'application/json', ...(clientId ? { 'X-Client-Id': clientId } : {}), ...(authorization ? { Authorization: authorization } : {}) })

export async function pushChartWorkspace(workspace: ChartWorkspaceV2, clientId: string, authorization?: string, mutationId = '') {
  const payload = JSON.parse(serializeChartWorkspace(workspace)) as Record<string, unknown>
  const response = await fetch('/api/sync/mutations', { method: 'POST', headers: { ...headers(clientId, authorization), 'Content-Type': 'application/json' }, body: JSON.stringify({ idempotencyKey: `${clientId}:chart:${chartWorkspaceEntityId(workspace)}:${workspace.revision}${mutationId ? `:${mutationId}` : ''}`, entityType: 'CHART_WORKSPACE', entityId: chartWorkspaceEntityId(workspace), operation: 'UPSERT', revision: workspace.revision, payload }) })
  if (!response.ok) throw new ChartSyncRequestError(response.status)
  const result: unknown = await response.json()
  if (!result || typeof result !== 'object' || !('applied' in result) || typeof result.applied !== 'boolean' || !('cursor' in result) || !Number.isSafeInteger(result.cursor)) throw new Error('Invalid chart sync acknowledgement')
  return result
}

/** Persist every entity before acknowledging a cursor, including inactive periods. */
export async function pullChartWorkspace(cursor: number, clientId?: string, authorization?: string) {
  const response = await fetch(`/api/sync/changes?cursor=${cursor}`, { headers: headers(clientId, authorization), cache: 'no-store' })
  if (!response.ok) throw new ChartSyncRequestError(response.status)
  const result = await response.json() as { nextCursor: number; changes: Array<{ cursor: number; entityType: string; entityId: string; operation: string; revision: number; payload?: unknown }> }
  if (!Number.isSafeInteger(result.nextCursor) || result.nextCursor < cursor || !Array.isArray(result.changes)) throw new Error('Invalid chart sync response')
  const snapshots = new Map<string, ChartWorkspaceV2>()
  for (const change of [...result.changes].sort((a, b) => a.cursor - b.cursor)) {
    if (!Number.isSafeInteger(change.cursor) || change.cursor <= cursor || change.cursor > result.nextCursor) throw new Error('Invalid chart change cursor')
    if (change.entityType !== 'CHART_WORKSPACE') continue
    if (change.operation !== 'UPSERT' || !isChartWorkspaceV2(change.payload) || chartWorkspaceEntityId(change.payload) !== change.entityId || change.payload.revision !== change.revision) throw new Error('Invalid pulled chart workspace')
    const remote = change.payload
    const local = loadChartWorkspace(remote.symbol, remote.period)
    const merged = local ? mergeChartWorkspace(local, remote) : remote
    saveChartWorkspace(merged)
    snapshots.set(change.entityId, merged)
  }
  saveChartSyncCursor(Math.max(loadChartSyncCursor(), result.nextCursor))
  return { nextCursor: result.nextCursor, snapshots: [...snapshots.values()] }
}

export function loadChartWorkspace(symbol: string, period: ChartPeriod): ChartWorkspaceV2 | null {
  if (typeof window === 'undefined') return null
  const key = chartKey(symbol, period)
  const raw = window.localStorage.getItem(key)
  if (!raw) return null
  let value: unknown
  try { value = JSON.parse(raw) } catch { return null }
  if (!value || typeof value !== 'object' || !('version' in value)) return null
  if (value.version === 2) {
    const parsed = deserializeChartWorkspace(raw)
    return parsed?.symbol === symbol && parsed.period === period ? parsed : null
  }
  if (value.version !== 1 || !('period' in value) || value.period !== period) return null
  const legacy = value as Record<string, unknown>
  if ((legacy.symbol !== undefined && legacy.symbol !== symbol) || (legacy.stockCode !== undefined && legacy.stockCode !== symbol) || (legacy.symbol === undefined && legacy.stockCode === undefined) || !Array.isArray(legacy.drawings)) return null
  const preservedSettings = Object.fromEntries(['view', 'crosshair', 'revision', 'updatedAt', 'indicators', 'indicatorConfig', 'layers'].filter((key) => legacy[key] !== undefined).map((key) => [key, legacy[key]]))
  const migrated = { ...migrateWorkspace(value), ...preservedSettings }
  if (!isChartWorkspaceV2(migrated)) return null
  const canonical = serializeChartWorkspace(migrated)
  window.localStorage.setItem(key, canonical)
  return deserializeChartWorkspace(canonical)
}

export function saveChartWorkspace(workspace: ChartWorkspaceV2) {
  if (typeof window === 'undefined') return
  const serialized = serializeChartWorkspace(workspace)
  const key = chartKey(workspace.symbol, workspace.period)
  if (window.localStorage.getItem(key) === serialized) return
  window.localStorage.setItem(key, serialized)
  window.dispatchEvent(new CustomEvent(chartWorkspaceChangedEvent, { detail: chartWorkspaceEntityId(workspace) }))
}

export function loadChartSyncCursor() {
  if (typeof window === 'undefined') return 0
  const cursor = Number(window.localStorage.getItem(cursorKey) ?? '0')
  return Number.isSafeInteger(cursor) && cursor >= 0 ? cursor : 0
}

export function saveChartSyncCursor(cursor: number) {
  if (!Number.isSafeInteger(cursor) || cursor < 0) throw new Error('Invalid chart sync cursor')
  if (typeof window !== 'undefined') window.localStorage.setItem(cursorKey, String(cursor))
}

function validEntry(value: unknown): value is ChartSyncQueueEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<ChartSyncQueueEntry>
  return typeof entry.id === 'string' && entry.id.trim().length > 0 && Number.isSafeInteger(entry.sequence) && entry.sequence! > 0 && isChartWorkspaceV2(entry.workspace)
}

function quarantine(sourceKey: string, raw: string) {
  // Store the original bytes before changing a damaged source. Never silently drop it.
  window.localStorage.setItem(`${recoveryPrefix}${crypto.randomUUID()}`, JSON.stringify({ sourceKey, raw, recoveredAt: new Date().toISOString() }))
}

export function hasChartSyncRecovery(): boolean {
  return typeof window !== 'undefined' && Object.keys(window.localStorage).some((key) => key.startsWith(recoveryPrefix))
}

function readQueueIndex(): ChartSyncQueueEntry[] {
  const raw = window.localStorage.getItem(queueKey)
  if (raw === null) return []
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { parsed = null }
  const entries: ChartSyncQueueEntry[] = []
  let damaged = !Array.isArray(parsed)
  if (Array.isArray(parsed)) parsed.forEach((value, index) => {
    const entry: unknown = value && typeof value === 'object' ? { ...value, sequence: value.sequence ?? index + 1 } : value
    if (validEntry(entry)) entries.push(entry)
    else damaged = true
  })
  if (damaged) {
    quarantine(queueKey, raw)
    window.localStorage.setItem(queueKey, JSON.stringify(entries))
  }
  return entries
}

function journalKey(id: string) { return `${journalPrefix}${encodeURIComponent(id)}` }
function acknowledgedKey(id: string) { return `${acknowledgedPrefix}${encodeURIComponent(id)}` }

function writeJournal(entry: ChartSyncQueueEntry) {
  window.localStorage.setItem(journalKey(entry.id), JSON.stringify({ id: entry.id, sequence: entry.sequence, workspace: JSON.parse(serializeChartWorkspace(entry.workspace)) }))
}

function readJournal(): ChartSyncQueueEntry[] {
  const entries: ChartSyncQueueEntry[] = []
  for (const key of Object.keys(window.localStorage).filter((key) => key.startsWith(journalPrefix))) {
    const raw = window.localStorage.getItem(key)
    if (raw === null) continue
    let entry: unknown
    try { entry = JSON.parse(raw) } catch { entry = null }
    if (!validEntry(entry) || journalKey(entry.id) !== key) {
      quarantine(key, raw)
      window.localStorage.removeItem(key)
      continue
    }
    if (!window.localStorage.getItem(acknowledgedKey(entry.id))) entries.push(entry)
  }
  // Sequence preserves observed append order without depending on wall-clock skew.
  // Truly concurrent appends may share a sequence; immutable ids break that tie.
  return entries.sort((a, b) => a.sequence - b.sequence || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

export function loadChartSyncQueue(): ChartSyncQueueEntry[] {
  if (typeof window === 'undefined') return []
  const legacy = readQueueIndex()
  if (window.localStorage.getItem(journalReadyKey) !== '1') {
    for (const entry of legacy) {
      if (!window.localStorage.getItem(journalKey(entry.id)) && !window.localStorage.getItem(acknowledgedKey(entry.id))) writeJournal(entry)
    }
    window.localStorage.setItem(journalReadyKey, '1')
  }
  return readJournal()
}

/** A rebuildable compatibility index. Concurrent stale writes cannot erase journal entries. */
function refreshQueueIndex() {
  window.localStorage.setItem(queueKey, JSON.stringify(readJournal()))
}

function acknowledge(entry: ChartSyncQueueEntry) {
  // Receipts prevent an old reader or legacy index from resurrecting an acknowledged id.
  window.localStorage.setItem(acknowledgedKey(entry.id), '1')
  window.localStorage.removeItem(journalKey(entry.id))
  refreshQueueIndex()
}

/** One independent, synchronous durable write per completed command, before networking. */
export function enqueueChartWorkspace(workspace: ChartWorkspaceV2) {
  const canonical = deserializeChartWorkspace(serializeChartWorkspace(workspace))!
  const queue = loadChartSyncQueue()
  const entry = { id: crypto.randomUUID(), sequence: (queue.at(-1)?.sequence ?? 0) + 1, workspace: canonical }
  writeJournal(entry)
  refreshQueueIndex()
  return entry
}

let replaying: Promise<void> | null = null

export function replayChartSyncQueue(clientId: string, authorization?: string): Promise<void> {
  if (replaying) return replaying
  const replay = () => replayQueue(clientId, authorization)
  // Append never waits for a lock. Only network replay is serialized across browser tabs.
  const task = async () => {
    if (typeof navigator !== 'undefined' && navigator.locks) await navigator.locks.request('stockcal:chart-sync-replay:v2', replay)
    else await replay()
  }
  replaying = task().finally(() => { replaying = null })
  return replaying
}

async function replayQueue(clientId: string, authorization?: string) {
  let entry = loadChartSyncQueue()[0]
  while (entry) {
    let conflicts = 0
    for (;;) {
      if (window.localStorage.getItem(acknowledgedKey(entry.id))) break
      try {
        await pushChartWorkspace(entry.workspace, clientId, authorization, entry.id)
        const saved = loadChartWorkspace(entry.workspace.symbol, entry.workspace.period)
        saveChartWorkspace(saved ? mergeChartWorkspace(saved, entry.workspace) : entry.workspace)
        acknowledge(entry)
        break
      } catch (error) {
        if (!(error instanceof ChartSyncRequestError) || error.status !== 409 || conflicts++ >= 3) throw error
        // Start from zero for conflict recovery: the global cursor may already have
        // acknowledged this entity's latest revision before the queued edit existed.
        await pullChartWorkspace(0, clientId, authorization)
        const latest = loadChartWorkspace(entry.workspace.symbol, entry.workspace.period)
        const merged = latest ? mergeChartWorkspace(entry.workspace, latest) : entry.workspace
        const rebased = { ...merged, revision: Math.max(entry.workspace.revision, latest?.revision ?? 0) + 1, updatedAt: new Date().toISOString() }
        // Immutable replacement attempt, at the same FIFO position. Persist it before
        // retiring the old entry; competing fallback replayers cannot erase each other.
        const replacement = { id: crypto.randomUUID(), sequence: entry.sequence, workspace: rebased }
        writeJournal(replacement)
        acknowledge(entry)
        entry = replacement
        saveChartWorkspace(rebased)
      }
    }
    entry = loadChartSyncQueue()[0]
  }
}

function chartKey(symbol: string, period: ChartPeriod) {
  return `stockcal:chart-workspace:${symbol}:${period}`
}
