'use client'

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { Candle, MarketSnapshot } from '../workspace/stock-workspace-types'
import { ChartAnnotationStore, type ChartAnnotation, type ChartTool } from './chart-annotation-store'
import { ChartLayerPanel, type ChartLayerState } from './chart-layer-panel'
import { ChartToolbar } from './chart-toolbar'
import { mergeChartWorkspace, type ChartWorkspaceSnapshot } from './chart-workspace-state'
import { loadChartSyncCursor, loadChartWorkspace, pullChartWorkspace, pushChartWorkspace, saveChartSyncCursor, saveChartWorkspace } from './chart-workspace-sync'
import { getAuthorizationHeader, getClientId } from '../records/record-sync'

type ChartPeriod = 'day' | 'week' | 'month'
type IndicatorKey = 'ma5' | 'ma10' | 'ma20' | 'boll'

const periods: Array<[ChartPeriod, string]> = [['day', '日线'], ['week', '周线'], ['month', '月线']]
const indicatorOptions: Array<[IndicatorKey, string]> = [['ma5', 'MA5'], ['ma10', 'MA10'], ['ma20', 'MA20'], ['boll', 'BOLL']]
const indicatorColors: Record<IndicatorKey, string> = { ma5: '#d6a12a', ma10: '#4e9bd6', ma20: '#a46ee8', boll: '#6f7fd8' }

function aggregateCandles(candles: Candle[], period: ChartPeriod) {
  const groupSize = period === 'day' ? 1 : period === 'week' ? 5 : 20
  const groups: Candle[] = []
  for (let index = 0; index < candles.length; index += groupSize) {
    const group = candles.slice(index, index + groupSize)
    if (!group.length) continue
    groups.push({
      day: group[0].day,
      open: group[0].open,
      high: Math.max(...group.map((candle) => candle.high)),
      low: Math.min(...group.map((candle) => candle.low)),
      close: group[group.length - 1].close,
      volume: group.reduce((total, candle) => total + candle.volume, 0),
    })
  }
  return groups
}

function movingAverage(candles: Candle[], size: number) {
  return candles.map((_, index) => {
    const values = candles.slice(Math.max(0, index - size + 1), index + 1).map((candle) => candle.close)
    return values.reduce((total, value) => total + value, 0) / values.length
  })
}

function bollinger(candles: Candle[]) {
  const middle = movingAverage(candles, 20)
  const upper: number[] = []
  const lower: number[] = []
  candles.forEach((_, index) => {
    const values = candles.slice(Math.max(0, index - 19), index + 1).map((candle) => candle.close)
    const mean = middle[index]
    const deviation = Math.sqrt(values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length)
    upper.push(mean + deviation * 2)
    lower.push(mean - deviation * 2)
  })
  return { upper, middle, lower }
}

function linePath(values: number[], xForIndex: (index: number) => number, yForValue: (value: number) => number) {
  return values.map((value, index) => `${index === 0 ? 'M' : 'L'} ${xForIndex(index).toFixed(2)} ${yForValue(value).toFixed(2)}`).join(' ')
}

function priceText(value: number) {
  return value.toFixed(2)
}

