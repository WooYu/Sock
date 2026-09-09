import type { Candle, MarketSnapshot } from '../workspace/stock-workspace-types'

export type ChartPeriod = 'day' | 'week' | 'month'

export type TimePricePoint = {
  time: string
  price: number
}

export type DrawingKind =
  | 'trend-line'
  | 'horizontal-line'
  | 'rectangle'
  | 'text'
  | 'buy'
  | 'sell'
  | 'target'
  | 'stop-loss'

export type DrawingStyle = {
  color: string
  width: number
  lineStyle: 'solid' | 'dashed'
  opacity: number
}

export type DrawingObject = {
  id: string
  symbol: string
  period: ChartPeriod
  kind: DrawingKind
  points: TimePricePoint[]
  style: DrawingStyle
  text?: string
  locked: boolean
  visible: boolean
  version: number
  updatedAt: string
  /** Explicit undo/restoration acknowledges a specific durable deletion. */
  restoredFromVersion?: number
}

export type PredictionDay = {
  day: string
  open: number
  high: number
  low: number
  close: number
  rangeLow: number
  rangeHigh: number
  confidence: number
  ma5: number
  ma10: number
  ma20: number
  bollUpper: number
  bollMiddle: number
  bollLower: number
}

export type PredictionSnapshot = {
  symbol: string
  period: ChartPeriod
  generatedAt: string
  modelVersion: string
  days: [PredictionDay, PredictionDay, PredictionDay]
}

export type DrawingTombstone = { id: string; version: number; updatedAt: string }
export type DrawingRecoveryRecord = { id: string; reason: 'DELETE_EDIT_CONFLICT' | 'VERSION_CONFLICT'; drawing: DrawingObject }

export type ChartWorkspaceV2 = {
  version: 2
  symbol: string
  period: ChartPeriod
  drawings: DrawingObject[]
  indicators: Record<string, boolean>
  indicatorConfig: Record<string, unknown>
  layers: Record<string, boolean>
  view: { zoom: number; panX: number; panY: number }
  crosshair: boolean
  updatedAt: string
  revision: number
  deletions?: DrawingTombstone[]
  recovery?: DrawingRecoveryRecord[]
  /** Source data is optional so this contract can be used by chart-only callers. */
  candles?: Candle[]
  market?: MarketSnapshot
}

const chartPeriods: readonly ChartPeriod[] = ['day', 'week', 'month']
const drawingKinds: readonly DrawingKind[] = ['trend-line', 'horizontal-line', 'rectangle', 'text', 'buy', 'sell', 'target', 'stop-loss']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function tradingDayKey(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return Number.NaN
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day && parsed.getUTCDay() > 0 && parsed.getUTCDay() < 6 ? parsed.getTime() : Number.NaN
}

function isTradingDay(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(tradingDayKey(value))
}

function isChartPeriod(value: unknown): value is ChartPeriod {
  return typeof value === 'string' && chartPeriods.includes(value as ChartPeriod)
}

function isDrawingKind(value: unknown): value is DrawingKind {
  return typeof value === 'string' && drawingKinds.includes(value as DrawingKind)
}

/** Runtime validation for the versioned, three-session prediction response. */
export function isPredictionSnapshot(value: unknown): value is PredictionSnapshot {
  if (!isRecord(value) || typeof value.symbol !== 'string' || !isChartPeriod(value.period) || !isDate(value.generatedAt) || typeof value.modelVersion !== 'string' || !Array.isArray(value.days) || value.days.length !== 3) return false

  let previousDay: number | undefined
  for (const day of value.days) {
    if (!isRecord(day) || !isTradingDay(day.day) || (previousDay !== undefined && tradingDayKey(day.day) <= previousDay)) return false
    previousDay = tradingDayKey(day.day)

    const prices = ['open', 'high', 'low', 'close', 'rangeLow', 'rangeHigh']
    if (!prices.every((key) => isFiniteNumber(day[key])) || !isFiniteNumber(day.confidence) || day.confidence < 0 || day.confidence > 1) return false

    const indicators = ['ma5', 'ma10', 'ma20', 'bollUpper', 'bollMiddle', 'bollLower']
    if (!indicators.every((key) => isFiniteNumber(day[key]))) return false
  }
  return true
}

export type LegacyWorkspace = {
  version?: unknown
  symbol?: unknown
  stockCode?: unknown
  period?: unknown
  drawings?: unknown
  [key: string]: unknown
}

export type MigratedWorkspace = ChartWorkspaceV2 & { legacyDrawingsDiscarded: number }

function isDrawingObject(value: unknown): value is DrawingObject {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.symbol !== 'string' || !isChartPeriod(value.period) || !isDrawingKind(value.kind) || !Array.isArray(value.points) || !isRecord(value.style) || typeof value.locked !== 'boolean' || typeof value.visible !== 'boolean' || !isFiniteNumber(value.version) || typeof value.updatedAt !== 'string' || ('text' in value && typeof value.text !== 'string')) return false
  if (!value.points.every((point) => isRecord(point) && typeof point.time === 'string' && isFiniteNumber(point.price))) return false
  return typeof value.style.color === 'string' && isFiniteNumber(value.style.width) && (value.style.lineStyle === 'solid' || value.style.lineStyle === 'dashed') && isFiniteNumber(value.style.opacity)
}

/**
 * Convert the old pixel-coordinate workspace to v2. Pixel coordinates are not
 * convertible to time/price without the historical viewport, so every legacy
 * drawing is intentionally discarded.
 */
export function migrateWorkspace(input: unknown): MigratedWorkspace {
  const source = isRecord(input) ? input as LegacyWorkspace : {}
  const legacyDrawings = Array.isArray(source.drawings) ? source.drawings : []
  const version = source.version
  const period = isChartPeriod(source.period) ? source.period : 'day'
  const symbol = typeof source.symbol === 'string' ? source.symbol : typeof source.stockCode === 'string' ? source.stockCode : ''
  const updatedAt = typeof source.updatedAt === 'string' ? source.updatedAt : new Date().toISOString()
  const drawings = version === 2 ? legacyDrawings.filter(isDrawingObject) : []

  return {
    version: 2,
    symbol,
    period,
    drawings,
    indicators: isRecord(source.indicators) ? source.indicators as Record<string, boolean> : {},
    indicatorConfig: isRecord(source.indicatorConfig) ? source.indicatorConfig : {},
    layers: isRecord(source.layers) ? source.layers as Record<string, boolean> : {},
    view: { zoom: 100, panX: 0, panY: 0 },
    crosshair: false,
    updatedAt,
    revision: typeof source.revision === 'number' && Number.isFinite(source.revision) ? source.revision : 0,
    legacyDrawingsDiscarded: version === 1 ? legacyDrawings.length : 0,
  }
}
