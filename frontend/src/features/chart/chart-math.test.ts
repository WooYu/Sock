import { describe, expect, test } from 'vitest'
import type { Candle } from '../workspace/stock-workspace-types'
import { aggregateCandles, bollinger, movingAverage } from './chart-math'

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
      candles[0],
      { day: '2026-08-31', open: 11.5, high: 14, low: 11, close: 13, volume: 5 },
    ])
    expect(aggregateCandles(candles, 'month')).toEqual([
      { day: '2026-08-28', open: 10.5, high: 13, low: 10, close: 12, volume: 3 },
      candles[2],
    ])
  })

  test('includes three appended prediction candles in MA5 values', () => {
    const candles = Array.from({ length: 8 }, (_, index) => candle(`2026-09-${String(index + 1).padStart(2, '0')}`, index + 1))

    expect(movingAverage(candles, 5)).toEqual([1, 1.5, 2, 2.5, 3, 4, 5, 6])
  })

  test('includes three appended prediction candles in configurable BOLL values', () => {
    const candles = Array.from({ length: 8 }, (_, index) => candle(`2026-09-${String(index + 1).padStart(2, '0')}`, index + 1))
    const result = bollinger(candles, 5, 2)

    expect(result.middle).toHaveLength(8)
    expect(result.middle.at(-1)).toBe(6)
    expect(result.upper.at(-1)).toBeCloseTo(8.82842712474619, 12)
    expect(result.lower.at(-1)).toBeCloseTo(3.17157287525381, 12)
  })
})
