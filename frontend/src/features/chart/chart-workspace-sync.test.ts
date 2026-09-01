import { beforeEach, describe, expect, test, vi } from 'vitest'
import { pullChartWorkspace, pushChartWorkspace } from './chart-workspace-sync'
import type { ChartWorkspaceSnapshot } from './chart-workspace-state'

const applySyncMutation = vi.hoisted(() => vi.fn(async () => ({ applied: true, cursor: 7 })))
const pullSyncChanges = vi.hoisted(() => vi.fn(async () => ({ nextCursor: 8, changes: [{ cursor: 8, entityType: 'CHART_WORKSPACE', entityId: '600519:day', operation: 'UPSERT', revision: 4, idempotencyKey: 'remote', changedAt: '2026-09-01T11:00:00Z', payload: { version: 1, stockCode: '600519', period: 'day', drawings: [], indicators: {}, indicatorConfig: {}, layers: {}, view: { zoom: 100, panX: 0, panY: 0 }, crosshair: false, updatedAt: '2026-09-01T11:00:00Z', revision: 4 } }] })))
vi.mock('@/lib/api/backend-client', () => ({ applySyncMutation, pullSyncChanges }))

const snapshot: ChartWorkspaceSnapshot = { version: 1, stockCode: '600519', period: 'day', drawings: [], indicators: { ma5: true }, indicatorConfig: {}, layers: {}, view: { zoom: 100, panX: 0, panY: 0 }, crosshair: false, updatedAt: '2026-09-01T10:00:00Z', revision: 3 }

describe('chart workspace sync', () => {
  beforeEach(() => vi.clearAllMocks())

  test('uploads the complete workspace under a stable entity', async () => {
    await pushChartWorkspace(snapshot, 'browser-1', 'Bearer token')
    expect(applySyncMutation).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'CHART_WORKSPACE', entityId: '600519:day', revision: 3, payload: snapshot }), 'browser-1', 'Bearer token')
  })

  test('pulls only chart workspace changes and advances the cursor', async () => {
    const result = await pullChartWorkspace(7, 'browser-1', 'Bearer token')
    expect(result.nextCursor).toBe(8)
    expect(result.snapshots).toHaveLength(1)
    expect(result.snapshots[0].stockCode).toBe('600519')
  })
})
