import { describe, expect, test } from 'vitest'
import { createChartTransform } from './chart-coordinates'

describe('createChartTransform', () => {
  test('round trips time and price independent of viewport size', () => {
    const transform = createChartTransform({
      times: ['2026-09-01', '2026-09-02', '2026-09-03'],
      minPrice: 10,
      maxPrice: 20,
      rect: { left: 40, top: 20, width: 900, height: 300 },
    })

    expect(transform.timeForX(transform.xForTime('2026-09-02'))).toBe('2026-09-02')
    expect(transform.priceForY(transform.yForPrice(15))).toBeCloseTo(15, 6)
  })

  test('clamps x and y inputs to the chart rect', () => {
    const transform = createChartTransform({
      times: ['first', 'middle', 'last'],
      minPrice: 10,
      maxPrice: 20,
      rect: { left: 40, top: 20, width: 900, height: 300 },
    })

    expect(transform.timeForX(-1_000)).toBe('first')
    expect(transform.timeForX(10_000)).toBe('last')
    expect(transform.priceForY(-1_000)).toBe(20)
    expect(transform.priceForY(10_000)).toBe(10)
  })

  test('rejects empty time domains and non-increasing price domains', () => {
    expect(() => createChartTransform({
      times: [],
      minPrice: 10,
      maxPrice: 20,
      rect: { left: 0, top: 0, width: 100, height: 100 },
    })).toThrow('Chart transform requires at least one time')
    expect(() => createChartTransform({
      times: ['2026-09-01'],
      minPrice: 10,
      maxPrice: 10,
      rect: { left: 0, top: 0, width: 100, height: 100 },
    })).toThrow('Chart transform requires maxPrice greater than minPrice')
  })
})
