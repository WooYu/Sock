import { describe, expect, test } from 'vitest'
import type { Candle } from '../workspace/stock-workspace-types'
import { aggregateCandles, bollinger, canonicalPeriodTime, formatChartTime, movingAverage, withPredictionMovingAverages } from './chart-math'
import type { PredictionSnapshot } from './chart-types'

function candle(day: string, close: number, volume = 1): Candle {
  return { day, open: close - 0.5, high: close + 1, low: close - 1, close, volume }
}

describe('chart math', () => {
  test('retains weekly and monthly OHLCV aggregation on calendar boundaries', () => {
    const candles = [
      candle('2026-08-28', 11, 1),
      candle('2026-08-31', 12, 2),
      candle('2026-09-01', 13, 3),
    ]

    expect(aggregateCandles(candles, 'week')).toEqual([
      { ...candles[0], day: '2026-08-24' },
      { day: '2026-08-31', open: 11.5, high: 14, low: 11, close: 13, volume: 5 },
    ])
    expect(aggregateCandles(candles, 'month')).toEqual([
      { day: '2026-08-01', open: 10.5, high: 13, low: 10, close: 12, volume: 3 },
      candles[2],
    ])
  })

  test('includes three appended prediction candles in MA5 values', () => {
    const candles = Array.from({ length: 8 }, (_, index) => candle(`2026-09-${String(index + 1).padStart(2, '0')}`, index + 1))

    expect(movingAverage(candles, 5)).toEqual([null, null, null, null, 3, 4, 5, 6])
  })

  test('includes three appended prediction candles in configurable BOLL values', () => {
    const candles = Array.from({ length: 8 }, (_, index) => candle(`2026-09-${String(index + 1).padStart(2, '0')}`, index + 1))
    const result = bollinger(candles, 5, 2)

    expect(result.middle).toHaveLength(8)
    expect(result.upper.slice(0, 4)).toEqual([null, null, null, null])
    expect(result.middle.slice(0, 4)).toEqual([null, null, null, null])
    expect(result.lower.slice(0, 4)).toEqual([null, null, null, null])
    expect(result.middle.at(-1)).toBe(6)
    expect(result.upper.at(-1)).toBeCloseTo(8.82842712474619, 12)
    expect(result.lower.at(-1)).toBeCloseTo(3.17157287525381, 12)
  })

  test('does not invent MA250 before the 250th candle and rolls the full window', () => {
    const candles = Array.from({ length: 251 }, (_, index) => candle('2026-09-07', index + 1))
    const result = movingAverage(candles, 250)
    expect(result.slice(0, 249)).toEqual(Array(249).fill(null))
    expect(result[249]).toBe(125.5)
    expect(result[250]).toBe(126.5)
  })

  test('averages the active period candles rather than the underlying daily samples', () => {
    const weekly = aggregateCandles([
      candle('2026-08-03', 1), candle('2026-08-07', 10),
      candle('2026-08-10', 2), candle('2026-08-14', 20),
      candle('2026-08-17', 3), candle('2026-08-21', 30),
      candle('2026-08-24', 4), candle('2026-08-28', 40),
      candle('2026-08-31', 5), candle('2026-09-04', 50),
    ], 'week')
    expect(movingAverage(weekly, 5)).toEqual([null, null, null, null, 30])
  })

  test('groups quarters and years on calendar boundaries with chronological OHLCV', () => {
    const values = [candle('2027-01-04', 40, 4), candle('2026-03-31', 10, 1), candle('2026-04-01', 20, 2), candle('2026-12-31', 30, 3)]
    expect(aggregateCandles(values, 'quarter').map(({ day, close }) => ({ day, close }))).toEqual([
      { day: '2026-01-01', close: 10 }, { day: '2026-04-01', close: 20 },
      { day: '2026-10-01', close: 30 }, { day: '2027-01-01', close: 40 },
    ])
    expect(aggregateCandles(values, 'year')[0]).toEqual({ day: '2026-01-01', open: 9.5, high: 31, low: 9, close: 30, volume: 6 })
    expect(values[0].day).toBe('2027-01-04')
  })

  test('uses matching canonical keys for native and locally aggregated calendar bars', () => {
    expect(canonicalPeriodTime('2026-01-01', 'week')).toBe('2025-12-29')
    expect(canonicalPeriodTime('2026-09-30', 'month')).toBe('2026-09-01')
    expect(canonicalPeriodTime('2026-09-30', 'quarter')).toBe('2026-07-01')
    expect(canonicalPeriodTime('2026-12-31', 'year')).toBe('2026-01-01')
    expect(canonicalPeriodTime('2026-09-07T10:30:00+08:00', 'day')).toBe('2026-09-07')
  })

  test('retains the last observed provider endpoint when aggregating canonical calendar bars', () => {
    const values = [
      { ...candle('2026-01-01', 10), endTime: '2026-01-30' },
      { ...candle('2026-03-01', 20), endTime: '2026-03-31' },
      { ...candle('2026-04-01', 30), endTime: '2026-04-30' },
    ]
    expect(aggregateCandles(values, 'quarter').map(({ day, endTime }) => ({ day, endTime }))).toEqual([
      { day: '2026-01-01', endTime: '2026-03-31' }, { day: '2026-04-01', endTime: '2026-04-30' },
    ])
    expect(aggregateCandles(values, 'year')[0].endTime).toBe('2026-04-30')
  })

  test('aggregates end-labelled 120 minute bars without combining across lunch', () => {
    const bars = aggregateCandles([
      candle('2026-09-07T10:30:00+08:00', 10, 1),
      candle('2026-09-07T11:30:00+08:00', 20, 2),
      candle('2026-09-07T14:00:00+08:00', 30, 3),
      candle('2026-09-07T15:00:00+08:00', 40, 4),
      candle('2026-09-08T10:30:00+08:00', 50, 5),
    ], '120m')
    expect(bars).toEqual([
      { day: '2026-09-07T11:30:00+08:00', open: 9.5, high: 21, low: 9, close: 20, volume: 3 },
      { day: '2026-09-07T15:00:00+08:00', open: 29.5, high: 41, low: 29, close: 40, volume: 7 },
      { day: '2026-09-08T11:30:00+08:00', open: 49.5, high: 51, low: 49, close: 50, volume: 5 },
    ])
    expect(canonicalPeriodTime('2026-09-07T09:30:00+08:00', '5m')).toBe('2026-09-07T09:35:00+08:00')
    expect(canonicalPeriodTime('2026-09-07T11:30:00+08:00', '5m')).toBe('2026-09-07T11:30:00+08:00')
    expect(canonicalPeriodTime('2026-09-07T13:00:00+08:00', '60m')).toBe('2026-09-07T14:00:00+08:00')
    expect(canonicalPeriodTime('2026-09-07T09:30:00+08:00', 'intraday')).toBe('2026-09-07T09:30:00+08:00')
  })

  test('formats minute and calendar labels without depending on the host timezone', () => {
    expect(formatChartTime('2026-09-07T10:35:00+08:00', '5m')).toBe('2026-09-07 10:35 +08:00')
    expect(formatChartTime('2026-09-07', 'day')).toBe('2026-09-07')
    expect(formatChartTime('2026-09-30', 'quarter')).toBe('2026 Q3')
    expect(formatChartTime('2026-12-31', 'year')).toBe('2026')
  })

  test.each([0, -1, 2.5, Number.NaN])('rejects invalid indicator windows %s', (size) => {
    expect(() => movingAverage([candle('2026-09-07', 1)], size)).toThrow()
    expect(() => bollinger([candle('2026-09-07', 1)], size, 2)).toThrow()
  })

  test('does not create minute candles from dates or malformed/out-of-session timestamps', () => {
    for (const day of ['2026-09-07', '2026-02-30T10:30:00+08:00', '2026-09-07T12:00:00+08:00', '2026-09-07T24:00:00+08:00']) {
      expect(() => aggregateCandles([candle(day, 10)], '5m')).toThrow()
    }
  })

  function prediction(closes: [number, number, number]): PredictionSnapshot {
    const day = (close: number, index: number) => ({
      ...candle(`2026-09-0${index + 7}`, close), rangeLow: close - 2, rangeHigh: close + 2,
      confidence: 0.5, ma5: 999, ma10: 999, ma20: 999, bollUpper: 1000, bollMiddle: 999, bollLower: 998,
    })
    return {
      symbol: '300502', period: 'day', generatedAt: '2026-09-06T00:00:00Z', modelVersion: 'test',
      days: [day(closes[0], 0), day(closes[1], 1), day(closes[2], 2)],
    }
  }

  test('enriches every prediction MA using history and each successive predicted close', () => {
    const history = Array.from({ length: 249 }, (_, index) => candle(new Date(Date.UTC(2025, 0, index + 1)).toISOString().slice(0, 10), index + 1))
    const snapshot = prediction([250, 251, 252])
    const result = withPredictionMovingAverages(history, snapshot)
    expect(result.days[0]).toMatchObject({ ma5: 248, ma10: 245.5, ma20: 240.5, ma30: 235.5, ma60: 220.5, ma90: 205.5, ma120: 190.5, ma250: 125.5 })
    expect(result.days.map((day) => day.ma250)).toEqual([125.5, 126.5, 127.5])
    expect(snapshot.days[0].ma5).toBe(999)
    expect(result.days.map((day) => day.bollMiddle)).toEqual([240.5, 241.5, 242.5])
    expect(snapshot.days[0].bollMiddle).toBe(999)
  })

  test('replaces stale forecast BOLL with the same 20 closes and population variance as MA20', () => {
    const history = Array.from({ length: 19 }, (_, index) => candle(`2026-08-${String(index + 1).padStart(2, '0')}`, index + 1))
    const result = withPredictionMovingAverages(history, prediction([20, 21, 22]))
    expect(result.days.map((day) => day.ma20)).toEqual([10.5, 11.5, 12.5])
    expect(result.days.map((day) => day.bollMiddle)).toEqual([10.5, 11.5, 12.5])
    // Each forecast window contains 20 consecutive integers: population variance is 33.25.
    for (const day of result.days) {
      expect(day.bollMiddle).toBe(day.ma20)
      expect(((day.bollUpper! - day.bollMiddle!) / 2) ** 2).toBeCloseTo(33.25, 12)
      expect(((day.bollMiddle! - day.bollLower!) / 2) ** 2).toBeCloseTo(33.25, 12)
    }
    expect(result.days[0].bollUpper).toBeCloseTo(22.032562594670797, 12)
    expect(result.days[0].bollLower).toBeCloseTo(-1.032562594670797, 12)
  })

  test('starts forecast BOLL only when an appended close completes the twentieth observation', () => {
    const history = Array.from({ length: 18 }, (_, index) => candle(`2026-08-${String(index + 1).padStart(2, '0')}`, index + 1))
    const result = withPredictionMovingAverages(history, prediction([19, 20, 21]))
    expect(result.days[0]).toMatchObject({ ma20: null, bollUpper: null, bollMiddle: null, bollLower: null })
    expect(result.days.map((day) => day.bollMiddle)).toEqual([null, 10.5, 11.5])
    expect(result.days[1].bollUpper).toBeCloseTo(22.032562594670797, 12)
  })

  test('leaves short-history prediction averages null and excludes realized future observations', () => {
    const result = withPredictionMovingAverages([
      candle('2026-09-01', 1), candle('2026-09-02', 2), candle('2026-09-07', 10000),
    ], prediction([3, 4, 5]))
    expect(result.days.map((day) => day.ma5)).toEqual([null, null, 3])
    expect(result.days.map((day) => day.ma20)).toEqual([null, null, null])
    expect(result.days.map((day) => day.ma250)).toEqual([null, null, null])
    expect(result.days.map((day) => [day.bollUpper, day.bollMiddle, day.bollLower])).toEqual([
      [null, null, null], [null, null, null], [null, null, null],
    ])
    const weekly = { ...prediction([3, 4, 5]), period: 'week' as const }
    expect(withPredictionMovingAverages([], weekly)).toEqual(weekly)
  })
})
