import { migrateWorkspace, type ChartPeriod, type ChartWorkspaceV2 } from './chart-types'
import { deserializeChartWorkspace, isChartWorkspaceV2, mergeChartWorkspace, serializeChartWorkspace } from './chart-workspace-state'

const cursorKey = 'stockcal:chart-sync-cursor'
const queueKey = 'stockcal:chart-sync-queue:v2'
export const chartWorkspaceChangedEvent = 'stockcal:chart-workspace-updated'
export type ChartSyncQueueEntry = { id: string; workspace: ChartWorkspaceV2 }

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

export function loadChartSyncQueue(): ChartSyncQueueEntry[] {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(queueKey)
  if (!raw) return []
  const values: unknown = JSON.parse(raw)
  if (!Array.isArray(values) || !values.every((entry) => entry && typeof entry.id === 'string' && entry.id.length > 0 && isChartWorkspaceV2(entry.workspace))) throw new Error('Invalid durable chart sync queue')
  return values as ChartSyncQueueEntry[]
}

function saveQueue(entries: ChartSyncQueueEntry[]) {
  window.localStorage.setItem(queueKey, JSON.stringify(entries.map((entry) => ({ id: entry.id, workspace: JSON.parse(serializeChartWorkspace(entry.workspace)) }))))
}

/** The queue is written before network scheduling; unmount never owns its lifetime. */
export function enqueueChartWorkspace(workspace: ChartWorkspaceV2) {
  const canonical = deserializeChartWorkspace(serializeChartWorkspace(workspace))!
  const entry = { id: crypto.randomUUID(), workspace: canonical }
  saveQueue([...loadChartSyncQueue(), entry])
  return entry
}

let replaying: Promise<void> | null = null

export function replayChartSyncQueue(clientId: string, authorization?: string): Promise<void> {
  if (replaying) return replaying
  replaying = replayQueue(clientId, authorization).finally(() => { replaying = null })
  return replaying
}

async function replayQueue(clientId: string, authorization?: string) {
  let entry = loadChartSyncQueue()[0]
  while (entry) {
    let conflicts = 0
    for (;;) {
      try {
        await pushChartWorkspace(entry.workspace, clientId, authorization, entry.id)
        const saved = loadChartWorkspace(entry.workspace.symbol, entry.workspace.period)
        saveChartWorkspace(saved ? mergeChartWorkspace(saved, entry.workspace) : entry.workspace)
        const queue = loadChartSyncQueue()
        if (queue[0]?.id !== entry.id) throw new Error('Chart sync queue head changed during replay')
        saveQueue(queue.slice(1))
        break
      } catch (error) {
        if (!(error instanceof ChartSyncRequestError) || error.status !== 409 || conflicts++ >= 3) throw error
        // Start from zero for conflict recovery: the global cursor may already have
        // acknowledged this entity's latest revision before the queued edit existed.
        await pullChartWorkspace(0, clientId, authorization)
        const latest = loadChartWorkspace(entry.workspace.symbol, entry.workspace.period)
        const merged = latest ? mergeChartWorkspace(entry.workspace, latest) : entry.workspace
        const rebased = { ...merged, revision: Math.max(entry.workspace.revision, latest?.revision ?? 0) + 1, updatedAt: new Date().toISOString() }
        entry = { ...entry, workspace: rebased }
        const queue = loadChartSyncQueue()
        if (queue[0]?.id !== entry.id) throw new Error('Chart sync queue head changed during recovery')
        saveQueue([entry, ...queue.slice(1)])
        saveChartWorkspace(rebased)
      }
    }
    entry = loadChartSyncQueue()[0]
  }
}

function chartKey(symbol: string, period: ChartPeriod) {
  return `stockcal:chart-workspace:${symbol}:${period}`
}
