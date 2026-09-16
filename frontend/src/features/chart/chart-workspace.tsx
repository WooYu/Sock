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
import { bollinger, movingAverage, withPredictionMovingAverages } from './chart-math'
import type { ChartPeriod, DrawingRecoveryRecord, PredictionSnapshot, TimePricePoint } from './chart-types'
import type { DrawingMove } from './drawing-engine'
import { ChartCanvas } from './chart-canvas'
import { ChartMobileSheet } from './chart-mobile-sheet'
import { PredictionDetails } from './prediction-details'
import { ObjectInspector, type DrawingInspectorChange } from './object-inspector'
import { loadChartWorkspace } from './chart-workspace-sync'
import { ForecastPanel } from '../research/forecast-panel'
import { StudioChartControls } from '../research/studio-chart-controls'
import { DrawingList } from '../research/drawing-list'
import { CHART_PERIODS, DEFAULT_INDICATORS, MA_COLORS, MA_PERIODS, PERIOD_LABELS, canonicalPeriodTime, type IndicatorKey, type IndicatorValue, type MaKey } from './chart-periods'
import { useChartSeries, type ChartSeriesLoader } from './use-chart-series'

export { aggregateCandles } from './chart-math'

type MobileSheet = 'prediction' | 'properties' | 'markers' | 'more' | null

const periods: Array<[ChartPeriod, string]> = CHART_PERIODS.map((period) => [period, PERIOD_LABELS[period]])
const indicatorOptions: Array<[IndicatorKey, string]> = [...MA_PERIODS.map((period): [MaKey, string] => [`ma${period}`, `MA${period}`]), ['boll', 'BOLL']]
const indicatorColors: Record<IndicatorKey, string> = { ...MA_COLORS, boll: '#6f7fd8' }
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

