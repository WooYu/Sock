export type ChartWorkspaceDrawing = {
  id: string
  kind: string
  start: { x: number; y: number }
  end?: { x: number; y: number }
  text?: string
  hidden?: boolean
  updatedAt?: string
}

export type ChartWorkspaceSnapshot = {
  version: 1
  stockCode: string
  period: 'day' | 'week' | 'month'
  drawings: ChartWorkspaceDrawing[]
  indicators: Record<string, boolean>
  indicatorConfig: Record<string, unknown>
  layers: Record<string, boolean>
  view: { zoom: number; panX: number; panY: number }
  crosshair: boolean
  updatedAt: string
  revision: number
}

export function serializeChartWorkspace(snapshot: ChartWorkspaceSnapshot) {
  return JSON.stringify(snapshot)
}

export function deserializeChartWorkspace(raw: string): ChartWorkspaceSnapshot | null {
  try {
    const value = JSON.parse(raw) as ChartWorkspaceSnapshot
    if (value?.version !== 1 || !value.stockCode || !Array.isArray(value.drawings)) return null
    return value
  } catch {
    return null
  }
}

export function mergeChartWorkspace(local: ChartWorkspaceSnapshot, remote: ChartWorkspaceSnapshot): ChartWorkspaceSnapshot {
  const drawings = new Map(local.drawings.map((drawing) => [drawing.id, drawing]))
  for (const drawing of remote.drawings) {
    const current = drawings.get(drawing.id)
    if (!current || (drawing.updatedAt ?? remote.updatedAt) >= (current.updatedAt ?? local.updatedAt)) drawings.set(drawing.id, drawing)
  }
  return {
    ...local,
    ...remote,
    drawings: [...drawings.values()],
    revision: Math.max(local.revision, remote.revision),
  }
}
