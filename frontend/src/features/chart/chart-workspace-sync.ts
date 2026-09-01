import { applySyncMutation, pullSyncChanges } from '@/lib/api/backend-client'
import { deserializeChartWorkspace, serializeChartWorkspace, type ChartWorkspaceSnapshot } from './chart-workspace-state'

const cursorKey = 'stockcal:chart-sync-cursor'

export function chartWorkspaceEntityId(snapshot: Pick<ChartWorkspaceSnapshot, 'stockCode' | 'period'>) {
  return `${snapshot.stockCode}:${snapshot.period}`
}

export async function pushChartWorkspace(snapshot: ChartWorkspaceSnapshot, clientId: string, authorization?: string) {
  return applySyncMutation({
    idempotencyKey: `${clientId}:chart:${chartWorkspaceEntityId(snapshot)}:${snapshot.revision}`,
    entityType: 'CHART_WORKSPACE',
    entityId: chartWorkspaceEntityId(snapshot),
    operation: 'UPSERT',
    revision: snapshot.revision,
    payload: snapshot as unknown as Record<string, unknown>,
  }, clientId, authorization)
}

export async function pullChartWorkspace(cursor: number, clientId?: string, authorization?: string) {
  const response = await pullSyncChanges(cursor, clientId, authorization)
  return {
    nextCursor: response.nextCursor,
    snapshots: response.changes
      .filter((change) => change.entityType === 'CHART_WORKSPACE' && change.operation === 'UPSERT' && change.payload)
      .map((change) => deserializeChartWorkspace(JSON.stringify(change.payload)))
      .filter((snapshot): snapshot is ChartWorkspaceSnapshot => snapshot !== null),
  }
}

export function loadChartWorkspace(stockCode: string, period: ChartWorkspaceSnapshot['period']) {
  if (typeof window === 'undefined') return null
  return deserializeChartWorkspace(window.localStorage.getItem(chartKey(stockCode, period)) ?? '')
}

export function saveChartWorkspace(snapshot: ChartWorkspaceSnapshot) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(chartKey(snapshot.stockCode, snapshot.period), serializeChartWorkspace(snapshot))
}

export function loadChartSyncCursor() {
  if (typeof window === 'undefined') return 0
  return Number(window.localStorage.getItem(cursorKey) ?? '0') || 0
}

export function saveChartSyncCursor(cursor: number) {
  if (typeof window !== 'undefined') window.localStorage.setItem(cursorKey, String(cursor))
}

function chartKey(stockCode: string, period: ChartWorkspaceSnapshot['period']) {
  return `stockcal:chart-workspace:${stockCode}:${period}`
}
