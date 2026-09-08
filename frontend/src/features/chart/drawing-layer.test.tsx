import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { createChartTransform } from './chart-coordinates'
import { DrawingLayer } from './drawing-layer'
import type { DrawingObject } from './chart-types'

const transform = createChartTransform({
  times: ['2026-09-07', '2026-09-08', '2026-09-09'],
  minPrice: 90,
  maxPrice: 120,
  rect: { left: 40, top: 20, width: 800, height: 300 },
})

const drawing = (patch: Partial<DrawingObject> = {}): DrawingObject => ({
  id: 'line-1',
  symbol: '600519',
  period: 'day',
  kind: 'trend-line',
  points: [{ time: '2026-09-07', price: 100 }, { time: '2026-09-09', price: 110 }],
  style: { color: '#ef4444', width: 2, lineStyle: 'solid', opacity: 0.8 },
  locked: false,
  visible: true,
  version: 1,
  updatedAt: '2026-09-07T00:00:00Z',
  ...patch,
})

describe('DrawingLayer', () => {
  test('shows handles only on the selected unlocked drawing', () => {
    const { rerender } = render(<svg><DrawingLayer drawings={[drawing()]} transform={transform} selectedId="line-1" onSelect={() => {}} onMovePoint={() => {}} /></svg>)
    expect(screen.getAllByTestId('drawing-handle')).toHaveLength(2)

    rerender(<svg><DrawingLayer drawings={[drawing({ locked: true })]} transform={transform} selectedId="line-1" onSelect={() => {}} onMovePoint={() => {}} /></svg>)
    expect(screen.queryByTestId('drawing-handle')).not.toBeInTheDocument()
  })

  test('uses a wide transparent hit area while preserving the configured visible width', () => {
    const onSelect = vi.fn()
    render(<svg><DrawingLayer drawings={[drawing()]} transform={transform} selectedId={null} onSelect={onSelect} onMovePoint={() => {}} /></svg>)

    expect(screen.getByTestId('drawing-visible-line')).toHaveAttribute('stroke-width', '2')
    expect(Number(screen.getByTestId('drawing-hit-area').getAttribute('stroke-width'))).toBeGreaterThanOrEqual(12)
    fireEvent.pointerDown(screen.getByTestId('drawing-hit-area'))
    expect(onSelect).toHaveBeenCalledWith('line-1')
  })

  test('starts body dragging for an unlocked object while still selecting it', () => {
    const onMoveDrawing = vi.fn()
    const onSelect = vi.fn()
    const { rerender } = render(<svg><DrawingLayer drawings={[drawing()]} transform={transform} selectedId={null} onMoveDrawing={onMoveDrawing} onSelect={onSelect} onMovePoint={() => {}} /></svg>)

    fireEvent.pointerDown(screen.getByTestId('drawing-hit-area'), { pointerId: 3 })
    expect(onSelect).toHaveBeenCalledWith('line-1')
    expect(onMoveDrawing).toHaveBeenCalledOnce()

    onMoveDrawing.mockClear()
    rerender(<svg><DrawingLayer drawings={[drawing({ locked: true })]} transform={transform} selectedId="line-1" onMoveDrawing={onMoveDrawing} onSelect={onSelect} onMovePoint={() => {}} /></svg>)
    fireEvent.pointerDown(screen.getByTestId('drawing-hit-area'), { pointerId: 4 })
    expect(onMoveDrawing).not.toHaveBeenCalled()
  })

  test('uses the visible rectangle interior as a draggable object body', () => {
    const onMoveDrawing = vi.fn()
    const onSelect = vi.fn()
    render(<svg><DrawingLayer drawings={[drawing({ kind: 'rectangle' })]} transform={transform} selectedId={null} onMoveDrawing={onMoveDrawing} onSelect={onSelect} onMovePoint={() => {}} /></svg>)

    const hitArea = screen.getByTestId('drawing-hit-area')
    expect(hitArea.tagName).toBe('rect')
    expect(hitArea).toHaveAttribute('pointer-events', 'all')
    expect(Number(hitArea.getAttribute('width'))).toBeGreaterThan(0)
    expect(Number(hitArea.getAttribute('height'))).toBeGreaterThan(0)
    fireEvent.pointerDown(hitArea, { pointerId: 7 })

    expect(onSelect).toHaveBeenCalledWith('line-1')
    expect(onMoveDrawing).toHaveBeenCalledOnce()
  })

  test.each([
    ['text', 'annotation-text'],
    ['buy', 'annotation-buy'],
  ] as const)('covers the rendered %s label with a draggable body hit target', (kind, testId) => {
    const onMoveDrawing = vi.fn()
    const onSelect = vi.fn()
    render(<svg><DrawingLayer drawings={[drawing({ kind, points: [{ time: '2026-09-08', price: 103 }], text: kind === 'text' ? '重要压力位' : undefined })]} transform={transform} selectedId={null} onMoveDrawing={onMoveDrawing} onSelect={onSelect} onMovePoint={() => {}} /></svg>)

    const object = screen.getByTestId(testId)
    const label = object.querySelector('text')!
    const hitArea = screen.getByTestId('drawing-hit-area')
    expect(hitArea.tagName).toBe('rect')
    expect(Number(hitArea.getAttribute('width'))).toBeGreaterThan(24)
    fireEvent.pointerDown(label, { pointerId: 8 })

    expect(onSelect).toHaveBeenCalledWith('line-1')
    expect(onMoveDrawing).toHaveBeenCalledOnce()
  })

  test('renders horizontal lines with a right-axis price label', () => {
    render(<svg><DrawingLayer drawings={[drawing({ kind: 'horizontal-line', points: [{ time: '2026-09-08', price: 103.25 }] })]} transform={transform} selectedId={null} onSelect={() => {}} onMovePoint={() => {}} /></svg>)

    expect(screen.getByTestId('drawing-price-label')).toHaveTextContent('103.25')
    expect(screen.getByTestId('drawing-price-label')).toHaveAttribute('fill', '#ef4444')
  })

  test('skips persisted drawings with times outside the transform domain', () => {
    render(<svg><DrawingLayer drawings={[drawing({ points: [{ time: '2026-08-01', price: 100 }, { time: '2026-09-09', price: 110 }] })]} transform={transform} selectedId="line-1" onSelect={() => {}} onMovePoint={() => {}} /></svg>)

    expect(screen.queryByTestId('drawing-object')).not.toBeInTheDocument()
    expect(screen.queryByTestId('drawing-handle')).not.toBeInTheDocument()
  })
})
