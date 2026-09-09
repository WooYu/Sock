import type { ChartPeriod, ChartWorkspaceV2, DrawingObject, DrawingRecoveryRecord, DrawingTombstone } from './chart-types'

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const natural = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const period = (value: unknown): value is ChartPeriod => value === 'day' || value === 'week' || value === 'month'
const boolRecord = (value: unknown) => record(value) && Object.values(value).every((item) => typeof item === 'boolean')

function date(value: unknown, timestamp = false): value is string {
  if (typeof value !== 'string' || !(timestamp ? /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/ : /^\d{4}-\d{2}-\d{2}$/).test(value)) return false
  const day = value.slice(0, 10)
  const parsed = Date.parse(day)
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === day && Number.isFinite(Date.parse(value))
}

function jsonValue(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || finite(value)) return true
  if ((!Array.isArray(value) && !record(value)) || seen.has(value)) return false
  seen.add(value)
  const valid = Object.values(value).every((item) => jsonValue(item, seen))
  seen.delete(value)
  return valid
}

function drawing(value: unknown, symbol: string, chartPeriod: ChartPeriod): value is DrawingObject {
  if (!record(value) || !nonempty(value.id) || value.symbol !== symbol || value.period !== chartPeriod || !['trend-line', 'horizontal-line', 'rectangle', 'text', 'buy', 'sell', 'target', 'stop-loss'].includes(String(value.kind))) return false
  const count = value.kind === 'trend-line' || value.kind === 'rectangle' ? 2 : 1
  if (!Array.isArray(value.points) || value.points.length !== count || !value.points.every((point) => record(point) && date(point.time) && finite(point.price))) return false
  if (!record(value.style) || !nonempty(value.style.color) || !finite(value.style.width) || value.style.width <= 0 || !['solid', 'dashed'].includes(String(value.style.lineStyle)) || !finite(value.style.opacity) || value.style.opacity < 0 || value.style.opacity > 1) return false
  return typeof value.locked === 'boolean' && typeof value.visible === 'boolean' && natural(value.version) && date(value.updatedAt, true) && (value.text === undefined || typeof value.text === 'string') && (value.restoredFromVersion === undefined || (natural(value.restoredFromVersion) && value.version > value.restoredFromVersion))
}

const uniqueIds = (values: Array<{ id: string }>) => new Set(values.map((value) => value.id)).size === values.length

export function isChartWorkspaceV2(value: unknown): value is ChartWorkspaceV2 {
  if (!record(value) || value.version !== 2 || !nonempty(value.symbol) || !period(value.period) || !natural(value.revision) || !date(value.updatedAt, true)) return false
  const symbol = value.symbol
  const chartPeriod = value.period
  if (!Array.isArray(value.drawings) || !value.drawings.every((item) => drawing(item, symbol, chartPeriod)) || !uniqueIds(value.drawings)) return false
  if (!boolRecord(value.indicators) || !boolRecord(value.layers) || !record(value.indicatorConfig) || !jsonValue(value.indicatorConfig)) return false
  for (const [key, item] of Object.entries(value.indicatorConfig)) {
    if (/period$/i.test(key) && (!natural(item) || item === 0)) return false
    if (/multiplier$/i.test(key) && (!finite(item) || item <= 0)) return false
  }
  if (!record(value.view) || !finite(value.view.zoom) || value.view.zoom <= 0 || !finite(value.view.panX) || !finite(value.view.panY) || typeof value.crosshair !== 'boolean') return false
  if (value.deletions !== undefined && (!Array.isArray(value.deletions) || !value.deletions.every((item) => record(item) && nonempty(item.id) && natural(item.version) && date(item.updatedAt, true)) || !uniqueIds(value.deletions))) return false
  return value.recovery === undefined || (Array.isArray(value.recovery) && value.recovery.every((item) => record(item) && ['DELETE_EDIT_CONFLICT', 'VERSION_CONFLICT'].includes(String(item.reason)) && drawing(item.drawing, symbol, chartPeriod) && item.id === item.drawing.id))
}

function canonicalDrawing(value: DrawingObject): DrawingObject {
  return { id: value.id, symbol: value.symbol, period: value.period, kind: value.kind, points: value.points.map(({ time, price }) => ({ time, price })), style: { color: value.style.color, width: value.style.width, lineStyle: value.style.lineStyle, opacity: value.style.opacity }, ...(value.text !== undefined ? { text: value.text } : {}), locked: value.locked, visible: value.visible, version: value.version, updatedAt: value.updatedAt, ...(value.restoredFromVersion !== undefined ? { restoredFromVersion: value.restoredFromVersion } : {}) }
}

