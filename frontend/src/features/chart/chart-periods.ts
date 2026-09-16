export const CHART_PERIODS = ['intraday', '1m', '5m', '15m', '30m', '60m', '120m', 'day', 'week', 'month', 'quarter', 'year'] as const
export type ChartPeriod = typeof CHART_PERIODS[number]
export const PERIOD_LABELS: Record<ChartPeriod, string> = { intraday: '分时', '1m': '1分钟', '5m': '5分钟', '15m': '15分钟', '30m': '30分钟', '60m': '1小时', '120m': '2小时', day: '日线', week: '周线', month: '月线', quarter: '季线', year: '年线' }
export const MA_PERIODS = [5, 10, 20, 30, 60, 90, 120, 250] as const
export type MaPeriod = typeof MA_PERIODS[number]
export type MaKey = `ma${MaPeriod}`
export type IndicatorKey = MaKey | 'boll'
export type IndicatorValue = number | null
export type IndicatorValues = Partial<Record<MaKey, IndicatorValue[]>> & { boll: { upper: IndicatorValue[]; middle: IndicatorValue[]; lower: IndicatorValue[] } }
export const MA_COLORS: Record<MaKey, string> = { ma5: '#c79b28', ma10: '#408ac4', ma20: '#9661cf', ma30: '#27949e', ma60: '#c67c38', ma90: '#bd688f', ma120: '#738196', ma250: '#78613f' }
export const DEFAULT_INDICATORS: Record<IndicatorKey, boolean> = { ma5: true, ma10: true, ma20: true, ma30: true, ma60: true, ma90: true, ma120: true, ma250: true, boll: true }
export function isChartPeriod(value: unknown): value is ChartPeriod { return typeof value === 'string' && (CHART_PERIODS as readonly string[]).includes(value) }
export function isMinutePeriod(period: ChartPeriod) { return /^\d+m$/.test(period) }
export function isIntradayPeriod(period: ChartPeriod) { return period === 'intraday' || isMinutePeriod(period) }

/** Date.parse alone silently normalizes invalid dates such as February 30. */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value
}

export function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/.exec(value)
  return !!match && isCalendarDate(match[1]) && Number(match[2]) < 24 && Number(match[3]) < 60 && Number(match[4]) < 60
    && (match[5] === 'Z' || (Number(match[6]) < 24 && Number(match[7]) < 60)) && Number.isFinite(Date.parse(value))
}

function shanghaiSession(time: string): { minute: number; start: number; end: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+08:00$/.test(time) || !isIsoTimestamp(time)) return null
  const minute = Number(time.slice(11, 13)) * 60 + Number(time.slice(14, 16))
  if (minute >= 570 && minute <= 690) return { minute, start: 570, end: 690 }
  if (minute >= 780 && minute <= 900) return { minute, start: 780, end: 900 }
  return null
}

/**
 * Calendar keys are bucket starts, even when that date is not a trading day.
 * Minute keys are Shanghai session END timestamps: 120m ends at 11:30/15:00.
 * Session-opening samples fold into the first bar; intraday keeps every minute.
 */
export function canonicalPeriodTime(time: string, period: ChartPeriod): string {
  if (!isChartPeriod(period)) throw new RangeError('Unsupported chart period')
  if (isIntradayPeriod(period)) {
    const session = shanghaiSession(time)
    if (!session) throw new RangeError('Chart minute time must be a Shanghai trading-session timestamp')
    if (period === 'intraday') return time
    const size = Number.parseInt(period, 10)
    const end = Math.min(session.end, session.start + Math.ceil(Math.max(1, session.minute - session.start) / size) * size)
    return `${time.slice(0, 10)}T${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}:00+08:00`
  }
  const dayPart = time.slice(0, 10)
  const day = isCalendarDate(time) ? time : shanghaiSession(time) ? dayPart : null
  if (!day) throw new RangeError('Chart calendar time must contain a valid calendar date')
  if (period === 'day') return day
  if (period === 'month') return `${day.slice(0, 7)}-01`
  if (period === 'quarter') return `${day.slice(0, 4)}-${String(Math.floor((Number(day.slice(5, 7)) - 1) / 3) * 3 + 1).padStart(2, '0')}-01`
  if (period === 'year') return `${day.slice(0, 4)}-01-01`
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
  return date.toISOString().slice(0, 10)
}

/** Old calendar drawings may use any date in the bucket; preserve their anchors. */
export function isChartTime(value: unknown, period: ChartPeriod): value is string {
  if (typeof value !== 'string' || !isChartPeriod(period)) return false
  if (!isIntradayPeriod(period)) return isCalendarDate(value)
  if (!shanghaiSession(value)) return false
  return period === 'intraday' || canonicalPeriodTime(value, period) === value
}

export function formatChartTime(time: string, period: ChartPeriod): string {
  const canonical = canonicalPeriodTime(time, period)
  if (isIntradayPeriod(period)) return `${canonical.slice(0, 16).replace('T', ' ')} +08:00`
  if (period === 'month') return canonical.slice(0, 7)
  if (period === 'quarter') return `${canonical.slice(0, 4)} Q${Math.floor((Number(canonical.slice(5, 7)) - 1) / 3) + 1}`
  if (period === 'year') return canonical.slice(0, 4)
  return canonical
}
