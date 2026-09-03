import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { ChartWorkspace, aggregateCandles } from './chart-workspace'
import type { MarketSnapshot } from '../workspace/stock-workspace-types'

const snapshot: MarketSnapshot = {
  quote: { security: { code: '600519', name: '贵州茅台' }, price: 1450, previousClose: 1440 },
  dailyCandles: Array.from({ length: 42 }, (_, index) => ({ day: `2026-08-${String(index + 1).padStart(2, '0')}`, open: 1400 + index, high: 1410 + index, low: 1390 + index, close: 1405 + index, volume: 1000 + index })),
  source: { name: 'test-market', fetchedAt: '2026-09-01T00:00:00Z', state: 'LIVE', online: true },
}

const renderChart = () => render(<ChartWorkspace snapshot={snapshot} />)

describe('ChartWorkspace', () => {
  test('shows loading feedback before chart data arrives', () => {
    render(<ChartWorkspace snapshot={null} status="loading" />)

    expect(screen.getByRole('status')).toHaveTextContent('正在加载真实行情')
    expect(screen.queryByText('真实行情暂不可用')).not.toBeInTheDocument()
  })

  test('exposes the redesigned chart workspace regions', () => {
    const { container } = renderChart()

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

  test('creates a point annotation by clicking the chart', async () => {
    renderChart()
    await userEvent.click(screen.getByText('更多绘图', { selector: 'summary' }))
    await userEvent.click(screen.getByRole('button', { name: '买入点' }))
    await userEvent.click(screen.getByRole('img', { name: 'K线主图' }))

    expect(screen.getByTestId('annotation-buy')).toBeInTheDocument()
  })

  test('creates a marker by clicking the chart', async () => {
    renderChart()
    await userEvent.click(screen.getByRole('button', { name: '标记' }))
    await userEvent.click(screen.getByRole('img', { name: 'K线主图' }))

    expect(screen.getByTestId('annotation-marker')).toBeInTheDocument()
  })

  test('renders chart annotations as visible SVG geometry', async () => {
    const { container } = renderChart()
    await userEvent.click(screen.getByRole('button', { name: '矩形' }))
    await userEvent.click(screen.getByRole('button', { name: '添加矩形标注' }))

    expect(container.querySelector('svg [data-testid="annotation-rectangle"] rect')).toBeInTheDocument()
    expect(container.querySelector('.sc-kline-annotation')).not.toBeInTheDocument()
  })

  test('selects an annotation and exposes delete controls', async () => {
    renderChart()
    await userEvent.click(screen.getByRole('button', { name: '矩形' }))
    await userEvent.click(screen.getByRole('button', { name: '添加矩形标注' }))
    await userEvent.click(screen.getAllByTestId('annotation-rectangle').at(-1)!)

    expect(screen.getByRole('button', { name: '删除标注' })).toBeInTheDocument()
  })

  test('edits the text of a selected note annotation', async () => {
    renderChart()
    await userEvent.click(screen.getByText('更多绘图', { selector: 'summary' }))
    await userEvent.click(screen.getByRole('button', { name: '文字' }))
    await userEvent.click(screen.getByRole('img', { name: 'K线主图' }))
    await userEvent.click(screen.getAllByTestId('annotation-text').at(-1)!)

    const input = screen.getByRole('textbox', { name: '标注文字' })
    await userEvent.clear(input)
    await userEvent.type(input, '突破后观察')
    expect(screen.getByText('突破后观察')).toBeInTheDocument()
  })

  test('moves a selected annotation with the pointer tool', async () => {
    const { container } = renderChart()
    await userEvent.click(screen.getByRole('button', { name: '矩形' }))
    await userEvent.click(screen.getByRole('button', { name: '添加矩形标注' }))
    await userEvent.click(screen.getByRole('button', { name: '指针' }))
    const annotation = screen.getAllByTestId('annotation-rectangle').at(-1)!
    fireEvent.pointerDown(annotation, { pointerId: 1, clientX: 20, clientY: 20 })
    fireEvent.pointerMove(screen.getByRole('img', { name: 'K线主图' }), { pointerId: 1, clientX: 60, clientY: 50 })
    fireEvent.pointerUp(screen.getByRole('img', { name: 'K线主图' }), { pointerId: 1, clientX: 60, clientY: 50 })

    expect([...container.querySelectorAll('svg [data-testid="annotation-rectangle"] rect')].at(-1)).toHaveAttribute('x', '60')
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
})
