import { describe, expect, test } from 'vitest'
import { analyzeMarketSnapshot } from './analysis-engine'
import type { MarketSnapshot } from '../workspace/stock-workspace-types'

function snapshot(closes: number[], state = 'DELAYED'): MarketSnapshot {
  return {
    quote: {
      security: { code: '600519', name: '贵州茅台' },
      price: closes.at(-1) ?? 0,
    },
    dailyCandles: closes.map((close, index) => ({
      day: `2026-08-${String(index + 1).padStart(2, '0')}`,
      open: close - 0.5,
      high: close + 1,
      low: close - 1,
      close,
      volume: 1000 + index * 10,
    })),
    source: {
      name: 'test',
      fetchedAt: '2026-08-30T09:30:00.000Z',
      state,
      online: state !== 'OFFLINE',
    },
  }
}

describe('analyzeMarketSnapshot', () => {
  test('returns WAIT when history is incomplete', () => {
    const result = analyzeMarketSnapshot(snapshot([10, 11, 12]))

    expect(result.decision.action).toBe('WAIT')
    expect(result.decision.missingFacts).toContain('至少20根日K线')
  })

  test('returns WAIT for stale data', () => {
    const result = analyzeMarketSnapshot(snapshot(Array.from({ length: 25 }, (_, i) => 10 + i), 'STALE'))

    expect(result.decision.action).toBe('WAIT')
    expect(result.decision.reason).toContain('过期')
  })

  test('returns ENTER only after deterministic trend conditions match', () => {
    const result = analyzeMarketSnapshot(snapshot(Array.from({ length: 30 }, (_, i) => 10 + i * 0.5)))

    expect(result.decision.action).toBe('ENTER')
    expect(result.decision.matchedRules.length).toBeGreaterThan(0)
    expect(result.decision.evidence.length).toBeGreaterThan(0)
  })
})
