import { expect, test } from 'vitest'
import { projectIndicators, projectionTimes, projectSessionIndicators, projectionLimitDays } from './indicator-projection'
import { MA_PERIODS } from './chart-periods'
import { movingAverage } from './chart-math'
import type { Candle } from '../workspace/stock-workspace-types'
const candles: Candle[] = Array.from({ length: 260 }, (_, i) => ({ day: new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10), open: i + 10, high: i + 11, low: i + 9, close: i + 10 + i % 3, volume: 100 }))
test('projects four successive targets for every MA with an increment scenario envelope', () => {
  const points = projectIndicators(candles, 'day', null)
  expect(points).toHaveLength(4)
  for (const n of MA_PERIODS) {
    const series = movingAverage(candles, n), a = series.at(-3)!, b = series.at(-2)!, c = series.at(-1)!
    points.forEach((point, i) => {
      expect(point.values[`ma${n}`]).toBeCloseTo(c + (c - a) / 2 * (i + 1), 10)
      expect(point.ranges[`ma${n}`]![0]).toBeLessThanOrEqual(point.values[`ma${n}`]! + 1e-10)
      expect(point.ranges[`ma${n}`]![1]).toBeGreaterThanOrEqual(point.values[`ma${n}`]! - 1e-10)
      expect(point.ranges[`ma${n}`]).toEqual([c + Math.min(b - a, c - b) * (i + 1), c + Math.max(b - a, c - b) * (i + 1)])
    })
  }
})
test('does not invent long MA values when observations are insufficient', () => {
  const points = projectIndicators(candles.slice(0, 21), 'day', null)
  expect(points.every(p => p.values.ma250 === null && p.values.ma20 === null && p.ranges.ma250 === undefined)).toBe(true)
  expect(projectIndicators([], 'day', null)).toEqual([])
  expect(projectIndicators(candles.map(c => ({ ...c, day: '2026-10-16T10:00:00+08:00' })), 'intraday', null)).toHaveLength(4)
})
test('marks unverified dates estimated, skips weekends and minute lunch/overnight closures', () => {
  expect(projectionTimes('2026-10-16', 'day', null)[0]).toEqual({ day: '2026-10-19', estimated: true })
  expect(projectionTimes('2026-10-16T11:30:00+08:00', '60m', null).map(t => t.day)).toEqual(['2026-10-16T14:00:00+08:00', '2026-10-16T15:00:00+08:00', '2026-10-19T10:30:00+08:00', '2026-10-19T11:30:00+08:00'])
})
test('uses covered trading calendar to skip a verified holiday and keeps calendar period buckets unique', () => {
  const calendar = { fromDay: '2026-10-16', throughDay: '2026-10-23', verifiedAt: '2026-10-15T00:00:00Z', sourceUrl: 'https://example.com/calendar', tradingDays: ['2026-10-16', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23'] }
  expect(projectionTimes('2026-10-16', 'day', calendar)[0]).toEqual({ day: '2026-10-20', estimated: false })
  expect(projectionTimes('2026-10-01', 'month', null).map(t => t.day)).toEqual(['2026-11-01', '2026-12-01', '2027-01-01', '2027-02-01'])
})

test('minute daily reach includes every remaining session bar, rather than only four minutes', () => {
  const minuteHistory = candles.map((bar, i) => ({ ...bar, day: `2026-10-16T09:${String(i % 29 + 31).padStart(2, '0')}:00+08:00` }))
  minuteHistory[minuteHistory.length - 1].day = '2026-10-16T10:00:00+08:00'
  const reach = projectSessionIndicators(minuteHistory, '1m', null)!
  expect(reach.day).toBe('2026-10-16T15:00:00+08:00')
  expect(reach.horizon).toBe(210)
  expect(reach.ranges.ma250).toBeDefined()
  expect(projectSessionIndicators(candles, 'day', null)).toBeNull()
})

test('all periods count daily limits rather than applying a daily limit per bar', () => {
  expect(projectionLimitDays('2026-10-16T10:00:00+08:00', '2026-10-16T10:04:00+08:00', '1m', null)?.days).toBe(0)
  expect(projectionLimitDays('2026-10-16T15:00:00+08:00', '2026-10-19T09:31:00+08:00', 'intraday', null)?.days).toBe(1)
  expect(projectionLimitDays('2026-10-12', '2026-10-19', 'week', null)?.days).toBe(5)
  expect(projectionLimitDays('2026-10-01', '2026-11-01', 'month', null)?.days).toBe(21)
  expect(projectionLimitDays('2026-10-01', '2027-01-01', 'quarter', null)?.days).toBe(64)
  expect(projectionLimitDays('2026-01-01', '2027-01-01', 'year', null)?.days).toBe(261)
})
