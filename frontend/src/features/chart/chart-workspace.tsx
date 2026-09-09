'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { MarketSnapshot } from '../workspace/stock-workspace-types'
import type { WorkspaceStatus } from '../workspace/stock-workspace-types'
import { MarketFeedback, MarketLoadingState } from '../workspace/market-state'
import type { ChartTool } from './chart-annotation-store'
import { ChartLayerPanel, type ChartLayerState } from './chart-layer-panel'
import { ChartToolbar } from './chart-toolbar'
import { useChartWorkspace } from './use-chart-workspace'
import { createChartTransform } from './chart-coordinates'
import { aggregateCandles, bollinger, movingAverage } from './chart-math'
import type { ChartPeriod, DrawingRecoveryRecord, PredictionSnapshot, TimePricePoint } from './chart-types'
import type { DrawingMove } from './drawing-engine'
import { ChartCanvas } from './chart-canvas'
import { ChartMobileSheet } from './chart-mobile-sheet'
import { PredictionDetails } from './prediction-details'
import { ObjectInspector, type DrawingInspectorChange } from './object-inspector'
import { loadChartWorkspace } from './chart-workspace-sync'

export { aggregateCandles } from './chart-math'

type IndicatorKey = 'ma5' | 'ma10' | 'ma20' | 'boll'
type MobileSheet = 'prediction' | 'properties' | 'markers' | 'more' | null

const periods: Array<[ChartPeriod, string]> = [['day', '日线'], ['week', '周线'], ['month', '月线']]
const indicatorOptions: Array<[IndicatorKey, string]> = [['ma5', 'MA5'], ['ma10', 'MA10'], ['ma20', 'MA20'], ['boll', 'BOLL']]
const indicatorColors: Record<IndicatorKey, string> = { ma5: '#d6a12a', ma10: '#4e9bd6', ma20: '#a46ee8', boll: '#6f7fd8' }
const markerTools: Array<[ChartTool, string]> = [['buy', '买入点'], ['sell', '卖出点'], ['target', '目标位'], ['stop-loss', '止损位']]
function priceText(value: number) {
  return value.toFixed(2)
}

function RecoveryPanel({ records, onRestore }: { records: DrawingRecoveryRecord[]; onRestore: (record: DrawingRecoveryRecord) => void }) {
  return (
    <section aria-label="冲突恢复" className="sc-chart-recovery">
      <header><div><p className="sc-eyebrow">冲突恢复</p><h2>待恢复副本</h2></div><span>{records.length}</span></header>
      {records.length ? <ul>{records.map((record, index) => <li key={`${record.id}-${record.reason}-${index}`}><div><strong>{record.drawing.text || record.id}</strong><span>{record.reason === 'DELETE_EDIT_CONFLICT' ? '删除与异地编辑冲突' : '对象版本冲突'}</span></div><button onClick={() => onRestore(record)} type="button">恢复副本</button></li>)}</ul> : <p>当前没有待恢复的冲突副本。</p>}
    </section>
  )
}

