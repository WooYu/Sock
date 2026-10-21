import { isCalendarDate, isChartTime, isIsoTimestamp } from '../chart/chart-periods'
import type { AnalysisPeriod, BarTarget, Horizon, TradingCalendar } from './scenario-types'

export const ANALYSIS_PERIODS: AnalysisPeriod[] = ['day', '60m', '30m', '15m']
export function sessionEnds(period: AnalysisPeriod): string[] {
  return period === '60m' ? ['10:30', '11:30', '14:00', '15:00']
    : period === '30m' ? ['10:00', '10:30', '11:00', '11:30', '13:30', '14:00', '14:30', '15:00']
    : period === '15m' ? ['09:45', '10:00', '10:15', '10:30', '10:45', '11:00', '11:15', '11:30', '13:15', '13:30', '13:45', '14:00', '14:15', '14:30', '14:45', '15:00'] : ['15:00']
}
export function barEndAt(period: AnalysisPeriod, barKey: string): string {
  if (!ANALYSIS_PERIODS.includes(period) || !isChartTime(barKey, period)) throw new Error('K线原点时间无效')
  return period === 'day' ? barKey + 'T15:00:00+08:00' : barKey
}
export function isTradingCalendar(value: unknown): value is TradingCalendar {
  if (!value || typeof value !== 'object') return false
  const c = value as TradingCalendar
  return isCalendarDate(c.fromDay) && isCalendarDate(c.throughDay) && c.fromDay <= c.throughDay
    && typeof c.sourceUrl === 'string' && /^https:\/\//.test(c.sourceUrl) && isIsoTimestamp(c.verifiedAt)
    && Array.isArray(c.tradingDays) && c.tradingDays.every((d, i) => isCalendarDate(d) && d >= c.fromDay && d <= c.throughDay
      && (i === 0 || d > c.tradingDays[i - 1]))
}
export function futureBarTargets(period: AnalysisPeriod, originBarKey: string, horizons: Horizon[], calendar: TradingCalendar | null): BarTarget[] {
  barEndAt(period, originBarKey)
  if (!horizons.length || horizons.some(h => ![1, 2, 3, 4].includes(h))) throw new Error('未来根数无效')
  const unknown = (issue: string) => horizons.map(horizon => ({ horizon, barKey: null, endAt: null, issues: [issue] }))
  if (calendar === null) return unknown('calendar_missing')
  if (!isTradingCalendar(calendar)) return unknown('calendar_invalid')
  const originDay = originBarKey.slice(0, 10)
  if (originDay < calendar.fromDay || originDay > calendar.throughDay) return unknown('calendar_out_of_range')
  if (!calendar.tradingDays.includes(originDay)) return unknown('calendar_origin_not_trading')
  const keys = calendar.tradingDays.flatMap(day => period === 'day' ? [day] : sessionEnds(period).map(time => day + 'T' + time + ':00+08:00'))
  const index = keys.indexOf(originBarKey)
  if (index < 0) throw new Error('K线原点不在交易时段')
  return horizons.map(horizon => {
    const barKey = keys[index + horizon] ?? null
    return { horizon, barKey, endAt: barKey ? barEndAt(period, barKey) : null, issues: barKey ? [] : ['calendar_out_of_range'] }
  })
}
