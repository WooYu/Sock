import { expect, test } from 'vitest'
import { movingAverage, bollinger } from './chart-math'
import { MA_PERIODS } from './chart-periods'
import { compareIndicatorProjection } from './projection-evaluation'
import { projectIndicators, projectionTimes } from './indicator-projection'
import { scenarioCalendar } from '../scenario/scenario-calendar-data'
const candles = Array.from({ length: 360 }, (_, i) => ({ day: new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10), open: 1200 + i, close: 1200 + i + Math.sin(i) * 4, high: 1210 + i, low: 1190 + i, volume: 100 }))
test('all MA windows agree with an independent sum, including MA250', () => {
  for (const n of MA_PERIODS) {
    const values = movingAverage(candles, n)
    expect(values[n - 2]).toBeNull()
    for (let i = n - 1; i < candles.length; i++) expect(values[i]).toBeCloseTo(candles.slice(i - n + 1, i + 1).reduce((s, b) => s + b.close, 0) / n, 8)
  }
  const last = candles.slice(-20).map(b => b.close), mean = last.reduce((a, b) => a + b) / 20
  const sd = Math.sqrt(last.reduce((s, x) => s + (x - mean) ** 2, 0) / 20)
  expect(bollinger(candles, 20, 2).upper.at(-1)).toBeCloseTo(mean + 2 * sd, 8)
})
test('official 2026 calendar skips holidays and does not turn makeup weekends into sessions', () => {
  expect(projectionTimes('2026-09-30', 'day', scenarioCalendar).map(t => t.day)).toEqual(['2026-10-08','2026-10-09','2026-10-12','2026-10-13'])
  expect(projectionTimes('2026-02-13', 'day', scenarioCalendar)[0]).toEqual({ day: '2026-02-24', estimated: false })
  expect(projectionTimes('2027-01-04', 'day', scenarioCalendar)[0].estimated).toBe(true)
})
test('saved forecasts only receive actual indicators after their target close', () => {
  const points = projectIndicators(candles.slice(0, -4), 'day', null)
  // Use actual target keys; a historical comparison must not recompute the prediction.
  points.forEach((p, i) => { p.day = candles.at(-4 + i)!.day })
  const before = compareIndicatorProjection(points, candles, points[0].day + 'T06:00:00Z')
  expect(before[0].values.every(v => v.actual === null)).toBe(true)
  const after = compareIndicatorProjection(points, candles, '2027-01-01T00:00:00Z')
  expect(after[0].values.find(v => v.key === 'ma250')?.actual).toBeCloseTo(candles.slice(-253, -3).reduce((s, b) => s + b.close, 0) / 250, 8)
})
