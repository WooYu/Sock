import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { ChartWorkspace, aggregateCandles } from './chart-workspace'
import type { MarketSnapshot } from '../workspace/stock-workspace-types'
import type { PredictionSnapshot } from './chart-types'
import { DrawingEngine } from './drawing-engine'

const snapshot: MarketSnapshot = {
  quote: { security: { code: '600519', name: '贵州茅台' }, price: 1450, previousClose: 1440 },
  dailyCandles: Array.from({ length: 42 }, (_, index) => ({ day: `2026-08-${String(index + 1).padStart(2, '0')}`, open: 1400 + index, high: 1410 + index, low: 1390 + index, close: 1405 + index, volume: 1000 + index })),
  source: { name: 'test-market', fetchedAt: '2026-09-01T00:00:00Z', state: 'LIVE', online: true },
}

const prediction: PredictionSnapshot = {
  symbol: '600519', period: 'day', generatedAt: '2026-09-07T00:00:00Z', modelVersion: 'baseline-v1',
  days: [
    { day: '2026-09-08', open: 1450, high: 1460, low: 1440, close: 1455, rangeLow: 1438, rangeHigh: 1462, confidence: 0.8, ma5: 1448, ma10: 1440, ma20: 1430, bollUpper: 1470, bollMiddle: 1430, bollLower: 1390 },
    { day: '2026-09-09', open: 1455, high: 1465, low: 1445, close: 1460, rangeLow: 1443, rangeHigh: 1467, confidence: 0.7, ma5: 1452, ma10: 1444, ma20: 1433, bollUpper: 1474, bollMiddle: 1433, bollLower: 1392 },
    { day: '2026-09-10', open: 1460, high: 1470, low: 1450, close: 1465, rangeLow: 1448, rangeHigh: 1472, confidence: 0.6, ma5: 1456, ma10: 1448, ma20: 1436, bollUpper: 1478, bollMiddle: 1436, bollLower: 1394 },
  ],
}

const renderChart = () => render(<ChartWorkspace prediction={prediction} snapshot={snapshot} />)