export function ChartWorkspace({ snapshot, prediction = null, status = 'ready', errorMessage, onRetry, variant = 'classic', forecastStatus, forecastError, footer, loadSeries }: { snapshot?: MarketSnapshot | null; prediction?: PredictionSnapshot | null; status?: WorkspaceStatus; errorMessage?: string | null; onRetry?: () => void; variant?: 'classic' | 'studio'; forecastStatus?: 'idle' | 'loading' | 'ready' | 'error'; forecastError?: string | null; footer?: React.ReactNode; loadSeries?: ChartSeriesLoader }) {
  const isStudio = variant === 'studio'
  const [historyWindow, setHistoryWindow] = useState(60)
  const [rightTab, setRightTab] = useState<'prediction' | 'drawings'>('prediction')
  const [activeTool, setActiveTool] = useState<ChartTool>('pointer')
  const [activePeriod, setActivePeriod] = useState<ChartPeriod>('day')
  const symbol = snapshot?.quote.security.code ?? ''
  const { workspace, drawings, selectedId, syncStatus, commands } = useChartWorkspace({ symbol, period: activePeriod, localOnly: symbol === 'DEMO' })
  const indicators = { ...DEFAULT_INDICATORS, ...workspace.indicators }
  const layers: ChartLayerState = { keyLevels: true, annotations: true, prediction: true, ...workspace.layers }
  const zoom = workspace.view.zoom
  const crosshair = workspace.crosshair
  const [hoveredDay, setHoveredDay] = useState<string | null>(null)
  const [selectedPredictionDay, setSelectedPredictionDay] = useState<string | null>(null)
  const [mobileSheet, setMobileSheet] = useState<MobileSheet>(null)
  const chartScrollRef = useRef<HTMLDivElement>(null)
  const viewportState = useRef({ key: '', predictionKey: '', userPanned: false })
  const revealedDrawingLocation = useRef('')

  const series = useChartSeries(snapshot, activePeriod, loadSeries)
  const intraday = activePeriod === 'intraday'
  const sourceCandles = useMemo(() => [...(series.data?.bars ?? [])].sort((a, b) => a.day.localeCompare(b.day)), [series.data?.bars])
  const allCandles = sourceCandles
  const candles = useMemo(() => isStudio && historyWindow && !intraday ? allCandles.slice(-historyWindow) : allCandles, [allCandles, historyWindow, intraday, isStudio])
  const activePrediction = useMemo(() => activePeriod === 'day' && prediction?.period === 'day' && prediction.symbol === symbol && sourceCandles.length && prediction.days[0].day > sourceCandles.at(-1)!.day ? withPredictionMovingAverages(sourceCandles, prediction) : null, [activePeriod, prediction, sourceCandles, symbol])
  const activePredictionDay = activePrediction?.days.some((day) => day.day === selectedPredictionDay) ? selectedPredictionDay : activePrediction?.days[0].day ?? null
  const detailPredictionDay = hoveredDay ?? activePredictionDay
  const movingAverages = useMemo(() => Object.fromEntries(MA_PERIODS.map((period) => [`ma${period}`, movingAverage(allCandles, period).slice(-candles.length)])) as Record<MaKey, IndicatorValue[]>, [allCandles, candles.length])
  const boll = useMemo(() => { const result = bollinger(allCandles, 20, 2); return { upper: result.upper.slice(-candles.length), middle: result.middle.slice(-candles.length), lower: result.lower.slice(-candles.length) } }, [allCandles, candles.length])
  const visiblePrediction = layers.prediction ? activePrediction : null
  const indicatorValues = useMemo(() => ({
    ...Object.fromEntries(MA_PERIODS.map((period) => { const key = `ma${period}` as MaKey; return [key, [...movingAverages[key], ...(visiblePrediction?.days.map((day) => day[key] ?? null) ?? [])]] })) as Record<MaKey, IndicatorValue[]>,
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
    ...(visiblePrediction?.days.flatMap((day) => [day.high, day.low, day.rangeHigh, day.rangeLow]) ?? []),
    ...(!intraday ? MA_PERIODS.flatMap((period) => indicators[`ma${period}`] ? indicatorValues[`ma${period}`] : []) : allCandles.map((bar) => bar.averagePrice)),
    ...(!intraday && indicators.boll ? [...indicatorValues.boll.upper, ...indicatorValues.boll.lower] : []),
    ...(intraday && series.data?.previousClose ? [series.data.previousClose] : []),
    currentPrice,
  ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const maxPrice = Math.max(...values, lastClose) + 0.25
  const minPrice = Math.min(...values, lastClose) - 0.25
  const times = useMemo(() => [...candles.map((candle) => candle.day), ...(activePrediction?.days.map((day) => day.day) ?? [])], [activePrediction, candles])
  const domainTimes = useMemo(() => [...allCandles.map((candle) => candle.day), ...(activePrediction?.days.map((day) => day.day) ?? [])], [activePrediction, allCandles])
  const transform = useMemo(() => {
    const base = createChartTransform({ times: times.length ? times : [''], domainTimes: domainTimes.length ? domainTimes : undefined, minPrice, maxPrice, rect: { left: isStudio ? 42 : 58, top: 22, width: 850, height: 300 }, futureCount: isStudio ? activePrediction?.days.length : undefined })
    return { ...base, hasTime: (time: string) => base.hasTime(canonicalPeriodTime(time, activePeriod)), xForTime: (time: string) => base.xForTime(canonicalPeriodTime(time, activePeriod)) }
  }, [activePeriod, activePrediction?.days.length, domainTimes, isStudio, maxPrice, minPrice, times])
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
    if (isStudio) setRightTab('prediction')
    setSelectedPredictionDay(day)
    const scroll = chartScrollRef.current
    if (!scroll || !transform.hasTime(day)) return
    const dayX = transform.xForTime(day) / 960 * scroll.scrollWidth
    scroll.scrollLeft = Math.max(0, dayX - scroll.clientWidth / 2)
  }

  if (!snapshot || !snapshot.dailyCandles.length) {
    if (!snapshot && (status === 'loading' || status === 'refreshing')) return <MarketLoadingState variant="chart" />
    if (!snapshot && status === 'error') return <section className="sc-chart-error-state"><MarketFeedback errorMessage={errorMessage} onRetry={onRetry} status={status} /></section>
    return <section className="sc-live-empty" aria-live="polite"><p className="sc-eyebrow">K 线 · 真实行情</p><h1>真实行情暂不可用</h1><p>没有收到可绘制的 K 线数据，请检查阿里云行情服务。</p></section>
  }

  const inspector = <ObjectInspector drawing={selectedDrawing} onChange={changeSelectedDrawing} onCopy={copySelectedDrawing} onDelete={deleteSelectedDrawing} />
  const drawingList = isStudio ? <DrawingList drawings={drawings} selectedId={selectedId} onSelect={(id) => { const drawing = drawings.find((item) => item.id === id); if (drawing?.points.some((point) => !transform.times.includes(canonicalPeriodTime(point.time, activePeriod)))) setHistoryWindow(0); commands.select(id) }} /> : null
  const recovery = <RecoveryPanel onRestore={restoreRecovery} records={workspace.recovery ?? []} />

  return (
    <section className={`sc-kline-workspace sc-kline-terminal ${isStudio ? 'rs-chart-workspace' : ''}`}>
      <MarketFeedback errorMessage={errorMessage} hasSnapshot onRetry={onRetry} status={status} />
      {!isStudio ? <header className="sc-kline-header sc-kline-summary">
        <div><p className="sc-eyebrow">价格结构 · 多周期观察</p><div className="sc-kline-title-row"><h1>专业 K 线</h1><span>{snapshot.quote.security.name}</span><code>{snapshot.quote.security.code}</code></div><p className="sc-kline-subtitle">真实行情 + 未来 3 日指标推演 · K 线数据与绘图数据独立</p></div>
        <div className="sc-kline-quote"><strong>{priceText(currentPrice)}</strong><span className={snapshot.quote.price >= (snapshot.quote.previousClose ?? snapshot.quote.price) ? 'is-rise' : ''}>收盘参考价</span></div>
      </header> : null}

      <div className="sc-kline-main-grid sc-kline-content">
        <aside aria-label="桌面绘图工具" className="sc-chart-left-tools"><ChartToolbar activeTool={activeTool} onToolChange={setActiveTool} compact={isStudio} />{!isStudio ? <button aria-pressed={crosshair} className={crosshair ? 'is-active' : ''} onClick={() => setCrosshair((value) => !value)} title="十字光标" type="button">十字光标</button> : null}</aside>

        <div className="sc-kline-main-column">
          {isStudio ? <StudioChartControls period={activePeriod} onPeriod={setActivePeriod} indicators={indicators} onIndicator={(key, value) => setIndicators((old) => ({ ...old, [key]: value }))} predictionVisible={layers.prediction} onPrediction={(value) => setLayers((old) => ({ ...old, prediction: value }))} zoom={zoom} onZoom={setZoom} onReset={resetView} onUndo={commands.undo} onRedo={commands.redo} crosshair={crosshair} onCrosshair={() => setCrosshair((value) => !value)} /> : <div className="sc-kline-controls sc-kline-control-card">
            <div className="sc-kline-control-row" aria-label="K线周期"><span className="sc-kline-group-label">K线周期</span><div className="sc-kline-segmented" role="tablist" aria-label="K线周期">{periods.map(([period, label]) => <button aria-selected={activePeriod === period} className={activePeriod === period ? 'is-active' : ''} key={period} onClick={() => setActivePeriod(period)} role="tab" type="button">{label}</button>)}</div><span className="sc-kline-hint">当前：{periods.find(([period]) => period === activePeriod)?.[1]}</span></div>
            <div className="sc-kline-control-row" aria-label="指标设置"><span className="sc-kline-group-label">指标设置</span><div className="sc-kline-indicator-buttons">{indicatorOptions.map(([key, label]) => <label className={`sc-kline-indicator ${indicators[key] ? 'is-active' : ''}`} key={key} style={{ '--indicator-color': indicatorColors[key] } as React.CSSProperties}><input aria-label={label} checked={indicators[key]} onChange={(event) => setIndicators((old) => ({ ...old, [key]: event.target.checked }))} role="switch" type="checkbox" /><span>{label}</span></label>)}</div><span className="sc-kline-hint">MA5 / 10 / 20 / 30 / 60 / 90 / 120 / 250 · BOLL 20, 2</span></div>
            <div className="sc-kline-control-row" aria-label="视图控制"><span className="sc-kline-group-label">视图</span><button className="sc-kline-control-button" aria-label="缩小" onClick={() => setZoom((value) => Math.max(80, value - 10))} type="button">−</button><span className="sc-kline-zoom" role="status">{zoom}%</span><button className="sc-kline-control-button" aria-label="放大" onClick={() => setZoom((value) => Math.min(150, value + 10))} type="button">＋</button><button className="sc-kline-control-button" onClick={resetView} type="button">复位视图</button><button aria-pressed={crosshair} className={`sc-kline-control-button ${crosshair ? 'is-active' : ''}`} onClick={() => setCrosshair((value) => !value)} type="button">十字光标</button><button className="sc-kline-control-button" onClick={commands.undo} type="button">撤销</button><button className="sc-kline-control-button" onClick={commands.redo} type="button">重做</button></div>
          </div>}

          <div className="sc-chart-mobile-context"><button disabled={!isStudio && (!activePrediction || !layers.prediction)} onClick={() => setMobileSheet('prediction')} type="button">预测详情</button><button onClick={() => setMobileSheet('properties')} type="button">对象属性</button></div>

          <div className="sc-kline-chart-panel">
            <div className="sc-kline-chart-heading"><div className="sc-kline-legend">{intraday ? <><span style={{ color: '#5651da' }}>分时价格</span><span style={{ color: '#c79b28' }}>成交均价</span><span>不含午间休市</span></> : <><span><i className="sc-candle-rise" />历史行情</span>{visiblePrediction ? <span><i className="rs-forecast-swatch" />未来推演</span> : null}{MA_PERIODS.map((period) => { const key = `ma${period}` as MaKey; return indicators[key] ? <span key={key} style={{ color: indicatorColors[key] }}>{`MA${period}`} {movingAverages[key].at(-1)?.toFixed(2) ?? '—'}</span> : null })}</>}</div></div>
            {series.loading ? <p className="rs-series-message" role="status">正在加载{PERIOD_LABELS[activePeriod]}行情…</p> : null}
            {series.error ? <p className="rs-series-message is-error" role="status">{series.error}<button type="button" onClick={series.retry}>重新加载该周期</button></p> : null}
            <div className="sc-kline-chart-scroll" ref={chartScrollRef}>{candles.length ? <div className="sc-kline-chart-surface" data-zoom={zoom} style={{ width: `${zoom}%` }}><ChartCanvas activeTool={activeTool} candles={candles} kind={intraday ? 'intraday' : 'candles'} previousClose={series.data?.previousClose} crosshair={crosshair} drawings={drawings} hoveredDay={hoveredDay} indicatorValues={indicatorValues} indicators={indicators} keyLevels={keyLevels} onCreateDrawing={(drawing) => { commands.create(drawing); if (isStudio) { setRightTab('drawings'); setActiveTool('pointer') } }} onDeleteSelected={deleteSelectedDrawing} onHoverDay={setHoveredDay} onMoveDrawing={moveDrawing} onMovePoint={moveDrawingPoint} onPan={panChart} onPanEnd={commitPan} onRedo={commands.redo} onSelectDrawing={(id) => { commands.select(id); if (isStudio && id) setRightTab('drawings') }} onSelectPredictionDay={selectPredictionDay} onUndo={commands.undo} period={activePeriod} prediction={visiblePrediction} selectedId={selectedId} selectedPredictionDay={activePredictionDay} showDrawings={layers.annotations} showKeyLevels={layers.keyLevels} symbol={symbol} transform={transform} /></div> : <div className="rs-series-empty">{series.loading ? '正在准备图表' : '此周期暂无可绘制的数据，可切换其他周期或重试。'}</div>}</div>
            {isStudio && !intraday ? <div className="rs-chart-range"><div aria-label="历史显示范围">{[[30, '30 根'], [60, '60 根'], [120, '120 根'], [0, '全部']] .map(([count, label]) => <button key={count} type="button" aria-pressed={historyWindow === count} onClick={() => setHistoryWindow(Number(count))}>{label}</button>)}</div><span>{activeTool === 'pointer' ? '选择对象以编辑 · 滚动查看图表' : activeTool === 'trend-line' || activeTool === 'rectangle' ? '按住并拖动绘制 · Esc 取消' : '在图表中点击放置标记'}</span></div> : null}
            {!intraday && !series.loading && MA_PERIODS.some((period) => indicators[`ma${period}`] && allCandles.length < period) ? <p className="rs-history-warning">{MA_PERIODS.filter((period) => indicators[`ma${period}`] && allCandles.length < period).map((period) => `MA${period}`).join('、')} 历史不足：当前提供 {allCandles.length} 根{PERIOD_LABELS[activePeriod]}。均线数字表示当前周期根数。</p> : null}
            {series.data?.note ? <p className="rs-series-note">{series.data.note}</p> : null}
            <div className="sc-kline-statusbar"><span>共 {candles.length} {intraday ? '个分时点' : '根 K 线'}</span><span>当前周期：{PERIOD_LABELS[activePeriod]}</span><span>数据源：{series.data?.source.name ?? snapshot.source.name}</span><span>不复权</span><span>{symbol === 'DEMO' ? '示例绘图仅保存在本机' : syncStatus === '本机保存' ? '本机保存 · 登录后跨设备同步' : syncStatus}</span></div>
          </div>
          {!isStudio && (activeTool === 'rectangle' || activeTool === 'trend-line') && <button className="sc-kline-add-annotation" onClick={addRectangle} type="button">添加矩形标注</button>}
          {activePeriod !== 'day' && layers.prediction ? <section aria-live="polite" className="sc-prediction-unavailable">未来推演仅支持日线周期</section> : null}
          {!isStudio && visiblePrediction ? <PredictionDetails mode="desktop-table" onSelectDay={selectPredictionDay} prediction={visiblePrediction} selectedDay={detailPredictionDay} /> : null}
          {footer}
        </div>

        <aside aria-label="图层与对象属性" className="sc-kline-side-column sc-chart-right-rail">{isStudio ? <><div className="rs-rail-tabs" role="tablist" aria-label="侧栏内容"><button role="tab" aria-selected={rightTab === 'prediction'} onClick={() => setRightTab('prediction')} type="button">预测</button><button role="tab" aria-selected={rightTab === 'drawings'} onClick={() => setRightTab('drawings')} type="button">绘图与图层 <span>{drawings.length}</span></button></div>{rightTab === 'prediction' ? <ForecastPanel prediction={activePrediction} selectedDay={detailPredictionDay} onSelectDay={selectPredictionDay} currentPrice={currentPrice} status={forecastStatus} error={forecastError} onRetry={onRetry} hidden={!layers.prediction} onShow={() => setLayers((old) => ({ ...old, prediction: true }))} period={activePeriod} /> : <>{inspector}{drawingList}<ChartLayerPanel layers={layers} onChange={(key, value) => setLayers((old) => ({ ...old, [key]: value }))} />{workspace.recovery?.length ? recovery : null}</>}</> : <><ChartLayerPanel layers={layers} onChange={(key, value) => setLayers((old) => ({ ...old, [key]: value }))} />{inspector}{recovery}<section className="sc-kline-side-card"><p className="sc-eyebrow">当前观察</p><h2>{snapshot.quote.security.name}</h2><dl><div><dt>现价</dt><dd>{priceText(currentPrice)}</dd></div><div><dt>数据源</dt><dd>{snapshot.source.name}</dd></div><div><dt>更新时间</dt><dd>{new Date(snapshot.source.fetchedAt).toLocaleString('zh-CN')}</dd></div></dl></section></>}</aside>
      </div>

      <nav aria-label="移动绘图工具" className="sc-chart-mobile-toolbar" data-testid="chart-mobile-toolbar"><button aria-pressed={activeTool === 'pointer'} onClick={() => setActiveTool('pointer')} type="button"><span aria-hidden="true">↖</span>选择</button><button aria-pressed={activeTool === 'trend-line'} onClick={() => setActiveTool('trend-line')} type="button"><span aria-hidden="true">╱</span>趋势线</button><button aria-pressed={activeTool === 'horizontal-line'} onClick={() => setActiveTool('horizontal-line')} type="button"><span aria-hidden="true">─</span>水平线</button><button aria-haspopup="dialog" aria-pressed={markerTools.some(([tool]) => tool === activeTool)} onClick={() => setMobileSheet('markers')} type="button"><span aria-hidden="true">◆</span>标记</button><button aria-haspopup="dialog" onClick={() => setMobileSheet('more')} type="button"><span aria-hidden="true">•••</span>更多</button></nav>

      {mobileSheet === 'prediction' ? <ChartMobileSheet onClose={() => setMobileSheet(null)} title="预测详情">{visiblePrediction ? <PredictionDetails mode="mobile-sheet" onSelectDay={selectPredictionDay} prediction={visiblePrediction} selectedDay={detailPredictionDay} /> : <ForecastPanel prediction={activePrediction} selectedDay={detailPredictionDay} onSelectDay={selectPredictionDay} currentPrice={currentPrice} status={forecastStatus} error={forecastError} onRetry={onRetry} hidden={!layers.prediction} onShow={() => setLayers((old) => ({ ...old, prediction: true }))} period={activePeriod} />}</ChartMobileSheet> : null}
      {mobileSheet === 'properties' ? <ChartMobileSheet onClose={() => setMobileSheet(null)} title="对象属性">{inspector}{drawingList}{recovery}</ChartMobileSheet> : null}
      {mobileSheet === 'markers' ? <ChartMobileSheet onClose={() => setMobileSheet(null)} title="标记类型"><div className="sc-chart-marker-picker">{markerTools.map(([tool, label]) => <button aria-pressed={activeTool === tool} key={tool} onClick={() => chooseMobileTool(tool)} type="button">{label}</button>)}</div></ChartMobileSheet> : null}
      {mobileSheet === 'more' ? <ChartMobileSheet onClose={() => setMobileSheet(null)} title="更多图表工具"><ChartToolbar activeTool={activeTool} onToolChange={chooseMobileTool} /><ChartLayerPanel layers={layers} onChange={(key, value) => setLayers((old) => ({ ...old, [key]: value }))} /><section aria-label="指标设置" className="sc-chart-sheet-indicators"><h3>指标设置</h3>{indicatorOptions.map(([key, label]) => <label key={key}><input aria-label={`移动端${label}`} checked={indicators[key]} onChange={(event) => setIndicators((old) => ({ ...old, [key]: event.target.checked }))} role="switch" type="checkbox" /><span>{label}</span></label>)}</section></ChartMobileSheet> : null}
    </section>
  )
}
