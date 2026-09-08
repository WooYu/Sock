import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { createChartTransform } from './chart-coordinates'
import { ChartCanvas } from './chart-canvas'
import type { PredictionSnapshot } from './chart-types'
import type { DrawingObject } from './chart-types'

const prediction: PredictionSnapshot = {
  symbol: '600519', period: 'day', generatedAt: '2026-09-07T00:00:00Z', modelVersion: 'baseline-v1',
  days: [
    { day: '2026-09-08', open: 101, high: 105, low: 99, close: 104, rangeLow: 98, rangeHigh: 106, confidence: 0.8, ma5: 101, ma10: 100, ma20: 99, bollUpper: 108, bollMiddle: 100, bollLower: 92 },
    { day: '2026-09-09', open: 104, high: 107, low: 102, close: 103, rangeLow: 100, rangeHigh: 108, confidence: 0.7, ma5: 102, ma10: 101, ma20: 100, bollUpper: 109, bollMiddle: 101, bollLower: 93 },
    { day: '2026-09-10', open: 103, high: 109, low: 101, close: 108, rangeLow: 100, rangeHigh: 110, confidence: 0.6, ma5: 104, ma10: 102, ma20: 101, bollUpper: 111, bollMiddle: 102, bollLower: 93 },
  ],
}

const candles = [
  { day: '2026-09-04', open: 98, high: 102, low: 97, close: 100, volume: 1000 },
  { day: '2026-09-07', open: 100, high: 103, low: 99, close: 101, volume: 1100 },
]

const transform = createChartTransform({ times: [...candles.map((candle) => candle.day), ...prediction.days.map((day) => day.day)], minPrice: 90, maxPrice: 115, rect: { left: 58, top: 22, width: 850, height: 300 } })

const line: DrawingObject = {
  id: 'line-1', symbol: '600519', period: 'day', kind: 'trend-line',
  points: [{ time: '2026-09-04', price: 100 }, { time: '2026-09-07', price: 104 }],
  style: { color: '#ef4444', width: 2, lineStyle: 'solid', opacity: 1 },
  locked: false, visible: true, version: 1, updatedAt: '2026-09-07T00:00:00Z',
}

const baseProps = {
  candles,
  prediction,
  transform,
  indicators: { ma5: false, ma10: false, ma20: false, boll: false },
  indicatorValues: { ma5: [], ma10: [], ma20: [], boll: { upper: [], middle: [], lower: [] } },
  keyLevels: [],
  showKeyLevels: false,
  drawings: [],
  showDrawings: true,
  selectedId: null,
  hoveredDay: null,
  crosshair: false,
  activeTool: 'pointer' as const,
  symbol: '600519',
  period: 'day' as const,
  onHoverDay: () => {},
  onSelectDrawing: () => {},
  onCreateDrawing: () => {},
  onMoveDrawing: () => {},
  onMovePoint: () => {},
}

