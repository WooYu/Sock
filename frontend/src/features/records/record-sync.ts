import { applySyncMutation, pullSyncChanges, type SyncChange } from '@/lib/api/backend-client'
import { loadRecords, saveRecords, type RecordNamespace } from './record-store'

const clientIdKey = 'stockcal:sync-client-id'
const cursorKey = 'stockcal:sync-cursor'

export async function syncRecord(namespace: RecordNamespace, record: { id: string }, operation: 'UPSERT' | 'DELETE' = 'UPSERT') {
  if (typeof window === 'undefined') return
  const clientId = getClientId()
  const authorization = getAuthorizationHeader()
  const revision = Date.now()
  await applySyncMutation({
    idempotencyKey: `${clientId}:${namespace}:${record.id}:${revision}`,
    entityType: namespace,
    entityId: record.id,
    operation,
    revision,
    payload: operation === 'DELETE' ? {} : record as unknown as Record<string, unknown>,
  }, clientId, authorization)
}

export async function pullSyncedRecords() {
  if (typeof window === 'undefined') return []
  const response = await pullSyncChanges(Number(window.localStorage.getItem(cursorKey) ?? '0'), getClientId(), getAuthorizationHeader())
  window.localStorage.setItem(cursorKey, String(response.nextCursor))
  return response.changes
}

export async function syncNow() {
  const changes = await pullSyncedRecords()
  for (const change of changes) applyChange(change)
  return changes.length
}

function applyChange(change: SyncChange) {
  if (!isRecordNamespace(change.entityType)) return
  const records = loadRecords<Record<string, unknown>>(change.entityType)
  const next = change.operation === 'DELETE'
    ? records.filter((record) => record.id !== change.entityId)
    : [...records.filter((record) => record.id !== change.entityId), { ...change.payload, id: change.entityId }]
  saveRecords(change.entityType, next)
}

function isRecordNamespace(value: string): value is RecordNamespace {
  return ['predictions', 'trades', 'reviews', 'rules', 'preferences'].includes(value)
}

export function getClientId() {
  if (typeof window === 'undefined') return ''
  const current = window.localStorage.getItem(clientIdKey)
  if (current) return current
  const generated = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  window.localStorage.setItem(clientIdKey, generated)
  return generated
}

export function getAuthorizationHeader() {
  const token = window.localStorage.getItem('stockcal.accessToken')
  return token ? `Bearer ${token}` : undefined
}