export function ChartWorkspace({ snapshot }: { snapshot?: MarketSnapshot | null }) {
  const [activeTool, setActiveTool] = useState<ChartTool>('pointer')
  const [activePeriod, setActivePeriod] = useState<ChartPeriod>('day')
  const [indicators, setIndicators] = useState<Record<IndicatorKey, boolean>>({ ma5: true, ma10: true, ma20: true, boll: true })
  const [zoom, setZoom] = useState(100)
  const [crosshair, setCrosshair] = useState(false)
  const [layers, setLayers] = useState<ChartLayerState>({ keyLevels: true, annotations: true })
  const [annotations, setAnnotations] = useState<ChartAnnotation[]>([])
  const [syncStatus, setSyncStatus] = useState<'本机保存' | '同步中' | '已同步' | '待同步'>('本机保存')
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const store = useRef(new ChartAnnotationStore())

  const sourceCandles = useMemo(() => snapshot?.dailyCandles ?? [], [snapshot?.dailyCandles])
  const candles = useMemo(() => aggregateCandles(sourceCandles, activePeriod), [activePeriod, sourceCandles])
  const movingAverages = useMemo(() => ({ ma5: movingAverage(candles, 5), ma10: movingAverage(candles, 10), ma20: movingAverage(candles, 20) }), [candles])
  const boll = useMemo(() => bollinger(candles), [candles])
  const keyLevels = useMemo(() => candles.length ? [Math.max(...candles.slice(-20).map((candle) => candle.high)), Math.min(...candles.slice(-20).map((candle) => candle.low))] : [], [candles])
  const lastClose = candles[candles.length - 1]?.close ?? snapshot?.quote.price ?? 0
  const addRectangle = () => {
    const next = store.current.create({ id: `rectangle-${Date.now()}`, kind: 'rectangle', start: { x: 20, y: 20 }, end: { x: 130, y: 90 } })
    setAnnotations(next)
  }

  const chartPoint = (event: ReactPointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const width = bounds.width || 960
    const height = bounds.height || 430
    return {
      x: Math.max(0, Math.min(960, ((event.clientX - bounds.left) / width) * 960)),
      y: Math.max(0, Math.min(430, ((event.clientY - bounds.top) / height) * 430)),
    }
  }

  const createPointAnnotation = (event: ReactPointerEvent<SVGSVGElement>) => {
    const point = chartPoint(event)
    if (activeTool === 'pointer' || activeTool === 'trend-line' || activeTool === 'rectangle' || activeTool === 'marker') return
    const next = store.current.create({
      id: `${activeTool}-${Date.now()}`,
      kind: activeTool,
      start: point,
      text: activeTool === 'text' ? '文字备注' : undefined,
    })
    setAnnotations(next)
  }

  const handleChartPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (activeTool !== 'trend-line' && activeTool !== 'rectangle') return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setDragStart(chartPoint(event))
  }

  const handleChartPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!dragStart || (activeTool !== 'trend-line' && activeTool !== 'rectangle')) return
    const end = chartPoint(event)
    const next = store.current.create({ id: `${activeTool}-${Date.now()}`, kind: activeTool, start: dragStart, end })
    setAnnotations(next)
    setDragStart(null)
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  const resetView = () => {
    setZoom(100)
    setCrosshair(false)
  }

  const chartLeft = 58
  const chartTop = 22
  const chartWidth = 850
  const chartHeight = 300
  const volumeTop = 345
  const volumeHeight = 55
  const currentPrice = snapshot?.quote.price ?? lastClose
  const values = [
    ...candles.flatMap((candle) => [candle.high, candle.low]),
    ...(indicators.ma5 ? movingAverages.ma5 : []),
    ...(indicators.ma10 ? movingAverages.ma10 : []),
    ...(indicators.ma20 ? movingAverages.ma20 : []),
    ...(indicators.boll ? [...boll.upper, ...boll.lower] : []),
    currentPrice,
  ]
  const maxPrice = Math.max(...values, lastClose) + 0.25
  const minPrice = Math.min(...values, lastClose) - 0.25
  const xForIndex = (index: number) => chartLeft + ((index + 0.5) / Math.max(candles.length, 1)) * chartWidth
  const yForValue = (value: number) => chartTop + ((maxPrice - value) / (maxPrice - minPrice)) * chartHeight

  const workspaceSnapshot: ChartWorkspaceSnapshot = {
    version: 1,
    stockCode: snapshot?.quote.security.code ?? '',
    period: activePeriod,
    drawings: annotations,
    indicators,
    indicatorConfig: {},
    layers,
    view: { zoom, panX: 0, panY: 0 },
    crosshair,
    updatedAt: new Date().toISOString(),
    revision: 1,
  }

  useEffect(() => {
    if (!snapshot) return
    const saved = loadChartWorkspace(snapshot.quote.security.code, activePeriod)
    if (!saved) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnnotations(saved.drawings as ChartAnnotation[])
    store.current.replace(saved.drawings as ChartAnnotation[])
    setIndicators(saved.indicators as Record<IndicatorKey, boolean>)
    setLayers(saved.layers as ChartLayerState)
    setZoom(saved.view.zoom)
    setCrosshair(saved.crosshair)
  }, [activePeriod, snapshot])

  useEffect(() => {
    if (!snapshot) return
    const previous = loadChartWorkspace(workspaceSnapshot.stockCode, workspaceSnapshot.period)
    const outgoing = { ...workspaceSnapshot, revision: Math.max(previous?.revision ?? 0, Date.now()) }
    saveChartWorkspace(outgoing)
    const authorization = getAuthorizationHeader()
    if (!authorization) return
    const timer = window.setTimeout(() => {
      setSyncStatus('同步中')
      void pushChartWorkspace(outgoing, getClientId(), authorization).then(() => setSyncStatus('已同步')).catch(() => setSyncStatus('待同步'))
    }, 350)
    return () => window.clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePeriod, annotations, crosshair, indicators, layers, snapshot, zoom])

  useEffect(() => {
    if (!snapshot || !getAuthorizationHeader()) return
    let cancelled = false
    void pullChartWorkspace(loadChartSyncCursor(), getClientId(), getAuthorizationHeader()).then((result) => {
      if (cancelled) return
      saveChartSyncCursor(result.nextCursor)
      const remote = result.snapshots.find((item) => item.stockCode === snapshot.quote.security.code && item.period === activePeriod)
      if (!remote) return
      const merged = mergeChartWorkspace(workspaceSnapshot, remote)
      saveChartWorkspace(merged)
      setAnnotations(merged.drawings as ChartAnnotation[])
      store.current.replace(merged.drawings as ChartAnnotation[])
      setIndicators(merged.indicators as Record<IndicatorKey, boolean>)
      setLayers(merged.layers as ChartLayerState)
      setZoom(merged.view.zoom)
      setCrosshair(merged.crosshair)
    }).catch(() => undefined)
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePeriod, snapshot?.quote.security.code])
  if (!snapshot || !sourceCandles.length) {
    return <section className="sc-live-empty" aria-live="polite"><p className="sc-eyebrow">K 线 · 真实行情</p><h1>真实行情暂不可用</h1><p>没有收到可绘制的 K 线数据，请检查阿里云行情服务。</p></section>
  }

  return (
    <section className="sc-kline-workspace">
      <header className="sc-kline-header">
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
      </header>

      <div className="sc-kline-controls">
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
          <button className="sc-kline-control-button" onClick={() => setAnnotations(store.current.undo())} type="button">撤销</button>
          <button className="sc-kline-control-button" onClick={() => setAnnotations(store.current.redo())} type="button">重做</button>
        </div>
      </div>

      <div className="sc-kline-main-grid">
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
                <svg aria-label="K线主图" className="sc-kline-svg" onClick={createPointAnnotation} onPointerDown={handleChartPointerDown} onPointerUp={handleChartPointerUp} role="img" viewBox="0 0 960 430">
                  <rect fill="#fbfcff" height="430" width="960" x="0" y="0" />
                  <g className="sc-kline-grid">
                    {[0, 1, 2, 3, 4].map((line) => <line key={`h-${line}`} x1={chartLeft} x2={chartLeft + chartWidth} y1={chartTop + line * (chartHeight / 4)} y2={chartTop + line * (chartHeight / 4)} />)}
                    {[0, 1, 2, 3, 4, 5].map((line) => <line key={`v-${line}`} x1={chartLeft + line * (chartWidth / 5)} x2={chartLeft + line * (chartWidth / 5)} y1={chartTop} y2={volumeTop + volumeHeight} />)}
                  </g>
                  <g className="sc-kline-axis-labels">
                    {[0, 1, 2, 3, 4].map((line) => <text key={line} x="920" y={chartTop + line * (chartHeight / 4) + 4}>{priceText(maxPrice - line * ((maxPrice - minPrice) / 4))}</text>)}
                  </g>
                  <g data-testid="candlestick-layer">
                    {candles.map((candle, index) => {
                      const x = xForIndex(index)
                      const openY = yForValue(candle.open)
                      const closeY = yForValue(candle.close)
                      const rising = candle.close >= candle.open
                      return <g key={`${candle.day}-${index}`}><line className={rising ? 'sc-rise-stroke' : 'sc-fall-stroke'} x1={x} x2={x} y1={yForValue(candle.high)} y2={yForValue(candle.low)} /><rect className={rising ? 'sc-rise-fill' : 'sc-fall-fill'} height={Math.max(3, Math.abs(closeY - openY))} width={Math.max(5, Math.min(14, chartWidth / candles.length * 0.56))} x={x - 5} y={Math.min(openY, closeY)} /></g>
                    })}
                  </g>
                  {indicators.ma5 && <path d={linePath(movingAverages.ma5, xForIndex, yForValue)} fill="none" stroke={indicatorColors.ma5} strokeWidth="2" />}
                  {indicators.ma10 && <path d={linePath(movingAverages.ma10, xForIndex, yForValue)} fill="none" stroke={indicatorColors.ma10} strokeWidth="2" />}
                  {indicators.ma20 && <path d={linePath(movingAverages.ma20, xForIndex, yForValue)} fill="none" stroke={indicatorColors.ma20} strokeWidth="2" />}
                  {indicators.boll && <><path d={linePath(boll.upper, xForIndex, yForValue)} fill="none" stroke={indicatorColors.boll} strokeDasharray="5 4" strokeWidth="1.5" /><path d={linePath(boll.middle, xForIndex, yForValue)} fill="none" stroke="#9aa5c4" strokeWidth="1.5" /><path d={linePath(boll.lower, xForIndex, yForValue)} fill="none" stroke={indicatorColors.boll} strokeDasharray="5 4" strokeWidth="1.5" /></>}
                  {layers.keyLevels && <g data-testid="key-level-layer">{keyLevels.map((price, index) => <g key={price}><line className="sc-key-level-line" x1={chartLeft} x2={chartLeft + chartWidth} y1={yForValue(price)} y2={yForValue(price)} /><text className="sc-key-level-label" x={chartLeft + chartWidth - 78} y={yForValue(price) - 5}>{index === 0 ? '近20日高点' : '近20日低点'} {priceText(price)}</text></g>)}</g>}
                  <g className="sc-volume-bars">{candles.map((candle, index) => <rect key={index} height={Math.max(3, (candle.volume / Math.max(...candles.map((item) => item.volume))) * volumeHeight)} width={Math.max(5, Math.min(14, chartWidth / candles.length * 0.56))} x={xForIndex(index) - 5} y={volumeTop + volumeHeight - Math.max(3, (candle.volume / Math.max(...candles.map((item) => item.volume))) * volumeHeight)} />)}</g>
                  <text className="sc-volume-label" x={chartLeft} y={volumeTop + volumeHeight + 23}>成交量</text>
                  {crosshair && <g data-testid="crosshair-layer"><line className="sc-crosshair" x1={xForIndex(Math.max(0, candles.length - 4))} x2={xForIndex(Math.max(0, candles.length - 4))} y1={chartTop} y2={volumeTop + volumeHeight} /><line className="sc-crosshair" x1={chartLeft} x2={chartLeft + chartWidth} y1={yForValue(lastClose)} y2={yForValue(lastClose)} /></g>}
                </svg>
                {layers.annotations && annotations.map((annotation) => <div className="sc-kline-annotation" data-testid={`annotation-${annotation.kind}`} key={annotation.id} style={{ left: annotation.start.x, top: annotation.start.y, width: (annotation.end?.x ?? annotation.start.x) - annotation.start.x, height: (annotation.end?.y ?? annotation.start.y) - annotation.start.y }} />)}
              </div>
            </div>
            <div className="sc-kline-statusbar"><span>共 {candles.length} 根 K 线</span><span>当前周期：{periods.find(([period]) => period === activePeriod)?.[1]}</span><span>数据源：{snapshot.source.name}</span><span>{getAuthorizationHeader() ? syncStatus : '本机保存 · 登录后跨设备同步'}</span></div>
          </div>
          {(activeTool === 'rectangle' || activeTool === 'trend-line') && <button className="sc-kline-add-annotation" onClick={addRectangle} type="button">添加矩形标注</button>}

        </div>
        <aside className="sc-kline-side-column"><ChartLayerPanel layers={layers} onChange={(key, value) => setLayers((old) => ({ ...old, [key]: value }))} /><section className="sc-kline-side-card"><p className="sc-eyebrow">当前观察</p><h2>{snapshot.quote.security.name}</h2><dl><div><dt>现价</dt><dd>{priceText(currentPrice)}</dd></div><div><dt>数据源</dt><dd>{snapshot.source.name}</dd></div><div><dt>更新时间</dt><dd>{new Date(snapshot.source.fetchedAt).toLocaleString('zh-CN')}</dd></div></dl><p>先用周期和图层筛选结构，再用绘图工具记录买入、止盈和失效条件。</p></section></aside>
      </div>
    </section>
  )
}
