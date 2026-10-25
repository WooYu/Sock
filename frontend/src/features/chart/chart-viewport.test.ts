import { describe, expect, test } from 'vitest'
import { normalizeViewport, panViewport, viewportRange, zoomViewport } from './chart-viewport'

describe('continuous chart viewport', () => {
  test('keeps the candle under the cursor anchored when zooming', () => {
    const initial = { count: 80, offset: 100 }
    const next = zoomViewport(initial, 640, 0.8, 0.3)
    expect(640 - next.offset - next.count * 0.7).toBeCloseTo(640 - 100 - 80 * 0.7)
  })
  test('clamps panning at both history boundaries', () => {
    expect(viewportRange(panViewport({ count: 80, offset: 0 }, 640, -1000), 640)).toEqual({ start: 0, end: 80 })
    expect(viewportRange(panViewport({ count: 80, offset: 200 }, 640, 1000), 640)).toEqual({ start: 560, end: 640 })
  })
  test('retains fractional drag movement and handles short or empty history', () => {
    let view = { count: 80, offset: 0 }
    for (let i = 0; i < 10; i++) view = panViewport(view, 640, -0.1)
    expect(view.offset).toBeCloseTo(1)
    expect(normalizeViewport({ count: 80, offset: 100 }, 5)).toEqual({ count: 5, offset: 0 })
    expect(viewportRange({ count: 80, offset: 100 }, 0)).toEqual({ start: 0, end: 0 })
    expect(zoomViewport({ count: 12, offset: 0 }, 640, 0.1).count).toBe(12)
  })
})
