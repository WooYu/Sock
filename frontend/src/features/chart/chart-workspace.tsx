'use client'

import { useMemo, useState } from 'react'
import type { MarketSnapshot } from '../workspace/stock-workspace-types'
import type { WorkspaceStatus } from '../workspace/stock-workspace-types'
import { MarketFeedback, MarketLoadingState } from '../workspace/market-state'
import type { ChartTool } from './chart-annotation-store'
import { ChartLayerPanel, type ChartLayerState } from './chart-layer-panel'
import { ChartToolbar } from './chart-toolbar'
import { useChartWorkspace } from './use-chart-workspace'
import { createChartTransform } from './chart-coordinates'
import { aggregateCandles, bollinger, movingAverage } from './chart-math'
import type { ChartPeriod, DrawingObject, PredictionSnapshot, TimePricePoint } from './chart-types'
import type { DrawingMove } from './drawing-engine'
import { ChartCanvas } from './chart-canvas'
import { PredictionDetails } from './prediction-details'
import { ObjectInspector, type DrawingInspectorChange } from './object-inspector'

export { aggregateCandles } from './chart-math'

type IndicatorKey = 'ma5' | 'ma10' | 'ma20' | 'boll'

const periods: Array<[ChartPeriod, string]> = [['day', '日线'], ['week', '周线'], ['month', '月线']]
const indicatorOptions: Array<[IndicatorKey, string]> = [['ma5', 'MA5'], ['ma10', 'MA10'], ['ma20', 'MA20'], ['boll', 'BOLL']]
const indicatorColors: Record<IndicatorKey, string> = { ma5: '#d6a12a', ma10: '#4e9bd6', ma20: '#a46ee8', boll: '#6f7fd8' }

function priceText(value: number) {
  return value.toFixed(2)
}

