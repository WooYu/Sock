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
import { IndicatorForecastDetails } from './indicator-forecast-details'
import { projectIndicators, projectSessionIndicators } from './indicator-projection'
import { scenarioCalendar } from '../scenario/scenario-calendar-data'
import { useChartViewport } from './use-chart-viewport'
import { ChartMobileSheet } from './chart-mobile-sheet'
import { PredictionDetails } from './prediction-details'
import { ObjectInspector, type DrawingInspectorChange } from './object-inspector'
import { loadChartWorkspace } from './chart-workspace-sync'
import type { PriceReference } from '../scenario/scenario-types'
import { ForecastPanel } from '../research/forecast-panel'
import { StudioChartControls } from '../research/studio-chart-controls'
import { DrawingList } from '../research/drawing-list'
import { isIntradayPeriod, CHART_PERIODS, DEFAULT_INDICATORS, MA_COLORS, MA_PERIODS, PERIOD_LABELS, canonicalPeriodTime, type IndicatorKey, type IndicatorValue, type MaKey } from './chart-periods'
import { useChartSeries, type ChartSeriesLoader } from './use-chart-series'
import { isShanghaiComposite } from '@/lib/api/market-symbol'

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

export function ChartWorkspace({ snapshot, prediction = null, status = 'ready', errorMessage, onRetry, variant = 'classic', forecastStatus, forecastError, forecastPanel, forecastReferences, footer, loadSeries, period: controlledPeriod, onPeriodChange }: { snapshot?: MarketSnapshot | null; prediction?: PredictionSnapshot | null; status?: WorkspaceStatus; errorMessage?: string | null; onRetry?: () => void; variant?: 'classic' | 'studio'; forecastStatus?: 'idle' | 'loading' | 'ready' | 'error'; forecastError?: string | null; forecastPanel?: React.ReactNode; forecastReferences?: PriceReference[]; footer?: React.ReactNode; loadSeries?: ChartSeriesLoader; period?: ChartPeriod; onPeriodChange?: (period: ChartPeriod) => void }) {
  const isStudio = variant === 'studio'
  const [rightTab, setRightTab] = useState<'prediction' | 'drawings'>('prediction')
  const [activeTool, setActiveTool] = useState<ChartTool>('pointer')
  const [navigationMode, setNavigationMode] = useState<'inspect' | 'pan'>('inspect')
  const [manualPrice, setManualPrice] = useState<{ key: string; min: number; max: number } | null>(null)
  const [internalPeriod, setInternalPeriod] = useState<ChartPeriod>('day')
  const activePeriod = controlledPeriod ?? internalPeriod
  const setActivePeriod = (period: ChartPeriod) => { if (controlledPeriod === undefined) setInternalPeriod(period); onPeriodChange?.(period) }
  const symbol = snapshot?.quote.security.code ?? ''
  const [adjustment, setAdjustment] = useState<'none' | 'qfq' | 'hfq'>((isStudio && loadSeries) || !snapshot ? 'qfq' : snapshot.adjustment ?? 'none')
  const index = isShanghaiComposite(symbol)
  const priceBasis = symbol === 'DEMO' || index || isIntradayPeriod(activePeriod) ? 'none' : adjustment
  const { workspace, drawings, selectedId, syncStatus, commands } = useChartWorkspace({ symbol: priceBasis === 'none' ? symbol : `${symbol}-${priceBasis}`, period: activePeriod, localOnly: symbol === 'DEMO' })
  const [maVisible, setMaVisible] = useState(true)
  const configuredIndicators = { ...DEFAULT_INDICATORS, ...workspace.indicators }
  const indicators = { ...configuredIndicators, ...(maVisible ? {} : Object.fromEntries(MA_PERIODS.map(period => [`ma${period}`, false]))) }
  const layers: ChartLayerState = { keyLevels: true, annotations: true, prediction: true, ...workspace.layers }
  const zoom = workspace.view.zoom
  const crosshair = workspace.crosshair
  const [hoveredDay, setHoveredDay] = useState<string | null>(null)
  const [selectedPredictionDay, setSelectedPredictionDay] = useState<string | null>(null)
  const [selectedProjectionTime, setSelectedProjectionTime] = useState<string | null>(null)
  const [mobileSheet, setMobileSheet] = useState<MobileSheet>(null)
  const chartScrollRef = useRef<HTMLDivElement>(null)
  const viewportState = useRef({ key: '', predictionKey: '', userPanned: false })
  const revealedDrawingLocation = useRef('')

  const series = useChartSeries(snapshot, activePeriod, loadSeries, priceBasis)
  const intraday = activePeriod === 'intraday'
  const sourceCandles = useMemo(() => [...(series.data?.bars ?? [])].map(bar => index ? { ...bar, averagePrice: undefined } : bar).sort((a, b) => a.day.localeCompare(b.day)), [series.data?.bars, index])
  const allCandles = sourceCandles
  const viewport = useChartViewport(`${symbol}:${activePeriod}`, allCandles.length)
  const visibleStart = isStudio && !intraday ? viewport.start : 0
  const visibleEnd = isStudio && !intraday ? viewport.end : allCandles.length
  const candles = useMemo(() => allCandles.slice(visibleStart, visibleEnd), [allCandles, visibleStart, visibleEnd])
  const activePrediction = useMemo(() => activePeriod === 'day' && prediction?.period === 'day' && prediction.symbol === symbol && sourceCandles.length && prediction.days[0].day > sourceCandles.at(-1)!.day ? withPredictionMovingAverages(sourceCandles, prediction) : null, [activePeriod, prediction, sourceCandles, symbol])
  const activePredictionDay = activePrediction?.days.some((day) => day.day === selectedPredictionDay) ? selectedPredictionDay : activePrediction?.days[0].day ?? null
  const detailPredictionDay = hoveredDay ?? activePredictionDay
  const fullMovingAverages = useMemo(() => Object.fromEntries(MA_PERIODS.map(period => [`ma${period}`, movingAverage(allCandles, period)])) as Record<MaKey, IndicatorValue[]>, [allCandles])
  const movingAverages = useMemo(() => Object.fromEntries(MA_PERIODS.map(period => { const key = `ma${period}` as MaKey; return [key, fullMovingAverages[key].slice(visibleStart, visibleEnd)] })) as Record<MaKey, IndicatorValue[]>, [fullMovingAverages, visibleStart, visibleEnd])
  const fullBoll = useMemo(() => bollinger(allCandles, 20, 2), [allCandles])
  const boll = useMemo(() => ({ upper: fullBoll.upper.slice(visibleStart, visibleEnd), middle: fullBoll.middle.slice(visibleStart, visibleEnd), lower: fullBoll.lower.slice(visibleStart, visibleEnd) }), [fullBoll, visibleStart, visibleEnd])
  const projection = useMemo(() => {
    if (!isStudio || activePrediction) return []
    return projectIndicators(allCandles, activePeriod, scenarioCalendar).map(point => {
      const refs = forecastReferences?.filter(ref => (ref.adjustment ?? 'none') === priceBasis && ref.period === activePeriod && ref.target.horizon === point.horizon && ref.originBarKey === allCandles.at(-1)?.day) ?? []
      const target = refs.find(ref => ref.target.barKey)?.target.barKey
      const ranges = { ...point.ranges }
      for (const ref of refs) if (!ref.valid) delete ranges[ref.indicator]
      return { ...point, ranges, ...(target ? { day: target, estimated: false } : {}), values: { ...point.values, ...Object.fromEntries(refs.map(ref => [ref.indicator, ref.valid ? ref.value : null])) } }
    })
  }, [activePeriod, activePrediction, allCandles, isStudio, forecastReferences, priceBasis])
  const sessionProjection = useMemo(() => isStudio && layers.prediction ? projectSessionIndicators(allCandles, activePeriod, scenarioCalendar) : null, [activePeriod, allCandles, isStudio, layers.prediction])
  const visibleProjection = useMemo(() => layers.prediction && (intraday || viewport.atLatest) ? projection : [], [layers.prediction, intraday, viewport.atLatest, projection])
  const visiblePrediction = layers.prediction && (!isStudio || viewport.atLatest) ? activePrediction : null
  const indicatorValues = useMemo(() => ({
    ...Object.fromEntries(MA_PERIODS.map((period) => { const key = `ma${period}` as MaKey; return [key, [...movingAverages[key], ...(visibleProjection.length ? visibleProjection.map(point => point.values[key] ?? null) : visiblePrediction?.days.map((day) => day[key] ?? null) ?? [])]] })) as Record<MaKey, IndicatorValue[]>,
    boll: {
      upper: [...boll.upper, ...(visibleProjection.length ? visibleProjection.map(point => point.values.bollUpper ?? null) : visiblePrediction?.days.map((day) => day.bollUpper) ?? [])],
      middle: [...boll.middle, ...(visibleProjection.length ? visibleProjection.map(point => point.values.bollMiddle ?? null) : visiblePrediction?.days.map((day) => day.bollMiddle) ?? [])],
      lower: [...boll.lower, ...(visibleProjection.length ? visibleProjection.map(point => point.values.bollLower ?? null) : visiblePrediction?.days.map((day) => day.bollLower) ?? [])],
    },
  }), [boll, movingAverages, visiblePrediction, visibleProjection])
  const keyLevels = useMemo(() => candles.length ? [Math.max(...candles.slice(-20).map((candle) => candle.high)), Math.min(...candles.slice(-20).map((candle) => candle.low))] : [], [candles])
  const lastClose = candles[candles.length - 1]?.close ?? snapshot?.quote.price ?? 0
  const currentPrice = snapshot?.quote.price ?? lastClose
  const values = [
    ...candles.flatMap((candle) => [candle.high, candle.low]),
    ...(visiblePrediction?.days.flatMap((day) => [day.high, day.low, day.rangeHigh, day.rangeLow]) ?? []),
    ...(MA_PERIODS.flatMap((period) => indicators[`ma${period}`] ? indicatorValues[`ma${period}`] : [])),
    ...(intraday && !index ? candles.map(bar => bar.averagePrice) : []),
    ...(indicators.boll ? [...indicatorValues.boll.upper, ...indicatorValues.boll.lower] : []),
    ...visibleProjection.flatMap(point => Object.entries(point.ranges).filter(([key]) => key.startsWith('boll') ? indicators.boll : indicators[key as MaKey]).flatMap(([, range]) => range ?? [])),
    ...(intraday && series.data?.previousClose ? [series.data.previousClose] : []),
    ...(!isStudio || viewport.atLatest ? [currentPrice] : []),
  ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const priceViewKey = `${symbol}:${activePeriod}:${priceBasis}`
  const automaticMax = Math.max(...values, lastClose) + 0.25
  const automaticMin = Math.min(...values, lastClose) - 0.25
  const manualPriceActive = manualPrice?.key === priceViewKey
  const maxPrice = manualPriceActive ? manualPrice.max : automaticMax
  const minPrice = manualPriceActive ? manualPrice.min : automaticMin
  const panPrice = (fraction: number) => setManualPrice(previous => {
    const range = previous?.key === priceViewKey ? previous : { min: automaticMin, max: automaticMax }
    const delta = (range.max - range.min) * fraction
    return { key: priceViewKey, min: range.min + delta, max: range.max + delta }
  })
  const scalePrice = (factor: number) => setManualPrice(previous => {
    const range = previous?.key === priceViewKey ? previous : { min: automaticMin, max: automaticMax }
    const center = (range.max + range.min) / 2
    const span = Math.max(0.01, Math.min(1e9, (range.max - range.min) * factor))
    return { key: priceViewKey, min: center - span / 2, max: center + span / 2 }
  })
  const times = useMemo(() => [...candles.map((candle) => candle.day), ...visibleProjection.map(point => point.day), ...(visiblePrediction?.days.map((day) => day.day) ?? [])], [visiblePrediction, visibleProjection, candles])
  const domainTimes = useMemo(() => [...allCandles.map((candle) => candle.day), ...projection.map(point => point.day), ...(activePrediction?.days.map((day) => day.day) ?? [])], [activePrediction, projection, allCandles])
  const transform = useMemo(() => {
    const base = createChartTransform({ times: times.length ? times : [''], domainTimes: domainTimes.length ? domainTimes : undefined, minPrice, maxPrice, rect: { left: isStudio ? 42 : 58, top: 22, width: 850, height: 300 }, futureCount: isStudio ? visibleProjection.length || visiblePrediction?.days.length : undefined })
    return { ...base, hasTime: (time: string) => base.hasTime(time.startsWith('forecast:') ? time : canonicalPeriodTime(time, activePeriod)), xForTime: (time: string) => base.xForTime(time.startsWith('forecast:') ? time : canonicalPeriodTime(time, activePeriod)) }
  }, [activePeriod, visibleProjection.length, visiblePrediction?.days.length, domainTimes, isStudio, maxPrice, minPrice, times])
  const selectedDrawing = drawings.find((drawing) => drawing.id === selectedId) ?? null
  const selectedDrawingTime = selectedDrawing?.points[0]?.time ?? ''
  const selectedDrawingLocation = selectedDrawing ? `${selectedDrawing.id}:${selectedDrawingTime}` : ''

  useEffect(() => {
    const scroll = chartScrollRef.current
    const key = `${symbol}:${activePeriod}`
    if (!scroll || isStudio) return
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
  }, [activePeriod, activePrediction?.generatedAt, isStudio, symbol, workspace.revision, workspace.view.panX])

  useEffect(() => {
    const scroll = chartScrollRef.current
    if (revealedDrawingLocation.current === selectedDrawingLocation) return
    revealedDrawingLocation.current = selectedDrawingLocation
    if (isStudio && selectedDrawingTime) {
      const index = allCandles.findIndex(bar => bar.day === canonicalPeriodTime(selectedDrawingTime, activePeriod))
      if (index >= 0 && (index < visibleStart || index >= visibleEnd)) viewport.reveal(index)
      return
    }
    if (!scroll || !selectedDrawingTime || !transform.hasTime(selectedDrawingTime) || !scroll.scrollWidth) return
    const pointX = transform.xForTime(selectedDrawingTime) / 960 * scroll.scrollWidth
    const margin = Math.min(80, scroll.clientWidth / 4)
    if (pointX < scroll.scrollLeft + margin || pointX > scroll.scrollLeft + scroll.clientWidth - margin) scroll.scrollLeft = Math.max(0, pointX - scroll.clientWidth / 2)
  }, [activePeriod, allCandles, isStudio, selectedDrawingLocation, selectedDrawingTime, transform, viewport, visibleStart, visibleEnd])

  const setIndicators = commands.setIndicators
  const setLayers = commands.setLayers
  const setCrosshair = commands.setCrosshair
  const setZoom = (update: number | ((value: number) => number)) => {
    if (isStudio && !intraday) {
      const next = typeof update === 'function' ? update(zoom) : update
      viewport.zoomBy(next > zoom ? 0.8 : 1.25)
    } else commands.setView(view => ({ ...view, zoom: typeof update === 'function' ? update(view.zoom) : update }))
  }
  const zoomViewport = viewport.zoomBy
  const panViewport = viewport.panBy
  useEffect(() => {
    const scroll = chartScrollRef.current
    if (!scroll || !isStudio || intraday) return
    const wheel = (event: WheelEvent) => {
      if (!event.deltaX && !event.deltaY) return
      const zoomIntent = event.ctrlKey || event.metaKey
      const panIntent = navigationMode === 'pan' && (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) * 1.4)
      if (!zoomIntent && !panIntent) return
      event.preventDefault()
      if (!zoomIntent && panIntent) {
        panViewport((event.deltaX || event.deltaY) / Math.max(1, scroll.clientWidth) * viewport.count)
      } else {
        const rect = scroll.getBoundingClientRect()
        const plotRatio = ((event.clientX - rect.left) / Math.max(1, rect.width) * 960 - 42) / (850 * ((visiblePrediction || visibleProjection.length) ? 0.85 : 1))
        zoomViewport(Math.exp(Math.max(-0.35, Math.min(0.35, event.deltaY * 0.002))), plotRatio)
      }
    }
    scroll.addEventListener('wheel', wheel, { passive: false })
    return () => scroll.removeEventListener('wheel', wheel)
  }, [intraday, isStudio, navigationMode, panViewport, viewport.count, visiblePrediction, visibleProjection.length, zoomViewport])
  const addRectangle = () => {
    const end = candles.at(-1)
    const start = candles.at(-2) ?? end
    if (!start || !end) return
    commands.create({ id: `rectangle-${crypto.randomUUID()}`, symbol, period: activePeriod, kind: 'rectangle', points: [{ time: start.day, price: start.low }, { time: end.day, price: end.high }], style: { color: '#ef4444', width: 2, lineStyle: 'solid', opacity: 1 }, locked: false, visible: true, version: 0, updatedAt: new Date().toISOString() })
  }
  const resetView = () => {
    setManualPrice(null)
    if (isStudio && !intraday) { viewport.reset(); return }
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
    if (isStudio && !intraday) {
      const width = (chartScrollRef.current?.clientWidth || 960) * 850 / 960 * ((visiblePrediction || visibleProjection.length) ? 0.85 : 1)
      viewport.panBy(deltaX / width * viewport.count)
    } else if (chartScrollRef.current) chartScrollRef.current.scrollLeft += deltaX
  }
  const commitPan = () => {
    if (isStudio && !intraday) return
    const scroll = chartScrollRef.current
    if (scroll && scroll.scrollLeft !== workspace.view.panX) commands.setView((view) => ({ ...view, panX: scroll.scrollLeft }))
  }
  const chooseMobileTool = (tool: ChartTool) => { setActiveTool(tool); setMobileSheet(null) }
  const selectPredictionDay = (day: string) => {
    if (isStudio) setRightTab('prediction')
    setSelectedPredictionDay(day)
    if (isStudio) { viewport.latest(); return }
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
  const drawingList = isStudio ? <DrawingList drawings={drawings} selectedId={selectedId} onSelect={(id) => { const drawing = drawings.find((item) => item.id === id); if (drawing?.points[0]) { const index = allCandles.findIndex(bar => bar.day === canonicalPeriodTime(drawing.points[0].time, activePeriod)); if (index >= 0 && (index < visibleStart || index >= visibleEnd)) viewport.reveal(index) } commands.select(id) }} /> : null
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
          {isStudio ? <div className="rs-price-basis"><label>价格口径 <select aria-label="价格复权方式" value={priceBasis} disabled={index || isIntradayPeriod(activePeriod) || symbol === 'DEMO'} onChange={event => setAdjustment(event.target.value as typeof adjustment)}><option value="qfq">前复权（默认）</option><option value="none">不复权</option><option value="hfq">后复权</option></select></label><span>{index ? '指数无需复权，各周期统一使用原始点位' : isIntradayPeriod(activePeriod) ? '分钟数据仅提供不复权' : 'MA按本周期收盘价计算；跨软件对照需统一日期、周期与复权方式'}</span></div> : null}
          {isStudio ? <StudioChartControls period={activePeriod} onPeriod={setActivePeriod} maVisible={maVisible} onMaVisibility={() => setMaVisible(value => !value)} indicators={indicators} onIndicator={(key, value) => setIndicators((old) => ({ ...old, [key]: value }))} predictionVisible={layers.prediction} onPrediction={(value) => setLayers((old) => ({ ...old, prediction: value }))} zoom={zoom} onZoom={setZoom} onReset={resetView} onUndo={commands.undo} onRedo={commands.redo} crosshair={crosshair} onCrosshair={() => setCrosshair((value) => !value)} /> : <div className="sc-kline-controls sc-kline-control-card">
            <div className="sc-kline-control-row" aria-label="K线周期"><span className="sc-kline-group-label">K线周期</span><div className="sc-kline-segmented" role="tablist" aria-label="K线周期">{periods.map(([period, label]) => <button aria-selected={activePeriod === period} className={activePeriod === period ? 'is-active' : ''} key={period} onClick={() => setActivePeriod(period)} role="tab" type="button">{label}</button>)}</div><span className="sc-kline-hint">当前：{periods.find(([period]) => period === activePeriod)?.[1]}</span></div>
            <div className="sc-kline-control-row" aria-label="指标设置"><span className="sc-kline-group-label">指标设置</span><div className="sc-kline-indicator-buttons">{indicatorOptions.map(([key, label]) => <label className={`sc-kline-indicator ${indicators[key] ? 'is-active' : ''}`} key={key} style={{ '--indicator-color': indicatorColors[key] } as React.CSSProperties}><input aria-label={label} checked={indicators[key]} onChange={(event) => setIndicators((old) => ({ ...old, [key]: event.target.checked }))} role="switch" type="checkbox" /><span>{label}</span></label>)}</div><span className="sc-kline-hint">MA5 / 10 / 20 / 30 / 60 / 90 / 120 / 250 · BOLL 20, 2</span></div>
            <div className="sc-kline-control-row" aria-label="视图控制"><span className="sc-kline-group-label">视图</span><button className="sc-kline-control-button" aria-label="缩小" onClick={() => setZoom((value) => Math.max(80, value - 10))} type="button">−</button><span className="sc-kline-zoom" role="status">{zoom}%</span><button className="sc-kline-control-button" aria-label="放大" onClick={() => setZoom((value) => Math.min(150, value + 10))} type="button">＋</button><button className="sc-kline-control-button" onClick={resetView} type="button">复位视图</button><button aria-pressed={crosshair} className={`sc-kline-control-button ${crosshair ? 'is-active' : ''}`} onClick={() => setCrosshair((value) => !value)} type="button">十字光标</button><button className="sc-kline-control-button" onClick={commands.undo} type="button">撤销</button><button className="sc-kline-control-button" onClick={commands.redo} type="button">重做</button></div>
          </div>}

          <div className="sc-chart-mobile-context"><button disabled={!isStudio && (!activePrediction || !layers.prediction)} onClick={() => setMobileSheet('prediction')} type="button">预测详情</button><button onClick={() => setMobileSheet('properties')} type="button">对象属性</button></div>

          <div className="sc-kline-chart-panel">
            <div className="sc-kline-chart-heading"><div className="sc-kline-legend">{intraday ? <><span style={{ color: '#5651da' }}>分时价格</span>{index ? <span>指数不展示成交均价</span> : <span style={{ color: '#c79b28' }}>成交均价</span>}<span>不含午间休市</span></> : <><span><i className="sc-candle-rise" />历史行情</span>{visiblePrediction || visibleProjection.length ? <span><i className="rs-forecast-swatch" />MA/BOLL 后4根 · 点选查看</span> : null}{MA_PERIODS.map((period) => { const key = `ma${period}` as MaKey; return indicators[key] ? <span key={key} style={{ color: indicatorColors[key] }}>{`MA${period}`} {movingAverages[key].at(-1)?.toFixed(2) ?? '—'}</span> : null })}</>}</div></div>
            {series.loading ? <p className="rs-series-message" role="status">正在加载{PERIOD_LABELS[activePeriod]}行情…</p> : null}
            {series.error ? <p className="rs-series-message is-error" role="status">{series.error}<button type="button" onClick={series.retry}>重新加载该周期</button></p> : null}
            {visibleProjection.length ? <p className="rs-auto-method">{activePeriod === 'day' ? '未来4个交易日' : `${PERIOD_LABELS[activePeriod]}未来4根`} · 按最近3根指标平均增量外推，包含全部已选 MA；区间取最近两次增量分别延续的情景范围，不是置信区间。{visibleProjection.some(point => point.estimated) ? '横轴为预计时间，仅跳过周末，节假日待核实。' : '横轴按已核实交易日历。'}指针移入历史 K 线查看价格和 MA/BOLL；点选预测时间查看数值与相对末根收盘的涨跌幅。实心圆点 / ◆ 表示按交易日累计涨跌幅限制内的值；数据不足的指标显示“—”。</p> : null}
            <div className="sc-kline-chart-scroll" ref={chartScrollRef}>{candles.length ? <div className="sc-kline-chart-surface" data-zoom={isStudio ? Math.round(allCandles.length / Math.max(1, viewport.count) * 100) : zoom} data-price-min={minPrice} data-price-max={maxPrice} data-price-auto={!manualPriceActive} data-visible-start={visibleStart} data-visible-end={visibleEnd} style={{ width: isStudio ? '100%' : `${zoom}%` }}><ChartCanvas key={`${symbol}:${activePeriod}:${priceBasis}`} navigationMode={isStudio ? activeTool === 'pan' ? 'pan' : activeTool === 'pointer' ? navigationMode : 'inspect' : undefined} onPricePan={isStudio ? panPrice : undefined} onPriceScale={isStudio ? scalePrice : undefined} onPriceReset={isStudio ? () => setManualPrice(null) : undefined} precedingClose={visibleStart > 0 ? allCandles[visibleStart - 1]?.close : undefined} limitRatio={snapshot?.quote.limitRatio} selectedProjectionTime={selectedProjectionTime} onSelectProjectionTime={setSelectedProjectionTime} projectedTimes={visibleProjection.map(point => point.day)} projectedEstimated={visibleProjection.some(point => point.estimated)} projectedRanges={visibleProjection.map(point => point.ranges)} panOnPointer={isStudio && !intraday} onViewportZoom={isStudio && !intraday ? viewport.zoomBy : undefined} onViewportPan={isStudio && !intraday ? viewport.panBy : undefined} onViewportReset={isStudio ? resetView : undefined} activeTool={activeTool} candles={candles} kind={intraday ? 'intraday' : 'candles'} previousClose={series.data?.previousClose} crosshair={crosshair} drawings={drawings} hoveredDay={hoveredDay} indicatorValues={indicatorValues} indicators={indicators} keyLevels={keyLevels} onCreateDrawing={(drawing) => { commands.create(drawing); if (isStudio) { setRightTab('drawings'); setActiveTool('pointer') } }} onDeleteSelected={deleteSelectedDrawing} onHoverDay={setHoveredDay} onMoveDrawing={moveDrawing} onMovePoint={moveDrawingPoint} onPan={panChart} onPanEnd={commitPan} onRedo={commands.redo} onSelectDrawing={(id) => { commands.select(id); if (isStudio && id) setRightTab('drawings') }} onSelectPredictionDay={selectPredictionDay} onUndo={commands.undo} period={activePeriod} prediction={visiblePrediction} selectedId={selectedId} selectedPredictionDay={activePredictionDay} showDrawings={layers.annotations} showKeyLevels={layers.keyLevels} symbol={symbol} transform={transform} /></div> : <div className="rs-series-empty">{series.loading ? '正在准备图表' : '此周期暂无可绘制的数据，可切换其他周期或重试。'}</div>}</div>
            {isStudio && !intraday ? <div className="rs-chart-navigator" aria-label="图表浏览">
              <div className="rs-chart-navigation-actions"><button type="button" aria-pressed={navigationMode === 'inspect'} onClick={() => { setNavigationMode('inspect'); setActiveTool('pointer') }}>查看价格</button><button type="button" aria-pressed={navigationMode === 'pan'} onClick={() => { setNavigationMode('pan'); setActiveTool('pointer') }}>移动图表</button><button type="button" aria-label="缩小图表" onClick={() => viewport.zoomBy(1.25)} disabled={viewport.count >= viewport.maxCount}>−</button><button type="button" aria-label="放大图表" onClick={() => viewport.zoomBy(0.8)} disabled={viewport.count <= Math.min(12, allCandles.length)}>＋</button><button type="button" onClick={viewport.latest} disabled={viewport.atLatest}>回到最新</button><button type="button" aria-pressed={!manualPriceActive} onClick={() => setManualPrice(null)}>自动价格</button><button type="button" onClick={resetView}>近期复位</button></div>
              <label className="rs-chart-history-slider"><span>浏览历史</span><input aria-label="浏览历史行情" type="range" min={viewport.count} max={allCandles.length} value={viewport.end} onChange={event => viewport.seek(Number(event.target.value))} disabled={viewport.count >= allCandles.length} /><span>{candles[0]?.day.slice(0, 10)} — {candles.at(-1)?.day.slice(0, 10)}</span></label>
              <span className="rs-chart-gesture-hint">{activeTool === 'pointer' || activeTool === 'pan' ? navigationMode === 'inspect' && activeTool !== 'pan' ? '查看模式：拖动只查看价格 · Ctrl/⌘+滚轮或双指缩放 · 右侧价格轴上下拖动' : '移动模式：明确横拖移动时间轴 · 纵向滑动浏览页面 · Ctrl/⌘+滚轮缩放 · 双击复位' : activeTool === 'trend-line' || activeTool === 'rectangle' ? '拖动绘制 · Esc 取消' : '点击放置标记'}</span>
            </div> : null}
            {!intraday && !series.loading && MA_PERIODS.some((period) => indicators[`ma${period}`] && allCandles.length < period) ? <p className="rs-history-warning">{MA_PERIODS.filter((period) => indicators[`ma${period}`] && allCandles.length < period).map((period) => `MA${period}`).join('、')} 历史不足：当前提供 {allCandles.length} 根{PERIOD_LABELS[activePeriod]}。均线数字表示当前周期根数。</p> : null}
            {series.data?.note ? <p className="rs-series-note">{series.data.note}</p> : null}
            <div className="sc-kline-statusbar"><span>已加载 {allCandles[0]?.day.slice(0, 10)} ～ {allCandles.at(-1)?.day.slice(0, 10)} · 共 {allCandles.length} {intraday ? '个分时点' : '根 K 线'}</span><span>当前周期：{PERIOD_LABELS[activePeriod]}</span><span>数据源：{series.data?.source.name ?? snapshot.source.name}</span><span>{series.data?.adjustment === 'qfq' ? '前复权' : series.data?.adjustment === 'hfq' ? '后复权' : '不复权'} · 当前数据窗口，非上市全量</span><span>{symbol === 'DEMO' ? '示例绘图仅保存在本机' : syncStatus === '本机保存' ? '本机保存 · 连接后自动同步' : syncStatus}</span></div>
          </div>
          {!isStudio && (activeTool === 'rectangle' || activeTool === 'trend-line') && <button className="sc-kline-add-annotation" onClick={addRectangle} type="button">添加矩形标注</button>}
          {activePeriod !== 'day' && layers.prediction && !forecastReferences ? <section aria-live="polite" className="sc-prediction-unavailable">未来推演仅支持日线周期</section> : null}
          {visibleProjection.length ? <IndicatorForecastDetails session={sessionProjection} points={visibleProjection} period={activePeriod} indicators={indicators} selectedTime={selectedProjectionTime} onSelect={setSelectedProjectionTime} /> : null}
          {!isStudio && visiblePrediction ? <PredictionDetails mode="desktop-table" onSelectDay={selectPredictionDay} prediction={visiblePrediction} selectedDay={detailPredictionDay} /> : null}
          <nav aria-label="移动绘图工具" className="sc-chart-mobile-toolbar" data-testid="chart-mobile-toolbar"><button aria-pressed={activeTool === 'pointer'} onClick={() => setActiveTool('pointer')} type="button"><span aria-hidden="true">↖</span>选择</button><button aria-pressed={activeTool === 'trend-line'} onClick={() => setActiveTool('trend-line')} type="button"><span aria-hidden="true">╱</span>趋势线</button><button aria-pressed={activeTool === 'horizontal-line'} onClick={() => setActiveTool('horizontal-line')} type="button"><span aria-hidden="true">─</span>水平线</button><button aria-haspopup="dialog" aria-pressed={markerTools.some(([tool]) => tool === activeTool)} onClick={() => setMobileSheet('markers')} type="button"><span aria-hidden="true">◆</span>标记</button><button aria-haspopup="dialog" onClick={() => setMobileSheet('more')} type="button"><span aria-hidden="true">•••</span>更多</button></nav>
        </div>

        <aside aria-label="图层与对象属性" className="sc-kline-side-column sc-chart-right-rail">{isStudio ? <><div className="rs-rail-tabs" role="tablist" aria-label="侧栏内容"><button role="tab" aria-selected={rightTab === 'prediction'} onClick={() => setRightTab('prediction')} type="button">预测</button><button role="tab" aria-selected={rightTab === 'drawings'} onClick={() => setRightTab('drawings')} type="button">绘图与图层 <span>{drawings.length}</span></button></div>{rightTab === 'prediction' ? forecastPanel ?? <ForecastPanel prediction={activePrediction} selectedDay={detailPredictionDay} onSelectDay={selectPredictionDay} currentPrice={currentPrice} status={forecastStatus} error={forecastError} onRetry={onRetry} hidden={!layers.prediction} onShow={() => setLayers((old) => ({ ...old, prediction: true }))} period={activePeriod} /> : <>{inspector}{drawingList}<ChartLayerPanel layers={layers} onChange={(key, value) => setLayers((old) => ({ ...old, [key]: value }))} />{workspace.recovery?.length ? recovery : null}</>}</> : <><ChartLayerPanel layers={layers} onChange={(key, value) => setLayers((old) => ({ ...old, [key]: value }))} />{inspector}{recovery}<section className="sc-kline-side-card"><p className="sc-eyebrow">当前观察</p><h2>{snapshot.quote.security.name}</h2><dl><div><dt>现价</dt><dd>{priceText(currentPrice)}</dd></div><div><dt>数据源</dt><dd>{snapshot.source.name}</dd></div><div><dt>更新时间</dt><dd>{new Date(snapshot.source.fetchedAt).toLocaleString('zh-CN')}</dd></div></dl></section></>}</aside>
        {footer ? <div className="sc-chart-results">{footer}</div> : null}
      </div>



      {mobileSheet === 'prediction' ? <ChartMobileSheet onClose={() => setMobileSheet(null)} title="预测详情">{forecastPanel ?? (visiblePrediction ? <PredictionDetails mode="mobile-sheet" onSelectDay={selectPredictionDay} prediction={visiblePrediction} selectedDay={detailPredictionDay} /> : <ForecastPanel prediction={activePrediction} selectedDay={detailPredictionDay} onSelectDay={selectPredictionDay} currentPrice={currentPrice} status={forecastStatus} error={forecastError} onRetry={onRetry} hidden={!layers.prediction} onShow={() => setLayers((old) => ({ ...old, prediction: true }))} period={activePeriod} />)}</ChartMobileSheet> : null}
      {mobileSheet === 'properties' ? <ChartMobileSheet onClose={() => setMobileSheet(null)} title="对象属性">{inspector}{drawingList}{recovery}</ChartMobileSheet> : null}
      {mobileSheet === 'markers' ? <ChartMobileSheet onClose={() => setMobileSheet(null)} title="标记类型"><div className="sc-chart-marker-picker">{markerTools.map(([tool, label]) => <button aria-pressed={activeTool === tool} key={tool} onClick={() => chooseMobileTool(tool)} type="button">{label}</button>)}</div></ChartMobileSheet> : null}
      {mobileSheet === 'more' ? <ChartMobileSheet onClose={() => setMobileSheet(null)} title="更多图表工具"><ChartToolbar activeTool={activeTool} onToolChange={chooseMobileTool} /><ChartLayerPanel layers={layers} onChange={(key, value) => setLayers((old) => ({ ...old, [key]: value }))} /><section aria-label="指标设置" className="sc-chart-sheet-indicators"><h3>指标设置</h3>{indicatorOptions.map(([key, label]) => <label key={key}><input aria-label={`移动端${label}`} checked={indicators[key]} onChange={(event) => setIndicators((old) => ({ ...old, [key]: event.target.checked }))} role="switch" type="checkbox" /><span>{label}</span></label>)}</section></ChartMobileSheet> : null}
    </section>
  )
}
