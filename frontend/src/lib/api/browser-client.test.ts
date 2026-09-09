import { afterEach, describe, expect, test, vi } from 'vitest'
import { browserMarketClient } from './browser-client'
import type { PredictionSnapshot } from '@/features/chart/chart-types'

const prediction: PredictionSnapshot = {
  symbol: '600519',
  period: 'day',
  generatedAt: '2026-09-09T08:00:00.000Z',
  modelVersion: 'baseline-v1',
  days: [
    { day: '2026-09-09', open: 100, high: 105, low: 99, close: 104, rangeLow: 98, rangeHigh: 106, confidence: 0.7, ma5: 101, ma10: 100, ma20: 99, bollUpper: 108, bollMiddle: 101, bollLower: 94 },
    { day: '2026-09-10', open: 104, high: 107, low: 102, close: 106, rangeLow: 101, rangeHigh: 108, confidence: 0.65, ma5: 102, ma10: 101, ma20: 100, bollUpper: 109, bollMiddle: 102, bollLower: 95 },
    { day: '2026-09-11', open: 106, high: 109, low: 104, close: 108, rangeLow: 103, rangeHigh: 110, confidence: 0.6, ma5: 103, ma10: 102, ma20: 101, bollUpper: 110, bollMiddle: 103, bollLower: 96 },
  ],
}

type PredictionClient = {
  prediction(symbol: string, signal?: AbortSignal): Promise<PredictionSnapshot>
}

describe('browserMarketClient.prediction', () => {
  afterEach(() => vi.unstubAllGlobals())

  test('requests the day prediction through the market BFF', async () => {
    const signal = new AbortController().signal
    const fetcher = vi.fn(async () => new Response(JSON.stringify(prediction), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)

    expect(browserMarketClient).toHaveProperty('prediction', expect.any(Function))
    const result = await (browserMarketClient as typeof browserMarketClient & PredictionClient).prediction('600519', signal)

    expect(result).toEqual(prediction)
    expect(fetcher).toHaveBeenCalledWith('/api/market/stocks/600519/prediction?period=day', {
      signal,
      headers: { Accept: 'application/json' },
    })
  })

  test.each([
    ['malformed payload', { ...prediction, days: prediction.days.slice(0, 2) }],
    ['different symbol', { ...prediction, symbol: '000001' }],
    ['different period', { ...prediction, period: 'week' }],
  ])('rejects a %s', async (_name, payload) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })))

    expect(browserMarketClient).toHaveProperty('prediction', expect.any(Function))
    await expect((browserMarketClient as typeof browserMarketClient & PredictionClient).prediction('600519')).rejects.toThrow('Invalid prediction response')
  })
})

describe('browserMarketClient.publishedRules', () => {
  afterEach(() => vi.unstubAllGlobals())

  test('excludes enabled server rules without a complete computable condition', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([
      { id: 'empty', name: '空条件', enabled: true, action: 'ENTER', conditions: [] },
      { id: 'valid', name: '站上 MA5', enabled: true, action: 'ENTER', conditions: [{ field: 'closeAboveMa5', operator: 'equals', value: 1 }] },
    ]), { status: 200 })))

    const rules = await browserMarketClient.publishedRules?.()

    expect(rules?.map((rule) => rule.ruleId)).toEqual(['valid'])
  })
})
