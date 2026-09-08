import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { createChartTransform } from './chart-coordinates'
import { PredictionLayer } from './prediction-layer'
import type { PredictionSnapshot } from './chart-types'

const prediction: PredictionSnapshot = {
  symbol: '600519',
  period: 'day',
  generatedAt: '2026-09-07T00:00:00Z',
  modelVersion: 'baseline-v1',
  days: [
    { day: '2026-09-08', open: 101, high: 105, low: 99, close: 104, rangeLow: 98, rangeHigh: 106, confidence: 0.8, ma5: 101, ma10: 100, ma20: 99, bollUpper: 108, bollMiddle: 100, bollLower: 92 },
    { day: '2026-09-09', open: 104, high: 107, low: 102, close: 103, rangeLow: 100, rangeHigh: 108, confidence: 0.7, ma5: 102, ma10: 101, ma20: 100, bollUpper: 109, bollMiddle: 101, bollLower: 93 },
    { day: '2026-09-10', open: 103, high: 109, low: 101, close: 108, rangeLow: 100, rangeHigh: 110, confidence: 0.6, ma5: 104, ma10: 102, ma20: 101, bollUpper: 111, bollMiddle: 102, bollLower: 93 },
  ],
}

const transform = createChartTransform({
  times: ['2026-09-07', ...prediction.days.map((day) => day.day)],
  minPrice: 90,
  maxPrice: 115,
  rect: { left: 40, top: 20, width: 800, height: 300 },
})

describe('PredictionLayer', () => {
  test('separates three predicted candles from real candles', () => {
    render(<svg><PredictionLayer prediction={prediction} transform={transform} hoveredDay={null} onHoverDay={() => {}} /></svg>)

    expect(screen.getByTestId('prediction-boundary')).toHaveAttribute('stroke-dasharray')
    expect(screen.getAllByTestId('prediction-candle')).toHaveLength(3)
    expect(screen.getByText('未来推演')).toBeInTheDocument()
    expect(screen.getAllByTestId('prediction-candle')[0]).toHaveAttribute('opacity', '0.55')
    expect(screen.getAllByTestId('prediction-candle')[0]).toHaveAttribute('stroke-dasharray', '4 3')
  })

  test('reports the hovered prediction day without exposing drawing edit events', () => {
    const onHoverDay = vi.fn()
    render(<svg><PredictionLayer prediction={prediction} transform={transform} hoveredDay={null} onHoverDay={onHoverDay} /></svg>)

    fireEvent.mouseEnter(screen.getAllByTestId('prediction-candle')[1])
    expect(onHoverDay).toHaveBeenCalledWith('2026-09-09')
    fireEvent.mouseLeave(screen.getAllByTestId('prediction-candle')[1])
    expect(onHoverDay).toHaveBeenLastCalledWith(null)
  })
})
