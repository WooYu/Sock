import { describe, expect, test } from 'vitest'
import { findHistoricalMatches, summarizeRecent } from './research-context'
import type { Candle } from '../workspace/stock-workspace-types'

const candles: Candle[] = Array.from({ length: 90 }, (_, index) => ({
  day: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10),
  open: 100 + index, close: 101 + index, high: 103 + index, low: 99 + index, volume: 1000,
}))

describe('research context from historical candles', () => {
  test('historical matches and subsequent returns end before the current observation window', () => {
    const matches = findHistoricalMatches(candles)
    expect(matches.length).toBeGreaterThan(0)
    for (const match of matches) {
      expect(match.followThroughDay < candles.at(-10)!.day).toBe(true)
      expect(match.distance).toBeGreaterThanOrEqual(0)
      const end = candles.findIndex((candle) => candle.day === match.endDay)
      expect(match.followThroughReturn).toBeCloseTo((candles[end + 3].close / candles[end].close - 1) * 100)
    }
  })
  test('insufficient history never produces a historical match', () => {
    expect(findHistoricalMatches(candles.slice(0, 22))).toEqual([])
    expect(summarizeRecent([])).toBeNull()
    expect(summarizeRecent(candles.slice(0, 20))?.volumeRatio).toBeNull()
  })
  test('recent measurements use the prior volume window and current twenty sessions', () => {
    const summary = summarizeRecent([...candles.slice(0, 24), { ...candles[24], volume: 2000 }])!
    expect(summary.volumeRatio).toBe(2)
    expect(summary.high).toBe(127)
    expect(summary.low).toBe(104)
    expect(summary.ma20).toBe(115.5)
  })
})
