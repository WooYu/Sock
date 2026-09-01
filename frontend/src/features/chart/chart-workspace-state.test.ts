import { describe, expect, test } from 'vitest'
import { deserializeChartWorkspace, mergeChartWorkspace, serializeChartWorkspace, type ChartWorkspaceSnapshot } from './chart-workspace-state'

const local: ChartWorkspaceSnapshot = {
  version: 1,
  stockCode: '600519',
  period: 'day',
  drawings: [{ id: 'local', kind: 'marker', start: { x: 10, y: 20 }, updatedAt: '2026-09-01T10:00:00Z' }],
  indicators: { ma5: true },
  indicatorConfig: { bollPeriod: 20 },
  layers: { annotations: true },
  view: { zoom: 110, panX: 0, panY: 0 },
  crosshair: false,
  updatedAt: '2026-09-01T10:00:00Z',
  revision: 2,
}

describe('chart workspace state', () => {
  test('round trips the complete workspace', () => {
    expect(deserializeChartWorkspace(serializeChartWorkspace(local))).toEqual(local)
  })

  test('merges drawings by id and keeps newer remote settings', () => {
    const remote = { ...local, drawings: [...local.drawings, { id: 'remote', kind: 'target' as const, start: { x: 2, y: 3 }, updatedAt: '2026-09-01T11:00:00Z' }], view: { zoom: 120, panX: 4, panY: 0 }, updatedAt: '2026-09-01T11:00:00Z', revision: 3 }
    const merged = mergeChartWorkspace(local, remote)
    expect(merged.drawings.map((drawing) => drawing.id)).toEqual(['local', 'remote'])
    expect(merged.view.zoom).toBe(120)
  })
})