/** Object insertion order is not part of the persistence or conflict protocol. */
function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJson)
  if (record(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]))
  return value
}

const canonicalContent = (value: unknown) => JSON.stringify(canonicalJson(value))

export function serializeChartWorkspace(value: ChartWorkspaceV2): string {
  if (!isChartWorkspaceV2(value)) throw new Error('Invalid chart workspace v2')
  return JSON.stringify({ version: 2, symbol: value.symbol, period: value.period, drawings: value.drawings.map(canonicalDrawing), deletions: (value.deletions ?? []).map(({ id, version, updatedAt }) => ({ id, version, updatedAt })), recovery: (value.recovery ?? []).map(({ id, reason, drawing: item }) => ({ id, reason, drawing: canonicalDrawing(item) })), indicators: canonicalJson(value.indicators), indicatorConfig: canonicalJson(value.indicatorConfig), layers: canonicalJson(value.layers), view: { zoom: value.view.zoom, panX: value.view.panX, panY: value.view.panY }, crosshair: value.crosshair, updatedAt: value.updatedAt, revision: value.revision })
}

export function deserializeChartWorkspace(raw: string): ChartWorkspaceV2 | null {
  try {
    const value: unknown = JSON.parse(raw)
    return isChartWorkspaceV2(value) ? JSON.parse(serializeChartWorkspace(value)) as ChartWorkspaceV2 : null
  } catch { return null }
}

function newer<T extends { version: number; updatedAt: string }>(left: T, right: T, content: (value: T) => unknown): T {
  const byVersion = right.version - left.version
  const byTime = Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
  return byVersion > 0 || (byVersion === 0 && (byTime > 0 || (byTime === 0 && canonicalContent(content(right)) > canonicalContent(content(left))))) ? right : left
}

export function mergeChartWorkspace(local: ChartWorkspaceV2, remote: ChartWorkspaceV2): ChartWorkspaceV2 {
  if (!isChartWorkspaceV2(local) || !isChartWorkspaceV2(remote) || local.symbol !== remote.symbol || local.period !== remote.period) throw new Error('Cannot merge invalid or unrelated chart workspaces')
  const settingsContent = (value: ChartWorkspaceV2) => ({ indicators: value.indicators, indicatorConfig: value.indicatorConfig, layers: value.layers, view: value.view, crosshair: value.crosshair, updatedAt: value.updatedAt })
  const settings = newer({ ...local, version: local.revision }, { ...remote, version: remote.revision }, (value) => settingsContent({ ...value, version: 2 }))
  const drawings = new Map<string, DrawingObject>()
  const deletions = new Map<string, DrawingTombstone>()
  const recovery = new Map<string, DrawingRecoveryRecord>()
  const recover = (item: DrawingRecoveryRecord) => recovery.set(canonicalContent({ id: item.id, reason: item.reason, drawing: canonicalDrawing(item.drawing) }), item)
  for (const item of [...(local.recovery ?? []), ...(remote.recovery ?? [])]) recover(item)
  for (const item of [...(local.deletions ?? []), ...(remote.deletions ?? [])]) deletions.set(item.id, deletions.has(item.id) ? newer(deletions.get(item.id)!, item, ({ id, version, updatedAt }) => ({ id, version, updatedAt })) : item)
  for (const item of [...local.drawings, ...remote.drawings]) {
    const current = drawings.get(item.id)
    const winner = current ? newer(current, item, canonicalDrawing) : item
    if (current && !deletions.has(item.id)) {
      const content = (candidate: DrawingObject) => JSON.stringify({ ...canonicalDrawing(candidate), version: 0, updatedAt: '' })
      if (content(current) !== content(item)) recover({ id: item.id, reason: 'VERSION_CONFLICT', drawing: winner === current ? item : current })
    }
    drawings.set(item.id, winner)
  }
  for (const [id, item] of drawings) {
    const deleted = deletions.get(id)
    if (deleted && !(item.version > deleted.version && (item.restoredFromVersion ?? -1) >= deleted.version)) {
      for (const candidate of [...local.drawings, ...remote.drawings].filter((candidate) => candidate.id === id)) recover({ id, reason: 'DELETE_EDIT_CONFLICT', drawing: candidate })
      drawings.delete(id)
    }
  }
  const byId = (a: { id: string }, b: { id: string }) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  return deserializeChartWorkspace(serializeChartWorkspace({ ...settings, version: 2, drawings: [...drawings.values()].sort(byId), deletions: [...deletions.values()].sort(byId), recovery: [...recovery.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, item]) => item), revision: Math.max(local.revision, remote.revision) }))!
}
