import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ChartWorkspace, aggregateCandles } from './chart-workspace'
import type { MarketSnapshot } from '../workspace/stock-workspace-types'
import type { PredictionSnapshot } from './chart-types'
import { DrawingEngine } from './drawing-engine'
import { loadChartSyncQueue, loadChartWorkspace, saveChartWorkspace } from './chart-workspace-sync'
import { drawingFixture, workspaceFixture } from './chart-workspace-test-fixtures'

const snapshot: MarketSnapshot = {
  quote: { security: { code: '600519', name: '贵州茅台' }, price: 1450, previousClose: 1440 },
  dailyCandles: Array.from({ length: 42 }, (_, index) => ({ day: new Date(Date.UTC(2026, 6, 20 + index)).toISOString().slice(0, 10), open: 1400 + index, high: 1410 + index, low: 1390 + index, close: 1405 + index, volume: 1000 + index })),
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
  test('persists only completed commands and keeps an empty switched period isolated', async () => {
    const { rerender } = renderChart()
    expect(loadChartWorkspace('600519', 'day')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: '买入点' }))
    fireEvent.click(screen.getByRole('img', { name: 'K线主图' }), { clientX: 100, clientY: 170 })
    const saved = localStorage.getItem('stockcal:chart-workspace:600519:day')
    expect(loadChartSyncQueue()).toHaveLength(1)
    fireEvent.pointerMove(screen.getByRole('img', { name: 'K线主图' }), { clientX: 120, clientY: 170 })
    rerender(<ChartWorkspace prediction={prediction} snapshot={{ ...snapshot }} />)
    expect(localStorage.getItem('stockcal:chart-workspace:600519:day')).toBe(saved)
    expect(loadChartSyncQueue()).toHaveLength(1)
    await userEvent.click(screen.getByRole('tab', { name: '周线' }))
    expect(screen.queryByTestId('annotation-buy')).not.toBeInTheDocument()
    expect(loadChartWorkspace('600519', 'week')).toBeNull()
    await userEvent.click(screen.getByRole('tab', { name: '日线' }))
    expect(screen.getByTestId('annotation-buy')).toBeInTheDocument()
    expect(loadChartSyncQueue()).toHaveLength(1)
  })
  beforeEach(() => {
    window.localStorage.clear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
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
    expect(container.querySelector('.sc-chart-left-tools')).toBeInTheDocument()
    expect(container.querySelector('.sc-chart-inspector')).toBeInTheDocument()
    expect(container.querySelector('.sc-prediction-details')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: '未来推演' })).toBeChecked()
    expect(screen.getByText('推演数据，不是实际行情')).toBeInTheDocument()
  })

  test('exposes five fixed mobile actions backed by real tools', () => {
    renderChart()
    const toolbar = screen.getByTestId('chart-mobile-toolbar')

    for (const name of ['选择', '趋势线', '水平线', '标记', '更多']) {
      expect(within(toolbar).getByRole('button', { name })).toBeInTheDocument()
    }
  })

  test('reveals a prediction that arrives after the historical chart', () => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(960)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(320)
    const { container, rerender } = render(<ChartWorkspace snapshot={snapshot} />)
    const scroll = container.querySelector<HTMLElement>('.sc-kline-chart-scroll')!

    rerender(<ChartWorkspace prediction={prediction} snapshot={snapshot} />)

    expect(scroll.scrollLeft).toBe(640)
  })

  test('respects an explicitly persisted zero pan position', () => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(960)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(320)
    saveChartWorkspace(workspaceFixture({ revision: 4, view: { zoom: 100, panX: 0, panY: 0 } }))
    const { container } = renderChart()

    expect(container.querySelector<HTMLElement>('.sc-kline-chart-scroll')!.scrollLeft).toBe(0)
  })

  test('reveals a selected prediction day after the user pans away', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(960)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(320)
    const { container } = renderChart()
    const scroll = container.querySelector<HTMLElement>('.sc-kline-chart-scroll')!
    scroll.scrollLeft = 0

    await userEvent.click(screen.getByRole('button', { name: /第2日/ }))

    expect(scroll.scrollLeft).toBeGreaterThan(500)
  })

  test('does not recenter a selected drawing when a completed pan persists', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(960)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(320)
    const drawing = drawingFixture({ points: [{ time: snapshot.dailyCandles[0].day, price: snapshot.dailyCandles[0].close }] })
    saveChartWorkspace(workspaceFixture({ drawings: [drawing], revision: 2 }))
    const { container, rerender } = renderChart()
    const scroll = container.querySelector<HTMLElement>('.sc-kline-chart-scroll')!
    fireEvent.click(screen.getByTestId('drawing-hit-area'))
    scroll.scrollLeft = 100
    await userEvent.click(within(screen.getByRole('complementary', { name: '桌面绘图工具' })).getByRole('button', { name: '平移' }))
    const chart = screen.getByRole('img', { name: 'K线主图' })
    Object.assign(chart, { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() })

    fireEvent.pointerDown(screen.getByTestId('drawing-hit-area'), { pointerId: 22, clientX: 220, clientY: 140 })
    fireEvent.pointerMove(chart, { pointerId: 22, clientX: 170, clientY: 140 })
    fireEvent.pointerUp(chart, { pointerId: 22, clientX: 170, clientY: 140 })

    expect(scroll.scrollLeft).toBe(150)
    expect(loadChartWorkspace('600519', 'day')?.view.panX).toBe(150)
    rerender(<ChartWorkspace prediction={prediction} snapshot={{ ...snapshot, dailyCandles: snapshot.dailyCandles.map((candle) => ({ ...candle })) }} />)
    expect(scroll.scrollLeft).toBe(150)
  })

  test('selecting a drawing tool clears the previous drawing tool', async () => {
    renderChart()
    const desktopTools = screen.getByRole('complementary', { name: '桌面绘图工具' })
    await userEvent.click(within(desktopTools).getByRole('button', { name: '趋势线' }))
    await userEvent.click(within(desktopTools).getByRole('button', { name: '矩形' }))
    expect(within(desktopTools).getByRole('button', { name: '矩形' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(desktopTools).getByRole('button', { name: '趋势线' })).toHaveAttribute('aria-pressed', 'false')
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
    const desktopTools = screen.getByRole('complementary', { name: '桌面绘图工具' })
    await userEvent.click(screen.getByText('更多绘图', { selector: 'summary' }))
    await userEvent.click(within(desktopTools).getByRole('button', { name: '水平线' }))

    expect(within(desktopTools).getByRole('button', { name: '水平线' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('offers trade markers as explicit toolbar actions', () => {
    renderChart()

    expect(screen.getByRole('button', { name: '买入点' })).toBeVisible()
    expect(screen.getByRole('button', { name: '卖出点' })).toBeVisible()
    expect(screen.getByRole('button', { name: '目标位' })).toBeVisible()
    expect(screen.getByRole('button', { name: '止损位' })).toBeVisible()
  })

  test('opens an accessible mobile tools sheet and restores focus on Escape', async () => {
    renderChart()
    const trigger = within(screen.getByTestId('chart-mobile-toolbar')).getByRole('button', { name: '更多' })
    await userEvent.click(trigger)

    expect(screen.getByRole('dialog', { name: '更多图表工具' })).toBeVisible()
    expect(screen.getByRole('dialog', { name: '更多图表工具' })).toHaveTextContent('指标设置')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: '更多图表工具' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  test('opens prediction details in a mobile dialog', async () => {
    renderChart()
    await userEvent.click(screen.getByRole('button', { name: '预测详情' }))

    const dialog = screen.getByRole('dialog', { name: '预测详情' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(within(dialog).getByRole('tabpanel')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: '拖动关闭预测详情' })).toBeInTheDocument()
  })

  test('uses the marker action to choose and create a real trade marker', async () => {
    renderChart()
    await userEvent.click(within(screen.getByTestId('chart-mobile-toolbar')).getByRole('button', { name: '标记' }))
    const picker = screen.getByRole('dialog', { name: '标记类型' })
    await userEvent.click(within(picker).getByRole('button', { name: '买入点' }))
    await userEvent.click(screen.getByRole('img', { name: 'K线主图' }))

    expect(screen.getByTestId('annotation-buy')).toBeInTheDocument()
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
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    renderChart()
    await userEvent.click(screen.getByText('更多绘图', { selector: 'summary' }))
    await userEvent.click(screen.getByRole('button', { name: '买入点' }))
    fireEvent.click(screen.getByRole('img', { name: 'K线主图' }), { clientX: 100, clientY: 170 })
    const chart = screen.getByRole('img', { name: 'K线主图' })

    fireEvent.keyDown(chart, { key: 'Delete' })
    expect(screen.getByTestId('annotation-buy')).toBeInTheDocument()
    fireEvent.keyDown(chart, { key: 'Backspace' })
    expect(screen.queryByTestId('annotation-buy')).not.toBeInTheDocument()
    fireEvent.keyDown(chart, { key: 'z', ctrlKey: true })
    expect(screen.getByTestId('annotation-buy')).toBeInTheDocument()
    fireEvent.keyDown(chart, { key: 'y', metaKey: true })
    expect(screen.queryByTestId('annotation-buy')).not.toBeInTheDocument()
    expect(confirm).toHaveBeenCalledTimes(2)
    confirm.mockRestore()
  })

  test('uses the same confirmation handler for inspector deletion', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    renderChart()
    await userEvent.click(screen.getByRole('button', { name: '买入点' }))
    fireEvent.click(screen.getByRole('img', { name: 'K线主图' }), { clientX: 100, clientY: 170 })

    await userEvent.click(screen.getByRole('button', { name: '删除对象' }))
    expect(screen.getByTestId('annotation-buy')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '删除对象' }))

    expect(screen.queryByTestId('annotation-buy')).not.toBeInTheDocument()
    expect(confirm).toHaveBeenCalledTimes(2)
    confirm.mockRestore()
  })

  test('copies the selected drawing from the inspector', async () => {
    renderChart()
    await userEvent.click(screen.getByRole('button', { name: '买入点' }))
    fireEvent.click(screen.getByRole('img', { name: 'K线主图' }), { clientX: 100, clientY: 170 })

    await userEvent.click(screen.getByRole('button', { name: '复制对象' }))

    expect(screen.getAllByTestId('annotation-buy')).toHaveLength(2)
  })

  test('switches the active K-line period', async () => {
    renderChart()
    await userEvent.click(screen.getByRole('tab', { name: '周线' }))
    expect(screen.getByRole('tab', { name: '周线' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '日线' })).toHaveAttribute('aria-selected', 'false')
  })

  test('shows an honest unavailable state for non-daily predictions', async () => {
    renderChart()
    await userEvent.click(screen.getByRole('tab', { name: '周线' }))

    expect(screen.getByText('未来推演仅支持日线周期')).toBeInTheDocument()
    expect(screen.queryByTestId('prediction-candle')).not.toBeInTheDocument()
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
    await userEvent.click(within(screen.getByLabelText('视图控制')).getByRole('button', { name: '十字光标' }))
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

  test('links prediction detail selection to the matching chart candle', async () => {
    renderChart()

    await userEvent.click(screen.getByRole('button', { name: /第2日/ }))

    expect(screen.getAllByTestId('prediction-candle')[1]).toHaveAttribute('data-active', 'true')
  })

  test('links a hovered prediction candle to the matching detail day', () => {
    renderChart()
    const secondCandle = screen.getAllByTestId('prediction-candle')[1]

    fireEvent.mouseEnter(secondCandle)

    expect(screen.getByRole('button', { name: /第2日/ })).toHaveAttribute('aria-pressed', 'true')
  })

  test('restores a conflict recovery record as a fresh copy without removing evidence', async () => {
    const recovered = drawingFixture({ id: 'deleted-line', text: '冲突副本', version: 7, restoredFromVersion: 6 })
    saveChartWorkspace(workspaceFixture({
      deletions: [{ id: 'deleted-line', version: 8, updatedAt: '2026-09-08T00:00:00Z' }],
      recovery: [{ id: 'deleted-line', reason: 'DELETE_EDIT_CONFLICT', drawing: recovered }],
    }))
    renderChart()

    await userEvent.click(screen.getByRole('button', { name: '恢复副本' }))

    const saved = loadChartWorkspace('600519', 'day')!
    expect(saved.drawings).toHaveLength(1)
    expect(saved.drawings[0]).toMatchObject({ text: '冲突副本', locked: false, visible: true })
    expect(saved.drawings[0].id).not.toBe('deleted-line')
    expect(saved.drawings[0]).not.toHaveProperty('restoredFromVersion')
    expect(saved.recovery).toEqual([{ id: 'deleted-line', reason: 'DELETE_EDIT_CONFLICT', drawing: recovered }])
    expect(saved.deletions).toEqual([{ id: 'deleted-line', version: 8, updatedAt: '2026-09-08T00:00:00Z' }])
  })
})