describe('ChartWorkspace', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  test('shows loading feedback before chart data arrives', () => {
    render(<ChartWorkspace snapshot={null} status="loading" />)

    expect(screen.getByRole('status')).toHaveTextContent('正在加载真实行情')
    expect(screen.queryByText('真实行情暂不可用')).not.toBeInTheDocument()
  })

  test('exposes the redesigned chart workspace regions', () => {
    const { container } = renderChart()

    expect(container.querySelector('.sc-kline-terminal')).toBeInTheDocument()
    expect(container.querySelector('.sc-kline-summary')).toBeInTheDocument()
    expect(container.querySelector('.sc-kline-control-card')).toBeInTheDocument()
    expect(container.querySelector('.sc-kline-content')).toBeInTheDocument()
  })

  test('selecting a drawing tool clears the previous drawing tool', async () => {
    renderChart()
    await userEvent.click(screen.getByRole('button', { name: '趋势线' }))
    await userEvent.click(screen.getByRole('button', { name: '矩形' }))
    expect(screen.getByRole('button', { name: '矩形' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '趋势线' })).toHaveAttribute('aria-pressed', 'false')
  })

  test('hides derived key levels without changing real candles', async () => {
    renderChart()
    await userEvent.click(screen.getByRole('switch', { name: '关键位' }))
    expect(screen.queryByTestId('key-level-layer')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'K线主图' })).toBeInTheDocument()
  })

  test('creates a rectangle and can undo it', async () => {
    renderChart()
    await userEvent.click(screen.getByRole('button', { name: '矩形' }))
    await userEvent.click(screen.getByRole('button', { name: '添加矩形标注' }))
    expect(screen.getByTestId('annotation-rectangle')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '撤销' }))
    expect(screen.queryByTestId('annotation-rectangle')).not.toBeInTheDocument()
  })

  test('offers secondary drawing tools in the sample-style menu', async () => {
    renderChart()
    await userEvent.click(screen.getByText('更多绘图', { selector: 'summary' }))
    await userEvent.click(screen.getByRole('button', { name: '水平线' }))

    expect(screen.getByRole('button', { name: '水平线' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('opens a compact mobile tools sheet with the existing drawing controls', async () => {
    renderChart()
    await userEvent.click(screen.getByRole('button', { name: '图表工具' }))

    expect(screen.getByRole('dialog', { name: '图表工具' })).toBeVisible()
    expect(screen.getByRole('dialog', { name: '图表工具' })).toHaveTextContent('指标设置')
  })

  test('creates a point annotation by clicking the chart', async () => {
    renderChart()
    await userEvent.click(screen.getByText('更多绘图', { selector: 'summary' }))
    await userEvent.click(screen.getByRole('button', { name: '买入点' }))
    await userEvent.click(screen.getByRole('img', { name: 'K线主图' }))

    expect(screen.getByTestId('annotation-buy')).toHaveTextContent('价格')
  })

  test('commits a selected drawing body drag through DrawingEngine.move once', async () => {
    const move = vi.spyOn(DrawingEngine.prototype, 'move')
    renderChart()
    await userEvent.click(screen.getByText('更多绘图', { selector: 'summary' }))
    await userEvent.click(screen.getByRole('button', { name: '买入点' }))
    fireEvent.click(screen.getByRole('img', { name: 'K线主图' }), { clientX: 100, clientY: 170 })
    const hitArea = screen.getAllByTestId('drawing-hit-area').at(-1)!
    Object.assign(hitArea, { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() })

    fireEvent.pointerDown(hitArea, { pointerId: 12, clientX: 100, clientY: 170 })
    fireEvent.pointerUp(hitArea, { pointerId: 12, clientX: 120, clientY: 180 })

    expect(move).toHaveBeenCalledOnce()
    move.mockRestore()
  })

  test('deletes, restores and re-deletes the selected drawing with keyboard shortcuts', async () => {
    renderChart()
    await userEvent.click(screen.getByText('更多绘图', { selector: 'summary' }))
    await userEvent.click(screen.getByRole('button', { name: '买入点' }))
    fireEvent.click(screen.getByRole('img', { name: 'K线主图' }), { clientX: 100, clientY: 170 })
    const chart = screen.getByRole('img', { name: 'K线主图' })

    fireEvent.keyDown(chart, { key: 'Delete' })
    expect(screen.queryByTestId('annotation-buy')).not.toBeInTheDocument()
    fireEvent.keyDown(chart, { key: 'z', ctrlKey: true })
    expect(screen.getByTestId('annotation-buy')).toBeInTheDocument()
    fireEvent.keyDown(chart, { key: 'y', metaKey: true })
    expect(screen.queryByTestId('annotation-buy')).not.toBeInTheDocument()
  })

  test('switches the active K-line period', async () => {
    renderChart()
    await userEvent.click(screen.getByRole('tab', { name: '周线' }))
    expect(screen.getByRole('tab', { name: '周线' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '日线' })).toHaveAttribute('aria-selected', 'false')
  })

  test('aggregates weekly and monthly candles on calendar boundaries', () => {
    const candles = [
      { day: '2026-08-28', open: 10, high: 12, low: 9, close: 11, volume: 1 },
      { day: '2026-08-31', open: 11, high: 13, low: 10, close: 12, volume: 2 },
      { day: '2026-09-01', open: 12, high: 14, low: 11, close: 13, volume: 3 },
    ]

    expect(aggregateCandles(candles, 'week')).toHaveLength(2)
    expect(aggregateCandles(candles, 'month')).toHaveLength(2)
    expect(aggregateCandles(candles, 'week')[1]).toMatchObject({ day: '2026-08-31', open: 11, close: 13, volume: 5 })
  })

  test('follows the pointer with a crosshair data tooltip', async () => {
    renderChart()
    await userEvent.click(screen.getByRole('button', { name: '十字光标' }))
    fireEvent.pointerMove(screen.getByRole('img', { name: 'K线主图' }), { clientX: 420, clientY: 180 })

    expect(screen.getByTestId('crosshair-layer')).toBeInTheDocument()
    expect(screen.getByTestId('crosshair-tooltip')).toHaveTextContent('开')
    expect(screen.getByTestId('crosshair-tooltip')).toHaveTextContent('BOLL')
  })

  test('toggles indicators independently', async () => {
    renderChart()
    await userEvent.click(screen.getByRole('switch', { name: 'MA5' }))
    expect(screen.getByRole('switch', { name: 'MA5' })).not.toBeChecked()
    expect(screen.getByRole('switch', { name: 'BOLL' })).toBeChecked()
  })

  test('changes chart zoom without changing the selected period', async () => {
    renderChart()
    expect(screen.getByText('100%')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '放大' }))
    expect(screen.getByText('110%')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '日线' })).toHaveAttribute('aria-selected', 'true')
  })

  test('renders the real chart structure and source status', () => {
    renderChart()
    expect(screen.getByRole('img', { name: 'K线主图' })).toBeInTheDocument()
    expect(screen.getByText('数据源：test-market')).toBeInTheDocument()
  })

  test('renders the three-session prediction separately from historical candles', () => {
    renderChart()
    expect(screen.getAllByTestId('prediction-candle')).toHaveLength(3)
    expect(screen.getByTestId('prediction-boundary')).toBeInTheDocument()
  })
})