export function ChartWorkspace({ snapshot, prediction = null, status = 'ready', errorMessage, onRetry }: { snapshot?: MarketSnapshot | null; prediction?: PredictionSnapshot | null; status?: WorkspaceStatus; errorMessage?: string | null; onRetry?: () => void }) {
  const [activeTool, setActiveTool] = useState<ChartTool>('pointer')
  const [activePeriod, setActivePeriod] = useState<ChartPeriod>('day')
  const symbol = snapshot?.quote.security.code ?? ''
  const { workspace, drawings, selectedId, syncStatus, commands } = useChartWorkspace({ symbol, period: activePeriod })
  const indicators = { ma5: true, ma10: true, ma20: true, boll: true, ...workspace.indicators }
  const layers: ChartLayerState = { keyLevels: true, annotations: true, prediction: true, ...workspace.layers }
  const zoom = workspace.view.zoom
  const crosshair = workspace.crosshair
  const [hoveredDay, setHoveredDay] = useState<string | null>(null)
  const [selectedPredictionDay, setSelectedPredictionDay] = useState<string | null>(null)
  const [mobileSheet, setMobileSheet] = useState<MobileSheet>(null)
  const chartScrollRef = useRef<HTMLDivElement>(null)
  const viewportState = useRef({ key: '', predictionKey: '', userPanned: false })
  const revealedDrawingLocation = useRef('')

  const sourceCandles = useMemo(() => snapshot?.dailyCandles ?? [], [snapshot?.dailyCandles])
  const candles = useMemo(() => aggregateCandles(sourceCandles, activePeriod), [activePeriod, sourceCandles])
  const activePrediction = activePeriod === 'day' && prediction?.period === 'day' ? prediction : null
  const activePredictionDay = activePrediction?.days.some((day) => day.day === selectedPredictionDay) ? selectedPredictionDay : activePrediction?.days[0].day ?? null
  const detailPredictionDay = hoveredDay ?? activePredictionDay
  const movingAverages = useMemo(() => ({ ma5: movingAverage(candles, 5), ma10: movingAverage(candles, 10), ma20: movingAverage(candles, 20) }), [candles])
  const boll = useMemo(() => bollinger(candles, 20, 2), [candles])
  const visiblePrediction = layers.prediction ? activePrediction : null
  const indicatorValues = useMemo(() => ({
    ma5: [...movingAverages.ma5, ...(visiblePrediction?.days.map((day) => day.ma5) ?? [])],
    ma10: [...movingAverages.ma10, ...(visiblePrediction?.days.map((day) => day.ma10) ?? [])],
    ma20: [...movingAverages.ma20, ...(visiblePrediction?.days.map((day) => day.ma20) ?? [])],
    boll: {
      upper: [...boll.upper, ...(visiblePrediction?.days.map((day) => day.bollUpper) ?? [])],
      middle: [...boll.middle, ...(visiblePrediction?.days.map((day) => day.bollMiddle) ?? [])],
      lower: [...boll.lower, ...(visiblePrediction?.days.map((day) => day.bollLower) ?? [])],
    },
  }), [boll, movingAverages, visiblePrediction])
  const keyLevels = useMemo(() => candles.length ? [Math.max(...candles.slice(-20).map((candle) => candle.high)), Math.min(...candles.slice(-20).map((candle) => candle.low))] : [], [candles])
  const lastClose = candles[candles.length - 1]?.close ?? snapshot?.quote.price ?? 0
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
  const times = useMemo(() => [...candles.map((candle) => candle.day), ...(activePrediction?.days.map((day) => day.day) ?? [])], [activePrediction, candles])
  const transform = useMemo(() => createChartTransform({ times: times.length ? times : [''], minPrice, maxPrice, rect: { left: 58, top: 22, width: 850, height: 300 } }), [maxPrice, minPrice, times])
  const selectedDrawing = drawings.find((drawing) => drawing.id === selectedId) ?? null
  const selectedDrawingTime = selectedDrawing?.points[0]?.time ?? ''
  const selectedDrawingLocation = selectedDrawing ? `${selectedDrawing.id}:${selectedDrawingTime}` : ''

  useEffect(() => {
    const scroll = chartScrollRef.current
    const key = `${symbol}:${activePeriod}`
    if (!scroll) return
    const persisted = symbol ? loadChartWorkspace(symbol, activePeriod) : null
    if (viewportState.current.key !== key) {
      viewportState.current = { key, predictionKey: '', userPanned: false }
      scroll.scrollLeft = persisted?.view.panX ?? workspace.view.panX
    }
    const predictionKey = activePrediction?.generatedAt ?? ''
    if (predictionKey && viewportState.current.predictionKey !== predictionKey) {
      viewportState.current.predictionKey = predictionKey
      if (!viewportState.current.userPanned && !persisted && workspace.revision === 0) scroll.scrollLeft = Math.max(0, scroll.scrollWidth - scroll.clientWidth)
    }
  }, [activePeriod, activePrediction?.generatedAt, symbol, workspace.revision, workspace.view.panX])

  useEffect(() => {
    const scroll = chartScrollRef.current
    if (revealedDrawingLocation.current === selectedDrawingLocation) return
    revealedDrawingLocation.current = selectedDrawingLocation
    if (!scroll || !selectedDrawingTime || !transform.hasTime(selectedDrawingTime) || !scroll.scrollWidth) return
    const pointX = transform.xForTime(selectedDrawingTime) / 960 * scroll.scrollWidth
    const margin = Math.min(80, scroll.clientWidth / 4)
    if (pointX < scroll.scrollLeft + margin || pointX > scroll.scrollLeft + scroll.clientWidth - margin) scroll.scrollLeft = Math.max(0, pointX - scroll.clientWidth / 2)
  }, [selectedDrawingLocation, selectedDrawingTime, transform])

  const setIndicators = commands.setIndicators
  const setLayers = commands.setLayers
  const setCrosshair = commands.setCrosshair
  const setZoom = (update: number | ((value: number) => number)) => commands.setView((view) => ({ ...view, zoom: typeof update === 'function' ? update(view.zoom) : update }))
  const addRectangle = () => {
    const end = candles.at(-1)
    const start = candles.at(-2) ?? end
    if (!start || !end) return
    commands.create({ id: `rectangle-${crypto.randomUUID()}`, symbol, period: activePeriod, kind: 'rectangle', points: [{ time: start.day, price: start.low }, { time: end.day, price: end.high }], style: { color: '#ef4444', width: 2, lineStyle: 'solid', opacity: 1 }, locked: false, visible: true, version: 0, updatedAt: new Date().toISOString() })
  }
  const resetView = () => {
    if (chartScrollRef.current) chartScrollRef.current.scrollLeft = 0
    commands.setView((view) => ({ ...view, zoom: 100, panX: 0, panY: 0 }))
    setCrosshair(false)
  }
  const moveDrawingPoint = (id: string, index: number, point: TimePricePoint) => { commands.select(id); commands.movePoint(index, point) }
  const moveDrawing = (id: string, delta: DrawingMove) => { commands.select(id); commands.move(delta) }
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
  const copySelectedDrawing = () => {
    if (selectedId) commands.copy(selectedId, `${selectedId}-copy-${crypto.randomUUID()}`)
  }
  const restoreRecovery = (record: DrawingRecoveryRecord) => {
    const { restoredFromVersion: discardedRestoration, ...drawing } = record.drawing
    void discardedRestoration
    commands.create({ ...drawing, id: `${drawing.id}-recovered-${crypto.randomUUID()}`, locked: false, visible: true, version: 0, updatedAt: new Date().toISOString() })
  }
  const panChart = (deltaX: number) => {
    viewportState.current.userPanned = true
    if (chartScrollRef.current) chartScrollRef.current.scrollLeft += deltaX
  }
  const commitPan = () => {
    const scroll = chartScrollRef.current
    if (scroll && scroll.scrollLeft !== workspace.view.panX) commands.setView((view) => ({ ...view, panX: scroll.scrollLeft }))
  }
  const chooseMobileTool = (tool: ChartTool) => { setActiveTool(tool); setMobileSheet(null) }
  const selectPredictionDay = (day: string) => {
    setSelectedPredictionDay(day)
    const scroll = chartScrollRef.current
    if (!scroll || !transform.hasTime(day)) return
    const dayX = transform.xForTime(day) / 960 * scroll.scrollWidth
    scroll.scrollLeft = Math.max(0, dayX - scroll.clientWidth / 2)
  }

  if (!snapshot || !sourceCandles.length) {
    if (!snapshot && (status === 'loading' || status === 'refreshing')) return <MarketLoadingState variant="chart" />
    if (!snapshot && status === 'error') return <section className="sc-chart-error-state"><MarketFeedback errorMessage={errorMessage} onRetry={onRetry} status={status} /></section>
    return <section className="sc-live-empty" aria-live="polite"><p className="sc-eyebrow">K 线 · 真实行情</p><h1>真实行情暂不可用</h1><p>没有收到可绘制的 K 线数据，请检查阿里云行情服务。</p></section>
  }

  const inspector = <ObjectInspector drawing={selectedDrawing} onChange={changeSelectedDrawing} onCopy={copySelectedDrawing} onDelete={deleteSelectedDrawing} />
  const recovery = <RecoveryPanel onRestore={restoreRecovery} records={workspace.recovery ?? []} />

  return (
    <section className="sc-kline-workspace sc-kline-terminal">
      <MarketFeedback errorMessage={errorMessage} hasSnapshot onRetry={onRetry} status={status} />
      <header className="sc-kline-header sc-kline-summary">
        <div><p className="sc-eyebrow">价格结构 · 多周期观察</p><div className="sc-kline-title-row"><h1>专业 K 线</h1><span>{snapshot.quote.security.name}</span><code>{snapshot.quote.security.code}</code></div><p className="sc-kline-subtitle">真实行情 + 未来 3 日指标推演 · K 线数据与绘图数据独立</p></div>
        <div className="sc-kline-quote"><strong>{priceText(currentPrice)}</strong><span className={snapshot.quote.price >= (snapshot.quote.previousClose ?? snapshot.quote.price) ? 'is-rise' : ''}>收盘参考价</span></div>
      </header>

      <div className="sc-kline-main-grid sc-kline-content">
        <aside aria-label="桌面绘图工具" className="sc-chart-left-tools"><ChartToolbar activeTool={activeTool} onToolChange={setActiveTool} /><button aria-pressed={crosshair} className={crosshair ? 'is-active' : ''} onClick={() => setCrosshair((value) => !value)} title="十字光标" type="button">十字光标</button></aside>

        <main className="sc-kline-main-column">
          <div className="sc-kline-controls sc-kline-control-card">
            <div className="sc-kline-control-row" aria-label="K线周期"><span className="sc-kline-group-label">K线周期</span><div className="sc-kline-segmented" role="tablist" aria-label="K线周期">{periods.map(([period, label]) => <button aria-selected={activePeriod === period} className={activePeriod === period ? 'is-active' : ''} key={period} onClick={() => setActivePeriod(period)} role="tab" type="button">{label}</button>)}</div><span className="sc-kline-hint">当前：{periods.find(([period]) => period === activePeriod)?.[1]}</span></div>
            <div className="sc-kline-control-row" aria-label="指标设置"><span className="sc-kline-group-label">指标设置</span><div className="sc-kline-indicator-buttons">{indicatorOptions.map(([key, label]) => <label className={`sc-kline-indicator ${indicators[key] ? 'is-active' : ''}`} key={key} style={{ '--indicator-color': indicatorColors[key] } as React.CSSProperties}><input aria-label={label} checked={indicators[key]} onChange={(event) => setIndicators((old) => ({ ...old, [key]: event.target.checked }))} role="switch" type="checkbox" /><span>{label}</span></label>)}</div><span className="sc-kline-hint">均线 5 / 10 / 20 · BOLL 20, 2</span></div>
            <div className="sc-kline-control-row" aria-label="视图控制"><span className="sc-kline-group-label">视图</span><button className="sc-kline-control-button" aria-label="缩小" onClick={() => setZoom((value) => Math.max(80, value - 10))} type="button">−</button><span className="sc-kline-zoom" role="status">{zoom}%</span><button className="sc-kline-control-button" aria-label="放大" onClick={() => setZoom((value) => Math.min(150, value + 10))} type="button">＋</button><button className="sc-kline-control-button" onClick={resetView} type="button">复位视图</button><button aria-pressed={crosshair} className={`sc-kline-control-button ${crosshair ? 'is-active' : ''}`} onClick={() => setCrosshair((value) => !value)} type="button">十字光标</button><button className="sc-kline-control-button" onClick={commands.undo} type="button">撤销</button><button className="sc-kline-control-button" onClick={commands.redo} type="button">重做</button></div>
          </div>

          <div className="sc-chart-mobile-context"><button disabled={!activePrediction || !layers.prediction} onClick={() => setMobileSheet('prediction')} type="button">预测详情</button><button onClick={() => setMobileSheet('properties')} type="button">对象属性</button></div>

          <div className="sc-kline-chart-panel">
            <div className="sc-kline-chart-heading"><div className="sc-kline-legend"><span><i className="sc-candle-rise" />上涨</span><span><i className="sc-candle-fall" />下跌</span>{indicators.ma5 && <span><i style={{ background: indicatorColors.ma5 }} />MA5</span>}{indicators.ma10 && <span><i style={{ background: indicatorColors.ma10 }} />MA10</span>}{indicators.ma20 && <span><i style={{ background: indicatorColors.ma20 }} />MA20</span>}{indicators.boll && <span><i style={{ background: indicatorColors.boll }} />BOLL</span>}</div><span className="sc-kline-data-badge">{snapshot.source.online ? '实时接口' : '行情缓存'}</span></div>
            <div className="sc-kline-chart-scroll" ref={chartScrollRef}><div className="sc-kline-chart-surface" data-zoom={zoom} style={{ width: `${zoom}%` }}><ChartCanvas activeTool={activeTool} candles={candles} crosshair={crosshair} drawings={drawings} hoveredDay={hoveredDay} indicatorValues={indicatorValues} indicators={indicators} keyLevels={keyLevels} onCreateDrawing={commands.create} onDeleteSelected={deleteSelectedDrawing} onHoverDay={setHoveredDay} onMoveDrawing={moveDrawing} onMovePoint={moveDrawingPoint} onPan={panChart} onPanEnd={commitPan} onRedo={commands.redo} onSelectDrawing={commands.select} onSelectPredictionDay={selectPredictionDay} onUndo={commands.undo} period={activePeriod} prediction={visiblePrediction} selectedId={selectedId} selectedPredictionDay={activePredictionDay} showDrawings={layers.annotations} showKeyLevels={layers.keyLevels} symbol={symbol} transform={transform} /></div></div>
            <div className="sc-kline-statusbar"><span>共 {candles.length} 根 K 线</span><span>当前周期：{periods.find(([period]) => period === activePeriod)?.[1]}</span><span>数据源：{snapshot.source.name}</span><span>{syncStatus === '本机保存' ? '本机保存 · 登录后跨设备同步' : syncStatus}</span></div>
          </div>
          {(activeTool === 'rectangle' || activeTool === 'trend-line') && <button className="sc-kline-add-annotation" onClick={addRectangle} type="button">添加矩形标注</button>}
          {activePeriod !== 'day' && layers.prediction ? <section aria-live="polite" className="sc-prediction-unavailable">未来推演仅支持日线周期</section> : null}
          {visiblePrediction ? <PredictionDetails mode="desktop-table" onSelectDay={selectPredictionDay} prediction={visiblePrediction} selectedDay={detailPredictionDay} /> : null}
        </main>

        <aside aria-label="图层与对象属性" className="sc-kline-side-column sc-chart-right-rail"><ChartLayerPanel layers={layers} onChange={(key, value) => setLayers((old) => ({ ...old, [key]: value }))} />{inspector}{recovery}<section className="sc-kline-side-card"><p className="sc-eyebrow">当前观察</p><h2>{snapshot.quote.security.name}</h2><dl><div><dt>现价</dt><dd>{priceText(currentPrice)}</dd></div><div><dt>数据源</dt><dd>{snapshot.source.name}</dd></div><div><dt>更新时间</dt><dd>{new Date(snapshot.source.fetchedAt).toLocaleString('zh-CN')}</dd></div></dl></section></aside>
      </div>

      <nav aria-label="移动绘图工具" className="sc-chart-mobile-toolbar" data-testid="chart-mobile-toolbar"><button aria-pressed={activeTool === 'pointer'} onClick={() => setActiveTool('pointer')} type="button"><span aria-hidden="true">↖</span>选择</button><button aria-pressed={activeTool === 'trend-line'} onClick={() => setActiveTool('trend-line')} type="button"><span aria-hidden="true">╱</span>趋势线</button><button aria-pressed={activeTool === 'horizontal-line'} onClick={() => setActiveTool('horizontal-line')} type="button"><span aria-hidden="true">─</span>水平线</button><button aria-haspopup="dialog" aria-pressed={markerTools.some(([tool]) => tool === activeTool)} onClick={() => setMobileSheet('markers')} type="button"><span aria-hidden="true">◆</span>标记</button><button aria-haspopup="dialog" onClick={() => setMobileSheet('more')} type="button"><span aria-hidden="true">•••</span>更多</button></nav>

      {mobileSheet === 'prediction' && visiblePrediction ? <ChartMobileSheet onClose={() => setMobileSheet(null)} title="预测详情"><PredictionDetails mode="mobile-sheet" onSelectDay={selectPredictionDay} prediction={visiblePrediction} selectedDay={detailPredictionDay} /></ChartMobileSheet> : null}
      {mobileSheet === 'properties' ? <ChartMobileSheet onClose={() => setMobileSheet(null)} title="对象属性">{inspector}{recovery}</ChartMobileSheet> : null}
      {mobileSheet === 'markers' ? <ChartMobileSheet onClose={() => setMobileSheet(null)} title="标记类型"><div className="sc-chart-marker-picker">{markerTools.map(([tool, label]) => <button aria-pressed={activeTool === tool} key={tool} onClick={() => chooseMobileTool(tool)} type="button">{label}</button>)}</div></ChartMobileSheet> : null}
      {mobileSheet === 'more' ? <ChartMobileSheet onClose={() => setMobileSheet(null)} title="更多图表工具"><ChartToolbar activeTool={activeTool} onToolChange={chooseMobileTool} /><ChartLayerPanel layers={layers} onChange={(key, value) => setLayers((old) => ({ ...old, [key]: value }))} /><section aria-label="指标设置" className="sc-chart-sheet-indicators"><h3>指标设置</h3>{indicatorOptions.map(([key, label]) => <label key={key}><input aria-label={`移动端${label}`} checked={indicators[key]} onChange={(event) => setIndicators((old) => ({ ...old, [key]: event.target.checked }))} role="switch" type="checkbox" /><span>{label}</span></label>)}</section></ChartMobileSheet> : null}
    </section>
  )
}
