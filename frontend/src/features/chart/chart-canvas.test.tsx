import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { createChartTransform } from './chart-coordinates'
import { ChartCanvas } from './chart-canvas'
import type { PredictionSnapshot } from './chart-types'
import type { DrawingObject } from './chart-types'
import { MA_COLORS, MA_PERIODS, type IndicatorValues, type MaKey } from './chart-periods'
import type { Candle } from '../workspace/stock-workspace-types'

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

  test('reports drag distance while panning and commits once on release', () => {
    const onPan = vi.fn()
    const onPanEnd = vi.fn()
    render(<ChartCanvas {...baseProps} activeTool="pan" onPan={onPan} onPanEnd={onPanEnd} />)
    const chart = screen.getByRole('img', { name: 'K线主图' })
    Object.assign(chart, { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() })

    fireEvent.pointerDown(chart, { pointerId: 5, clientX: 240, clientY: 120 })
    fireEvent.pointerMove(chart, { pointerId: 5, clientX: 190, clientY: 120 })
    fireEvent.pointerUp(chart, { pointerId: 5, clientX: 170, clientY: 120 })

    expect(onPan).toHaveBeenCalledWith(50)
    expect(onPanEnd).toHaveBeenCalledOnce()
  })

  test('pans from a drawing hit area without moving the drawing', () => {
    const onMoveDrawing = vi.fn()
    const onPan = vi.fn()
    render(<ChartCanvas {...baseProps} activeTool="pan" drawings={[line]} onMoveDrawing={onMoveDrawing} onPan={onPan} />)
    const chart = screen.getByRole('img', { name: 'K线主图' })
    Object.assign(chart, { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() })

    fireEvent.pointerDown(screen.getByTestId('drawing-hit-area'), { pointerId: 6, clientX: 240, clientY: 120 })
    fireEvent.pointerMove(chart, { pointerId: 6, clientX: 190, clientY: 120 })

    expect(onPan).toHaveBeenCalledWith(50)
    expect(onMoveDrawing).not.toHaveBeenCalled()
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

  test('consumes the synthetic click after a completed gesture even when the tool switches to pointer', () => {
    const onCreateDrawing = vi.fn(), onSelectDrawing = vi.fn()
    const view = render(<ChartCanvas {...baseProps} activeTool="trend-line" onCreateDrawing={onCreateDrawing} onSelectDrawing={onSelectDrawing} />)
    const chart = screen.getByRole('img', { name: 'K线主图' })
    fireEvent.pointerDown(chart, { pointerId: 31, clientX: 143, clientY: 202 })
    fireEvent.pointerUp(chart, { pointerId: 31, clientX: 313, clientY: 172 })
    view.rerender(<ChartCanvas {...baseProps} activeTool="pointer" onCreateDrawing={onCreateDrawing} onSelectDrawing={onSelectDrawing} />)
    fireEvent.click(chart, { clientX: 313, clientY: 172 })
    expect(onCreateDrawing).toHaveBeenCalledOnce()
    expect(onSelectDrawing).not.toHaveBeenCalled()
  })

  test('shows crosshair values over a prediction session', () => {
    render(<ChartCanvas {...baseProps} crosshair />)
    const chart = screen.getByRole('img', { name: 'K线主图' })

    fireEvent.pointerMove(chart, { pointerId: 3, clientX: transform.xForTime('2026-09-09'), clientY: 172 })

    expect(screen.getByTestId('crosshair-tooltip')).toHaveTextContent('2026-09-09')
    expect(screen.getByTestId('crosshair-tooltip')).toHaveTextContent('开 104.00')
  })

  test('renders all eight enabled moving averages with finite coordinates and shared colors', () => {
    const values: IndicatorValues = { boll: { upper: [], middle: [], lower: [] } }
    const flags = { ...baseProps.indicators }
    for (const period of MA_PERIODS) {
      const key: MaKey = `ma${period}`
      values[key] = [99 + period / 100, 100 + period / 100]
      Object.assign(flags, { [key]: true })
    }
    const { container } = render(<ChartCanvas {...baseProps} prediction={null} indicatorValues={values} indicators={flags} />)
    const paths = container.querySelectorAll('[data-chart-layer="indicator"] [data-indicator] path')
    expect(paths).toHaveLength(8)
    for (const period of MA_PERIODS) {
      const key: MaKey = `ma${period}`
      const path = container.querySelector(`[data-indicator="${key}"] path`)!
      expect(path).toHaveAttribute('stroke', MA_COLORS[key])
      expect(path.getAttribute('d')).toMatch(/^M [-\d.]+ [-\d.]+ L [-\d.]+ [-\d.]+$/)
      expect(path.getAttribute('d')).not.toMatch(/NaN|Infinity|undefined|null/)
    }
  })

  test('treats absent legacy indicator flags as disabled', () => {
    const values: IndicatorValues = { ma5: [100, 101], ma30: [102, 103], ma250: [104, 105], boll: { upper: [], middle: [], lower: [] } }
    const { container } = render(<ChartCanvas {...baseProps} prediction={null} indicatorValues={values} indicators={{ ...baseProps.indicators, ma5: true }} />)
    expect(container.querySelector('[data-indicator="ma5"] path')).toBeInTheDocument()
    expect(container.querySelector('[data-indicator="ma30"]')).not.toBeInTheDocument()
    expect(container.querySelector('[data-indicator="ma250"]')).not.toBeInTheDocument()
  })

  test('omits null warmup points and starts a new segment after missing or non-finite values', () => {
    const samples = [...candles, ...prediction.days.map((candle) => ({ ...candle, volume: 500 }))]
    const values: IndicatorValues = { ma5: [null, 101, null, 103, 104], ma250: [null, null, null, null, null], ma60: [Number.NaN, 101, Number.POSITIVE_INFINITY, 103, 104], boll: { upper: [null, null, null, null, null], middle: [null, null, null, null, null], lower: [null, null, null, null, null] } }
    const { container } = render(<ChartCanvas {...baseProps} candles={samples} prediction={null} indicatorValues={values} indicators={{ ...baseProps.indicators, ma5: true, ma60: true, ma250: true, boll: true }} />)
    const expected = `M ${transform.xForTime(samples[1].day).toFixed(2)} ${transform.yForPrice(101).toFixed(2)} M ${transform.xForTime(samples[3].day).toFixed(2)} ${transform.yForPrice(103).toFixed(2)} L ${transform.xForTime(samples[4].day).toFixed(2)} ${transform.yForPrice(104).toFixed(2)}`
    expect(container.querySelector('[data-indicator="ma5"] path')).toHaveAttribute('d', expected)
    expect(container.querySelector('[data-indicator="ma60"] path')).toHaveAttribute('d', expected)
    expect(container.querySelector('[data-indicator="ma250"] path')).not.toBeInTheDocument()
    expect(container.querySelectorAll('[data-chart-layer="indicator"] path')).toHaveLength(2)
    expect(container.querySelector('[data-chart-layer="indicator"]')?.innerHTML).not.toMatch(/NaN|Infinity/)
  })

  test('keeps the forecast portion of nullable indicators dashed without joining across a gap', () => {
    const { container } = render(<ChartCanvas {...baseProps} indicators={{ ...baseProps.indicators, ma5: true }} indicatorValues={{ ma5: [null, 101, 102, null, 104], boll: { upper: [], middle: [], lower: [] } }} />)
    const predicted = screen.getByTestId('predicted-indicator-line')
    expect(predicted).toHaveAttribute('stroke-dasharray', '4 4')
    expect(predicted.getAttribute('d')?.match(/M /g)).toHaveLength(2)
    expect(container.querySelector('[data-indicator="ma5"] path:not([data-testid])')?.getAttribute('d')).toBe(`M ${transform.xForTime(candles[1].day).toFixed(2)} ${transform.yForPrice(101).toFixed(2)}`)
  })

  test('wraps all eight MA crosshair values into a bounded tooltip and reports missing values honestly', () => {
    const values: IndicatorValues = { boll: { upper: [null, 108], middle: [null, 101], lower: [null, 94] } }
    const flags = { ...baseProps.indicators, boll: true }
    for (const period of MA_PERIODS) { values[`ma${period}`] = [null, period === 250 ? null : 100 + period]; Object.assign(flags, { [`ma${period}`]: true }) }
    render(<ChartCanvas {...baseProps} prediction={null} crosshair indicatorValues={values} indicators={flags} />)
    fireEvent.pointerMove(screen.getByRole('img', { name: 'K线主图' }), { pointerId: 3, clientX: transform.xForTime(candles[1].day), clientY: 172 })
    const tooltip = screen.getByTestId('crosshair-tooltip')
    for (const period of MA_PERIODS) expect(tooltip).toHaveTextContent(`MA${period} `)
    expect(tooltip).toHaveTextContent('MA250 --')
    const bounds = tooltip.querySelector('rect')!
    const bottom = Number(bounds.getAttribute('y')) + Number(bounds.getAttribute('height'))
    for (const text of tooltip.querySelectorAll('text')) expect(Number(text.getAttribute('y'))).toBeLessThan(bottom)
    expect(Number(bounds.getAttribute('width'))).toBeLessThan(transform.rect.width)
  })

  const intraday: Candle[] = [
    { day: '2026-09-16T09:31:00+08:00', open: 10, high: 1000, low: 0, close: 10.1, volume: 1200, averagePrice: 10.05 },
    { day: '2026-09-16T09:32:00+08:00', open: 10, high: 1000, low: 0, close: 10.2, volume: 0 },
    { day: '2026-09-16T09:33:00+08:00', open: 10, high: 1000, low: 0, close: 10.15, volume: 800, averagePrice: 10.1 },
  ]
  const intradayTransform = createChartTransform({ times: intraday.map((candle) => candle.day), minPrice: 9.9, maxPrice: 10.3, rect: transform.rect })

  test('draws real intraday price and supplied VWAP with volume and previous-close reference instead of candles or MA overlays', () => {
    const { container } = render(<ChartCanvas {...baseProps} kind="intraday" period="intraday" candles={intraday} transform={intradayTransform} previousClose={10} indicators={{ ma5: true, ma10: true, ma20: true, boll: true }} />)
    expect(screen.getByRole('img', { name: '分时主图' })).toBeInTheDocument()
    expect(screen.queryByTestId('candlestick-layer')).not.toBeInTheDocument()
    expect(container.querySelector('[data-chart-layer="indicator"] path')).not.toBeInTheDocument()
    expect(screen.queryByTestId('prediction-region')).not.toBeInTheDocument()
    expect(screen.getByTestId('intraday-price-line')).toHaveAttribute('d', expect.stringContaining(`M ${intradayTransform.xForTime(intraday[0].day).toFixed(2)} ${intradayTransform.yForPrice(10.1).toFixed(2)}`))
    const average = screen.getByTestId('intraday-average-line')
    expect(average.getAttribute('d')?.match(/M /g)).toHaveLength(2)
    expect(average.getAttribute('d')).not.toContain('L ')
    expect(screen.getByTestId('previous-close-line')).toHaveAttribute('y1', String(intradayTransform.yForPrice(10)))
    expect(container.querySelectorAll('.sc-volume-bars rect')).toHaveLength(2)
  })

  test('intraday crosshair shows timestamp, price and supplied average without invented OHLC or VWAP', () => {
    const { container } = render(<ChartCanvas {...baseProps} kind="intraday" period="intraday" prediction={null} candles={intraday.map((candle) => ({ ...candle, averagePrice: undefined }))} transform={intradayTransform} crosshair />)
    const chart = screen.getByRole('img', { name: '分时主图' })
    fireEvent.pointerMove(chart, { pointerId: 3, clientX: intradayTransform.xForTime(intraday[1].day), clientY: 172 })
    const tooltip = screen.getByTestId('crosshair-tooltip')
    expect(tooltip).toHaveTextContent('2026-09-16 09:32 +08:00')
    expect(tooltip).toHaveTextContent('价格 10.20')
    expect(tooltip).toHaveTextContent('均价 --')
    expect(tooltip).not.toHaveTextContent(/开 |高 |低 |收 |MA5/)
    expect(screen.queryByTestId('intraday-average-line')).not.toBeInTheDocument()
    expect(screen.queryByTestId('previous-close-line')).not.toBeInTheDocument()
    expect(within(container.querySelector('[aria-label="交易时间"]') as HTMLElement).getByText('09:31')).toBeInTheDocument()
  })

  test('minute candles retain OHLC and include the Shanghai timestamp in the crosshair', () => {
    const minutes = intraday.map((candle, index) => ({ ...candle, day: `2026-09-16T09:${35 + index * 5}:00+08:00` }))
    const minuteTransform = createChartTransform({ times: minutes.map((candle) => candle.day), minPrice: 9.9, maxPrice: 10.3, rect: transform.rect })
    render(<ChartCanvas {...baseProps} period="5m" prediction={null} candles={minutes} transform={minuteTransform} crosshair />)
    fireEvent.pointerMove(screen.getByRole('img', { name: 'K线主图' }), { pointerId: 3, clientX: minuteTransform.xForTime(minutes[1].day), clientY: 172 })
    const tooltip = screen.getByTestId('crosshair-tooltip')
    expect(tooltip).toHaveTextContent('2026-09-16 09:40 +08:00')
    expect(tooltip).toHaveTextContent('开 10.00')
    expect(screen.getByTestId('candlestick-layer')).toBeInTheDocument()
  })

  test.each([
    ['month', '2026-09-01', '2026-09'],
    ['quarter', '2026-07-01', '2026 Q3'],
    ['year', '2026-01-01', '2026'],
  ] as const)('formats %s axes and tooltip with the corresponding calendar period', (period, time, label) => {
    const sample = [{ ...candles[0], day: time }]
    const calendarTransform = createChartTransform({ times: [time], minPrice: 90, maxPrice: 115, rect: transform.rect })
    const { container } = render(<ChartCanvas {...baseProps} candles={sample} transform={calendarTransform} period={period} prediction={null} crosshair />)
    expect(container.querySelector('[aria-label="交易日期"]')).toHaveTextContent(label)
    fireEvent.pointerMove(screen.getByRole('img', { name: 'K线主图' }), { pointerId: 3, clientX: calendarTransform.xForTime(time), clientY: 172 })
    expect(screen.getByTestId('crosshair-tooltip')).toHaveTextContent(label)
  })
})