describe('ChartCanvas', () => {
  test('owns the svg and renders chart layers in the required order', () => {
    const { container } = render(<ChartCanvas {...baseProps} />)

    expect(screen.getByRole('img', { name: 'K线主图' })).toBeInTheDocument()
    expect([...container.querySelectorAll('[data-chart-layer]')].map((node) => node.getAttribute('data-chart-layer'))).toEqual([
      'historical', 'indicator', 'prediction', 'drawing', 'crosshair',
    ])
  })

  test('converts pointer coordinates into a time-price drawing', () => {
    const onCreateDrawing = vi.fn()
    render(<ChartCanvas {...baseProps} activeTool="buy" onCreateDrawing={onCreateDrawing} />)

    fireEvent.click(screen.getByRole('img', { name: 'K线主图' }), { clientX: 480, clientY: 172 })

    expect(onCreateDrawing).toHaveBeenCalledOnce()
    expect(onCreateDrawing.mock.calls[0][0]).toMatchObject({ kind: 'buy', points: [{ time: '2026-09-08', price: 102.5 }] })
  })

  test('converts mobile letterboxed coordinates without vertical drift', () => {
    const onCreateDrawing = vi.fn()
    render(<ChartCanvas {...baseProps} activeTool="buy" onCreateDrawing={onCreateDrawing} />)
    const svg = screen.getByRole('img', { name: 'K线主图' })
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 320, height: 240, right: 320, bottom: 240, x: 0, y: 0, toJSON: () => ({}) })

    // A 960x430 viewBox meets a 320x240 viewport at 1/3 scale, leaving
    // 48.33px of vertical letterboxing. This maps to SVG point (480, 172).
    fireEvent.click(svg, { clientX: 160, clientY: 105.6666666667 })

    expect(onCreateDrawing.mock.calls[0][0].points[0].time).toBe('2026-09-08')
    expect(onCreateDrawing.mock.calls[0][0].points[0].price).toBeCloseTo(102.5)
  })

  test('uses the inverse SVG screen matrix when the browser supplies one', () => {
    const onCreateDrawing = vi.fn()
    render(<ChartCanvas {...baseProps} activeTool="buy" onCreateDrawing={onCreateDrawing} />)
    const svg = screen.getByRole('img', { name: 'K线主图' })
    Object.defineProperty(svg, 'getScreenCTM', {
      configurable: true,
      value: () => ({
        inverse: () => ({ a: 2, b: 0, c: 0, d: 2, e: -20, f: -10 }),
      }),
    })

    // The inverse CTM maps this client point to SVG point (480, 172).
    fireEvent.click(svg, { clientX: 250, clientY: 91 })

    expect(onCreateDrawing.mock.calls[0][0].points[0]).toMatchObject({ time: '2026-09-08' })
    expect(onCreateDrawing.mock.calls[0][0].points[0].price).toBeCloseTo(102.5)
  })

  test('selecting a drawing does not bubble into canvas deselection', () => {
    const onSelectDrawing = vi.fn()
    render(<ChartCanvas {...baseProps} drawings={[line]} onSelectDrawing={onSelectDrawing} />)

    fireEvent.pointerDown(screen.getByTestId('drawing-hit-area'))
    fireEvent.click(screen.getByTestId('drawing-hit-area'))

    expect(onSelectDrawing).toHaveBeenCalledWith('line-1')
    expect(onSelectDrawing).not.toHaveBeenCalledWith(null)
  })

  test('commits one whole-object chart-session move across Fri→Mon and Mon→Tue', () => {
    const onMoveDrawing = vi.fn()
    render(<ChartCanvas {...baseProps} drawings={[line]} onMoveDrawing={onMoveDrawing} selectedId="line-1" />)
    const hitArea = screen.getByTestId('drawing-hit-area')
    const setPointerCapture = vi.fn()
    const releasePointerCapture = vi.fn()
    Object.assign(hitArea, { setPointerCapture, releasePointerCapture })

    fireEvent.pointerDown(hitArea, { pointerId: 7, clientX: 143, clientY: 202 })
    fireEvent.pointerUp(hitArea, { pointerId: 7, clientX: 313, clientY: 172 })
    fireEvent.lostPointerCapture(hitArea, { pointerId: 7 })

    expect(setPointerCapture).toHaveBeenCalledWith(7)
    expect(releasePointerCapture).toHaveBeenCalledWith(7)
    expect(onMoveDrawing).toHaveBeenCalledOnce()
    expect(onMoveDrawing).toHaveBeenCalledWith('line-1', {
      timeIndexDelta: 1,
      priceDelta: 2.5,
      timeDomain: transform.times,
    })
  })

  test('is focusable and maps drawing-editor keyboard shortcuts', () => {
    const onDeleteSelected = vi.fn()
    const onRedo = vi.fn()
    const onSelectDrawing = vi.fn()
    const onUndo = vi.fn()
    render(<ChartCanvas {...baseProps} drawings={[line]} onDeleteSelected={onDeleteSelected} onRedo={onRedo} onSelectDrawing={onSelectDrawing} onUndo={onUndo} selectedId="line-1" />)
    const svg = screen.getByRole('img', { name: 'K线主图' })

    expect(svg).toHaveAttribute('tabindex', '0')
    fireEvent.keyDown(svg, { key: 'Delete' })
    fireEvent.keyDown(svg, { key: 'Escape' })
    fireEvent.keyDown(svg, { key: 'z', ctrlKey: true })
    fireEvent.keyDown(svg, { key: 'y', metaKey: true })

    expect(onDeleteSelected).toHaveBeenCalledOnce()
    expect(onSelectDrawing).toHaveBeenCalledWith(null)
    expect(onUndo).toHaveBeenCalledOnce()
    expect(onRedo).toHaveBeenCalledOnce()
  })

  test('focuses the editor after selecting a drawing before keyboard editing', () => {
    render(<ChartCanvas {...baseProps} drawings={[line]} selectedId="line-1" />)
    const svg = screen.getByRole('img', { name: 'K线主图' })

    fireEvent.pointerDown(screen.getByTestId('drawing-hit-area'), { pointerId: 21 })

    expect(document.activeElement).toBe(svg)
  })

  test('Escape cancels an active body drag before deselecting it', () => {
    const onMoveDrawing = vi.fn()
    const onSelectDrawing = vi.fn()
    render(<ChartCanvas {...baseProps} drawings={[line]} onMoveDrawing={onMoveDrawing} onSelectDrawing={onSelectDrawing} selectedId="line-1" />)
    const chart = screen.getByRole('img', { name: 'K线主图' })
    const hitArea = screen.getByTestId('drawing-hit-area')
    const releasePointerCapture = vi.fn()
    Object.assign(hitArea, { setPointerCapture: vi.fn(), releasePointerCapture })

    fireEvent.pointerDown(hitArea, { pointerId: 15, clientX: 143, clientY: 202 })
    fireEvent.keyDown(chart, { key: 'Escape' })
    fireEvent.pointerUp(hitArea, { pointerId: 15, clientX: 313, clientY: 172 })

    expect(releasePointerCapture).toHaveBeenCalledWith(15)
    expect(onSelectDrawing).toHaveBeenCalledWith(null)
    expect(onMoveDrawing).not.toHaveBeenCalled()
  })

  test('selects a visible marker label without starting the active drawing tool', () => {
    const marker = { ...line, kind: 'buy' as const, points: [line.points[0]] }
    const onCreateDrawing = vi.fn()
    const onMoveDrawing = vi.fn()
    const onSelectDrawing = vi.fn()
    render(<ChartCanvas {...baseProps} activeTool="rectangle" drawings={[marker]} onCreateDrawing={onCreateDrawing} onMoveDrawing={onMoveDrawing} onSelectDrawing={onSelectDrawing} />)
    const label = screen.getByTestId('annotation-buy').querySelector('text')!

    fireEvent.pointerDown(label, { pointerId: 14, clientX: 143, clientY: 202 })
    fireEvent.pointerUp(label, { pointerId: 14, clientX: 143, clientY: 202 })
    fireEvent.click(label, { clientX: 143, clientY: 202 })

    expect(onSelectDrawing).toHaveBeenCalledWith('line-1')
    expect(onMoveDrawing).not.toHaveBeenCalled()
    expect(onCreateDrawing).not.toHaveBeenCalled()
  })

  test('selects on pointer click without committing a zero-displacement move', () => {
    const onMoveDrawing = vi.fn()
    const onSelectDrawing = vi.fn()
    render(<ChartCanvas {...baseProps} drawings={[line]} onMoveDrawing={onMoveDrawing} onSelectDrawing={onSelectDrawing} selectedId="line-1" />)
    const hitArea = screen.getByTestId('drawing-hit-area')
    Object.assign(hitArea, { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() })

    fireEvent.pointerDown(hitArea, { pointerId: 8, clientX: 143, clientY: 202 })
    fireEvent.pointerUp(hitArea, { pointerId: 8, clientX: 143, clientY: 202 })

    expect(onSelectDrawing).toHaveBeenCalledWith('line-1')
    expect(onMoveDrawing).not.toHaveBeenCalled()
  })

  test('does not commit a handle move when its time-price point is unchanged', () => {
    const onMovePoint = vi.fn()
    render(<ChartCanvas {...baseProps} drawings={[line]} onMovePoint={onMovePoint} selectedId="line-1" />)
    const handle = screen.getAllByTestId('drawing-handle')[0]
    Object.assign(handle, { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() })

    fireEvent.pointerDown(handle, { pointerId: 9, clientX: 143, clientY: 202 })
    fireEvent.pointerUp(handle, { pointerId: 9, clientX: 143, clientY: 202 })

    expect(onMovePoint).not.toHaveBeenCalled()
  })

  test.each(['pointerCancel', 'lostPointerCapture'] as const)('cleans up an endpoint drag on %s', (cleanupEvent) => {
    const onMovePoint = vi.fn()
    render(<ChartCanvas {...baseProps} drawings={[line]} onMovePoint={onMovePoint} selectedId="line-1" />)
    const handle = screen.getAllByTestId('drawing-handle')[0]
    const releasePointerCapture = vi.fn()
    Object.assign(handle, { setPointerCapture: vi.fn(), releasePointerCapture })

    fireEvent.pointerDown(handle, { pointerId: 9, clientX: 143, clientY: 202 })
    fireEvent[cleanupEvent](handle, { pointerId: 9 })
    fireEvent.pointerUp(screen.getByRole('img', { name: 'K线主图' }), { pointerId: 9, clientX: 313, clientY: 172 })

    expect(onMovePoint).not.toHaveBeenCalled()
    if (cleanupEvent === 'pointerCancel') expect(releasePointerCapture).toHaveBeenCalledWith(9)
  })

  test('allows drawing tools to create inside the prediction background', () => {
    const onCreateDrawing = vi.fn()
    render(<ChartCanvas {...baseProps} activeTool="buy" onCreateDrawing={onCreateDrawing} />)

    fireEvent.click(screen.getByTestId('prediction-region'), { clientX: 650, clientY: 172 })

    expect(onCreateDrawing).toHaveBeenCalledOnce()
    expect(onCreateDrawing.mock.calls[0][0]).toMatchObject({ kind: 'buy' })
  })
})
