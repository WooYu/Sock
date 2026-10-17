import type { Candle } from '../workspace/stock-workspace-types'
import { bollinger, movingAverage } from './chart-math'
import { canonicalPeriodTime, isMinutePeriod, MA_PERIODS, type ChartPeriod, type MaKey } from './chart-periods'
import type { TradingCalendar } from '../scenario/scenario-types'

export type ProjectionKey = MaKey | 'bollUpper' | 'bollMiddle' | 'bollLower'
export type IndicatorProjection = { day: string; estimated: boolean; horizon: number; values: Record<ProjectionKey, number | null>; ranges: Partial<Record<ProjectionKey, [number, number]>> }

/** Keep unknown holiday dates explicit. Minute slots skip lunch and overnight closures. */
export function projectionTimes(origin: string, period: ChartPeriod, calendar: TradingCalendar | null, count = 4): Array<{ day: string; estimated: boolean }> {
  if (period === 'intraday' || !origin) return []
  if (!Number.isSafeInteger(count) || count < 1 || count > 240) throw new RangeError('Projection count must be 1–240')
  const known = calendar?.tradingDays ?? []
  const originDay = origin.slice(0, 10)
  const dates: string[] = []
  const cursor = new Date(originDay + 'T00:00:00Z')
  const isTrading = (day: string) => calendar && day >= calendar.fromDay && day <= calendar.throughDay
    ? known.includes(day) : ![0, 6].includes(new Date(day + 'T00:00:00Z').getUTCDay())
  const estimated = (day: string) => !calendar || day < calendar.fromDay || day > calendar.throughDay
  const result: Array<{ day: string; estimated: boolean }> = []
  for (let i = 0; i < 1600 && result.length < count; i++) {
    const day = cursor.toISOString().slice(0, 10)
    if (isTrading(day)) {
      if (isMinutePeriod(period)) {
        const size = parseInt(period)
        for (const [start, end] of [[570, 690], [780, 900]]) for (let m = start + size; m <= end; m += size) {
          const key = `${day}T${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00+08:00`
          if (key > origin && result.length < count) result.push({ day: key, estimated: estimated(day) })
        }
      } else {
        const key = canonicalPeriodTime(day, period)
        if (key > canonicalPeriodTime(origin, period) && !dates.includes(key)) {
          dates.push(key); result.push({ day: key, estimated: estimated(day) })
        }
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return result
}

/** Same average increment as the scenario table: the last three observations give two increments. */
export function projectIndicators(candles: Candle[], period: ChartPeriod, calendar: TradingCalendar | null, count = 4): IndicatorProjection[] {
  if (!candles.length || period === 'intraday') return []
  const bands = bollinger(candles, 20, 2)
  const series = { ...Object.fromEntries(MA_PERIODS.map(n => [`ma${n}`, movingAverage(candles, n)])), bollUpper: bands.upper, bollMiddle: bands.middle, bollLower: bands.lower }
  return projectionTimes(candles.at(-1)!.day, period, calendar, count).map((target, index) => {
    const ranges: Partial<Record<ProjectionKey, [number, number]>> = {}
    const values = Object.fromEntries(Object.entries(series).map(([key, values]) => {
      const recent = values.slice(-3)
      const value = recent.length === 3 && recent.every(v => v !== null && Number.isFinite(v))
        ? recent[2]! + (recent[2]! - recent[0]!) / 2 * (index + 1) : null
      if (value !== null) {
        const deltas = [recent[1]! - recent[0]!, recent[2]! - recent[1]!]
        const low = recent[2]! + Math.min(...deltas) * (index + 1)
        const high = recent[2]! + Math.max(...deltas) * (index + 1)
        if (low > 0 && Number.isFinite(low) && Number.isFinite(high)) ranges[key as ProjectionKey] = [low, high]
      }
      return [key, value !== null && value > 0 && Number.isFinite(value) ? value : null]
    })) as Record<ProjectionKey, number | null>
    if (values.bollUpper === null || values.bollMiddle === null || values.bollLower === null || values.bollUpper < values.bollMiddle || values.bollMiddle < values.bollLower) {
      values.bollUpper = values.bollMiddle = values.bollLower = null
      delete ranges.bollUpper; delete ranges.bollMiddle; delete ranges.bollLower
    }
    return { ...target, horizon: index + 1, values, ranges }
  })
}

/** Whole remaining session rather than treating four minute bars as an entire day. */
export function projectSessionIndicators(candles: Candle[], period: ChartPeriod, calendar: TradingCalendar | null): IndicatorProjection | null {
  if (!isMinutePeriod(period)) return null
  const points = projectIndicators(candles, period, calendar, 240)
  const day = points[0]?.day.slice(0, 10)
  const session = points.filter(point => point.day.slice(0, 10) === day)
  const end = session.at(-1)
  if (!end) return null
  const ranges: IndicatorProjection['ranges'] = {}
  for (const key of Object.keys(end.values) as ProjectionKey[]) {
    const candidates = session.flatMap(p => p.ranges[key] ?? (p.values[key] === null ? [] : [p.values[key]!]))
    if (candidates.length && end.values[key] !== null) ranges[key] = [Math.min(...candidates), Math.max(...candidates)]
  }
  return { ...end, ranges }
}
