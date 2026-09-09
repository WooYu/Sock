import type { ChartWorkspaceV2, DrawingObject } from './chart-types'

export function drawingFixture(patch: Partial<DrawingObject> = {}): DrawingObject {
  return { id: 'line-1', symbol: '600519', period: 'day', kind: 'horizontal-line', points: [{ time: '2026-09-07', price: 100 }], style: { color: '#ef4444', width: 2, lineStyle: 'solid', opacity: 1 }, locked: false, visible: true, version: 1, updatedAt: '2026-09-07T00:00:00Z', ...patch }
}

export function workspaceFixture(patch: Partial<ChartWorkspaceV2> = {}): ChartWorkspaceV2 {
  return { version: 2, symbol: '600519', period: 'day', drawings: [], deletions: [], recovery: [], indicators: { ma5: true }, indicatorConfig: {}, layers: { annotations: true, keyLevels: true }, view: { zoom: 100, panX: 0, panY: 0 }, crosshair: false, updatedAt: '2026-09-07T00:00:00Z', revision: 1, ...patch }
}