export function ChartWorkspace({ snapshot, prediction = null, status = 'ready', errorMessage, onRetry }: { snapshot?: MarketSnapshot | null; prediction?: PredictionSnapshot | null; status?: WorkspaceStatus; errorMessage?: string | null; onRetry?: () => void }) {
  const [activeTool, setActiveTool] = useState<ChartTool>('pointer')
  const [activePeriod, setActivePeriod] = useState<ChartPeriod>('day')
  const { workspace, drawings, selectedId, syncStatus, commands } = useChartWorkspace({ symbol: snapshot?.quote.security.code ?? '', period: activePeriod })
  const indicators = { ma5: true, ma10: true, ma20: true, boll: true, ...workspace.indicators }
  const layers: ChartLayerState = { keyLevels: true, annotations: true, prediction: true, ...workspace.layers }
  const zoom = workspace.view.zoom
  const crosshair = workspace.crosshair
  const setIndicators = commands.setIndicators
  const setLayers = commands.setLayers
  const setCrosshair = commands.setCrosshair
  const setZoom = (update: number | ((value: number) => number)) => commands.setView((view) => ({ ...view, zoom: typeof update === 'function' ? update(view.zoom) : update }))
  const [hoveredDay, setHoveredDay] = useState<string | null>(null)
  const [selectedPredictionDay, setSelectedPredictionDay] = useState<string | null>(null)
  const [toolsOpen, setToolsOpen] = useState(false)

  const sourceCandles = useMemo(() => snapshot?.dailyCandles ?? [], [snapshot?.dailyCandles])
  const candles = useMemo(() => aggregateCandles(sourceCandles, activePeriod), [activePeriod, sourceCandles])
  const activePrediction = prediction?.period === activePeriod ? prediction : null
  const activePredictionDay = activePrediction?.days.some((day) => day.day === selectedPredictionDay) ? selectedPredictionDay : activePrediction?.days[0].day ?? null
  const movingAverages = useMemo(() => ({ ma5: movingAverage(candles, 5), ma10: movingAverage(candles, 10), ma20: movingAverage(candles, 20) }), [candles])
  const boll = useMemo(() => bollinger(candles, 20, 2), [candles])
  const indicatorValues = useMemo(() => ({
    ma5: [...movingAverages.ma5, ...(activePrediction?.days.map((day) => day.ma5) ?? [])],
    ma10: [...movingAverages.ma10, ...(activePrediction?.days.map((day) => day.ma10) ?? [])],
    ma20: [...movingAverages.ma20, ...(activePrediction?.days.map((day) => day.ma20) ?? [])],
    boll: {
      upper: [...boll.upper, ...(activePrediction?.days.map((day) => day.bollUpper) ?? [])],
      middle: [...boll.middle, ...(activePrediction?.days.map((day) => day.bollMiddle) ?? [])],
      lower: [...boll.lower, ...(activePrediction?.days.map((day) => day.bollLower) ?? [])],
    },
  }), [activePrediction, boll, movingAverages])
  const keyLevels = useMemo(() => candles.length ? [Math.max(...candles.slice(-20).map((candle) => candle.high)), Math.min(...candles.slice(-20).map((candle) => candle.low))] : [], [candles])
  const lastClose = candles[candles.length - 1]?.close ?? snapshot?.quote.price ?? 0
  const addRectangle = () => {
    const end = candles.at(-1)
    const start = candles.at(-2) ?? end
    if (!start || !end) return
    const drawing: DrawingObject = {
      id: `rectangle-${Date.now()}`,
      symbol: snapshot?.quote.security.code ?? '',
      period: activePeriod,
      kind: 'rectangle',
      points: [{ time: start.day, price: start.low }, { time: end.day, price: end.high }],
      style: { color: '#ef4444', width: 2, lineStyle: 'solid', opacity: 1 },
      locked: false,
      visible: true,
      version: 0,
      updatedAt: new Date().toISOString(),
    }
    commands.create(drawing)
  }

  const resetView = () => {
    setZoom(100)
    setCrosshair(false)
  }

  const chartLeft = 58
  const chartTop = 22
  const chartWidth = 850
  const chartHeight = 300
  const currentPrice = snapshot?.quote.price ?? lastClose
  const values = [
    ...candles.flatMap((candle) => [candle.high, candle.low]),
    ...(activePrediction?.days.flatMap((day) => [day.high, day.low, day.rangeHigh, day.rangeLow]) ?? []),
    ...(indicators.ma5 ? indicatorValues.ma5 : []),
    ...(indicators.ma10 ? indicatorValues.ma10 : []),
    ...(indicators.ma20 ? indicatorValues.ma20 : []),
    ...(indicators.boll ? [...indicatorValues.boll.upper, ...indicatorValues.boll.lower] : []),
    currentPrice,
  ]
  const maxPrice = Math.max(...values, lastClose) + 0.25
  const minPrice = Math.min(...values, lastClose) - 0.25
  const times = [...candles.map((candle) => candle.day), ...(activePrediction?.days.map((day) => day.day) ?? [])]
  const transform = createChartTransform({ times: times.length ? times : [''], minPrice, maxPrice, rect: { left: chartLeft, top: chartTop, width: chartWidth, height: chartHeight } })

  const createDrawing = commands.create
  const selectDrawing = commands.select
  const moveDrawingPoint = (id: string, index: number, point: TimePricePoint) => {
    commands.select(id)
    commands.movePoint(index, point)
  }
  const moveDrawing = (id: string, delta: DrawingMove) => {
    commands.select(id)
    commands.move(delta)
  }
  const deleteSelectedDrawing = () => {
    if (!selectedId || !window.confirm('确认删除此绘图对象？')) return
    commands.remove(selectedId)
  }
  const changeSelectedDrawing = (change: DrawingInspectorChange) => {
    if (!selectedId) return
    commands.select(selectedId)
    switch (change.type) {
      case 'style': commands.updateStyle(change.patch); break
      case 'text': commands.updateText(change.text); break
      case 'point': commands.movePoint(change.index, change.point); break
      case 'visible': commands.setVisible(change.visible); break
      case 'locked': commands.setLocked(change.locked); break
    }
  }
  const undoDrawing = commands.undo
  const redoDrawing = commands.redo

  if (!snapshot || !sourceCandles.length) {
    if (!snapshot && (status === 'loading' || status === 'refreshing')) return <MarketLoadingState variant="chart" />
    if (!snapshot && status === 'error') return <section className="sc-chart-error-state"><MarketFeedback errorMessage={errorMessage} onRetry={onRetry} status={status} /></section>
    return <section className="sc-live-empty" aria-live="polite"><p className="sc-eyebrow">K 线 · 真实行情</p><h1>真实行情暂不可用</h1><p>没有收到可绘制的 K 线数据，请检查阿里云行情服务。</p></section>
  }

  return (
    <section className="sc-kline-workspace sc-kline-terminal">
      <MarketFeedback errorMessage={errorMessage} hasSnapshot onRetry={onRetry} status={status} />
      <header className="sc-kline-header sc-kline-summary">
        <div>
          <p className="sc-eyebrow">价格结构 · 多周期观察</p>
          <div className="sc-kline-title-row">
            <h1>专业 K 线</h1>
            <span>{snapshot.quote.security.name}</span>
            <code>{snapshot.quote.security.code}</code>
          </div>
          <p className="sc-kline-subtitle">真实行情 + 未来 3 日指标推演 · K 线数据与绘图数据独立</p>
        </div>
        <div className="sc-kline-quote">
          <strong>{priceText(currentPrice)}</strong>
          <span className={snapshot?.quote.price && snapshot.quote.price >= (snapshot.quote.previousClose ?? snapshot.quote.price) ? 'is-rise' : ''}>收盘参考价</span>
        </div>
        <button aria-expanded={toolsOpen} className="sc-kline-mobile-tools-trigger" onClick={() => setToolsOpen(true)} type="button">图表工具</button>
      </header>

      {toolsOpen ? <div className="sc-kline-tools-overlay" onMouseDown={(event) => event.target === event.currentTarget && setToolsOpen(false)} role="presentation"><section aria-label="图表工具" aria-modal="true" className="sc-kline-tool-sheet" role="dialog"><button aria-label="关闭图表工具" className="sc-kline-tool-sheet-close" onClick={() => setToolsOpen(false)} type="button">×</button><h2>图表工具</h2><ChartToolbar activeTool={activeTool} onToolChange={(tool) => { setActiveTool(tool); setToolsOpen(false) }} /><section aria-label="指标设置"><h3>指标设置</h3>{indicatorOptions.map(([key, label]) => <label className="sc-kline-indicator" key={key}><input aria-label={label} checked={indicators[key]} onChange={(event) => setIndicators((old) => ({ ...old, [key]: event.target.checked }))} role="switch" type="checkbox" /><span>{label}</span></label>)}</section></section></div> : null}

      <div className="sc-kline-controls sc-kline-control-card">
        <div className="sc-kline-control-row" aria-label="K线周期">
          <span className="sc-kline-group-label">K线周期</span>
          <div className="sc-kline-segmented" role="tablist" aria-label="K线周期">
            {periods.map(([period, label]) => (
              <button aria-selected={activePeriod === period} className={activePeriod === period ? 'is-active' : ''} key={period} onClick={() => setActivePeriod(period)} role="tab" type="button">{label}</button>
            ))}
          </div>
          <span className="sc-kline-hint">当前：{periods.find(([period]) => period === activePeriod)?.[1]}</span>
        </div>

        <ChartToolbar activeTool={activeTool} onToolChange={setActiveTool} />

        <div className="sc-kline-control-row" aria-label="指标设置">
          <span className="sc-kline-group-label">指标设置</span>
          <div className="sc-kline-indicator-buttons">
            {indicatorOptions.map(([key, label]) => (
              <label className={`sc-kline-indicator ${indicators[key] ? 'is-active' : ''}`} key={key} style={{ '--indicator-color': indicatorColors[key] } as React.CSSProperties}>
                <input aria-label={label} checked={indicators[key]} onChange={(event) => setIndicators((old) => ({ ...old, [key]: event.target.checked }))} role="switch" type="checkbox" />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <span className="sc-kline-hint">均线参数：5 / 10 / 20 · BOLL：20, 2</span>
        </div>

        <div className="sc-kline-control-row" aria-label="视图控制">
          <span className="sc-kline-group-label">视图</span>
          <button className="sc-kline-control-button" aria-label="缩小" onClick={() => setZoom((value) => Math.max(80, value - 10))} type="button">−</button>
          <span className="sc-kline-zoom" role="status">{zoom}%</span>
          <button className="sc-kline-control-button" aria-label="放大" onClick={() => setZoom((value) => Math.min(150, value + 10))} type="button">＋</button>
          <button className="sc-kline-control-button" onClick={resetView} type="button">复位视图</button>
          <button aria-pressed={crosshair} className={`sc-kline-control-button ${crosshair ? 'is-active' : ''}`} onClick={() => setCrosshair((value) => !value)} type="button">十字光标</button>
          <button className="sc-kline-control-button" onClick={undoDrawing} type="button">撤销</button>
          <button className="sc-kline-control-button" onClick={redoDrawing} type="button">重做</button>
        </div>
      </div>

      <div className="sc-kline-main-grid sc-kline-content">
        <div className="sc-kline-main-column">
          <div className="sc-kline-chart-panel">
            <div className="sc-kline-chart-heading">
              <div className="sc-kline-legend">
                <span><i className="sc-candle-rise" />上涨</span>
                <span><i className="sc-candle-fall" />下跌</span>
                {indicators.ma5 && <span><i style={{ background: indicatorColors.ma5 }} />MA5</span>}
                {indicators.ma10 && <span><i style={{ background: indicatorColors.ma10 }} />MA10</span>}
                {indicators.ma20 && <span><i style={{ background: indicatorColors.ma20 }} />MA20</span>}
                {indicators.boll && <span><i style={{ background: indicatorColors.boll }} />BOLL</span>}
              </div>
            <span className="sc-kline-data-badge">{snapshot.source.online ? '实时接口' : '行情缓存'}</span>
            </div>
            <div className="sc-kline-chart-scroll">
              <div className="sc-kline-chart-surface" data-zoom={zoom} style={{ width: `${zoom}%` }}>
                <ChartCanvas activeTool={activeTool} candles={candles} crosshair={crosshair} drawings={drawings} hoveredDay={hoveredDay} indicatorValues={indicatorValues} indicators={indicators} keyLevels={keyLevels} onCreateDrawing={createDrawing} onDeleteSelected={deleteSelectedDrawing} onHoverDay={setHoveredDay} onMoveDrawing={moveDrawing} onMovePoint={moveDrawingPoint} onRedo={redoDrawing} onSelectDrawing={selectDrawing} onSelectPredictionDay={setSelectedPredictionDay} onUndo={undoDrawing} period={activePeriod} prediction={layers.prediction ? activePrediction : null} selectedId={selectedId} selectedPredictionDay={activePredictionDay} showDrawings={layers.annotations} showKeyLevels={layers.keyLevels} symbol={snapshot.quote.security.code} transform={transform} />
              </div>
            </div>
            <div className="sc-kline-statusbar"><span>共 {candles.length} 根 K 线</span><span>当前周期：{periods.find(([period]) => period === activePeriod)?.[1]}</span><span>数据源：{snapshot.source.name}</span><span>{syncStatus === '本机保存' ? '本机保存 · 登录后跨设备同步' : syncStatus}</span></div>
          </div>
          {(activeTool === 'rectangle' || activeTool === 'trend-line') && <button className="sc-kline-add-annotation" onClick={addRectangle} type="button">添加矩形标注</button>}
          {activePrediction && layers.prediction ? <><PredictionDetails mode="desktop-table" onSelectDay={setSelectedPredictionDay} prediction={activePrediction} selectedDay={activePredictionDay} /><PredictionDetails mode="mobile-sheet" onSelectDay={setSelectedPredictionDay} prediction={activePrediction} selectedDay={activePredictionDay} /></> : null}
        </div>
        <aside className="sc-kline-side-column"><ChartLayerPanel layers={layers} onChange={(key, value) => setLayers((old) => ({ ...old, [key]: value }))} /><ObjectInspector drawing={drawings.find((drawing) => drawing.id === selectedId) ?? null} onChange={changeSelectedDrawing} onDelete={deleteSelectedDrawing} /><section className="sc-kline-side-card"><p className="sc-eyebrow">当前观察</p><h2>{snapshot.quote.security.name}</h2><dl><div><dt>现价</dt><dd>{priceText(currentPrice)}</dd></div><div><dt>数据源</dt><dd>{snapshot.source.name}</dd></div><div><dt>更新时间</dt><dd>{new Date(snapshot.source.fetchedAt).toLocaleString('zh-CN')}</dd></div></dl><p>先用周期和图层筛选结构，再用绘图工具记录买入、止盈和失效条件。</p></section></aside>
      </div>
    </section>
  )
}
