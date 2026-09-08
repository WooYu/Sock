import { describe, expect, test } from 'vitest'
import { isPredictionSnapshot, migrateWorkspace } from './chart-types'

describe('chart contracts', () => {
  const predictionDay = (day: string) => ({
    day,
    open: 11, high: 13, low: 10, close: 12,
    rangeLow: 10, rangeHigh: 13, confidence: 0.6,
    ma5: 11, ma10: 11, ma20: 11, bollUpper: 13, bollMiddle: 11, bollLower: 9,
  })

  test('accepts exactly three ordered prediction days', () => {
    expect(isPredictionSnapshot({
      symbol: '600519',
      period: 'day',
      generatedAt: '2026-09-07T00:00:00Z',
      modelVersion: 'baseline-v1',
      days: [predictionDay('2026-09-07'), predictionDay('2026-09-08'), predictionDay('2026-09-09')],
    })).toBe(true)
  })

  test('rejects prediction days without finite indicator values', () => {
    const day = predictionDay('2026-09-07')
    const snapshot = { symbol: '600519', period: 'day', generatedAt: '2026-09-07T00:00:00Z', modelVersion: 'baseline-v1', days: [day, predictionDay('2026-09-08'), predictionDay('2026-09-09')] }
    const missingIndicator: Partial<typeof day> = { ...day }
    delete missingIndicator.ma5
    expect(isPredictionSnapshot({ ...snapshot, days: [missingIndicator, snapshot.days[1], snapshot.days[2]] })).toBe(false)
    expect(isPredictionSnapshot({ ...snapshot, days: [{ ...day, bollLower: Number.NaN }, snapshot.days[1], snapshot.days[2]] })).toBe(false)
  })

  test('requires canonical weekday sessions and leaves holiday validation to the backend', () => {
    const snapshot = { symbol: '600519', period: 'day', generatedAt: '2026-09-07T00:00:00Z', modelVersion: 'baseline-v1', days: [predictionDay('2026-09-07'), predictionDay('2026-09-08'), predictionDay('2026-09-09')] }
    expect(isPredictionSnapshot({ ...snapshot, days: [predictionDay('2026-09-010'), snapshot.days[1], snapshot.days[2]] })).toBe(false)
    expect(isPredictionSnapshot({ ...snapshot, days: [predictionDay('2026-09-12'), predictionDay('2026-09-14'), predictionDay('2026-09-15')] })).toBe(false)
  })

  test('migrates legacy pixel drawings without pretending coordinates are prices', () => {
    const result = migrateWorkspace({ version: 1, drawings: [{ id: 'old', kind: 'horizontal-line', start: { x: 10, y: 20 } }] })
    expect(result.version).toBe(2)
    expect(result.drawings).toEqual([])
    expect(result.legacyDrawingsDiscarded).toBe(1)
  })

  test('preserves valid drawings when migrating an already-versioned workspace', () => {
    const drawing = { id: 'line-1', symbol: '600519', period: 'day' as const, kind: 'text' as const, points: [{ time: '2026-09-07', price: 100 }], style: { color: '#f00', width: 1, lineStyle: 'solid' as const, opacity: 1 }, text: 'entry', locked: false, visible: true, version: 1, updatedAt: '2026-09-07T00:00:00Z' }
    const result = migrateWorkspace({ version: 2, symbol: '600519', period: 'day', drawings: [drawing] })
    expect(result.drawings).toEqual([drawing])
    expect(result.legacyDrawingsDiscarded).toBe(0)
  })

  test('discards v2 drawings with unsupported kinds or non-string text', () => {
    const base = { id: 'line-1', symbol: '600519', period: 'day' as const, kind: 'horizontal-line' as const, points: [{ time: '2026-09-07', price: 100 }], style: { color: '#f00', width: 1, lineStyle: 'solid' as const, opacity: 1 }, locked: false, visible: true, version: 1, updatedAt: '2026-09-07T00:00:00Z' }
    const result = migrateWorkspace({ version: 2, symbol: '600519', period: 'day', drawings: [{ ...base, kind: 'circle' }, { ...base, id: 'line-2', text: 123 }] })
    expect(result.drawings).toEqual([])
  })
})
