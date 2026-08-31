import { describe, expect, test } from 'vitest'
import type { Candle, Security } from '../workspace/stock-workspace-types'
import { calculateStockAnalysis } from './analysis-calculator'

const security: Security = { code: '600519', name: '贵州茅台', exchange: 'SH' }

function candles(count: number): Candle[] {
  return Array.from({ length: count }, (_, index) => {
    const close = 100 + index
    return {
      day: `2026-01-${String(index + 1).padStart(2, '0')}`,
      open: close - 1,
      high: close + 2,
      low: close - 2,
      close,
      volume: 1000 + index,
    }
  })
}

describe('calculateStockAnalysis', () => {
  test('calculates moving averages, Bollinger bands and key levels from candles', () => {
    const result = calculateStockAnalysis(security, candles(25))

    expect(result.status).toBe('ready')
    expect(result.indicators.ma5).toBe(122)
    expect(result.indicators.ma10).toBe(119.5)
    expect(result.indicators.ma20).toBe(114.5)
    expect(result.support).toBe(103)
    expect(result.resistance).toBe(126)
    expect(result.target).toBeGreaterThan(result.resistance)
    expect(result.direction).toBe('bullish')
    expect(result.future).toHaveLength(3)
  })

  test('returns wait when there are not enough candles for the analysis window', () => {
    const result = calculateStockAnalysis(security, candles(10))

    expect(result.status).toBe('waiting')
    expect(result.direction).toBe('neutral')
    expect(result.reason).toMatch(/20/)
    expect(result.matchedRules).toEqual([])
    expect(result.future).toEqual([])
  })
})
