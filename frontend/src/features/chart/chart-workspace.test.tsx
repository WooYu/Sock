import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { ChartWorkspace } from './chart-workspace'
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

  test('switches the active K-line period', async () => {
    renderChart()
    await userEvent.click(screen.getByRole('tab', { name: '周线' }))
    expect(screen.getByRole('tab', { name: '周线' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '日线' })).toHaveAttribute('aria-selected', 'false')
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
