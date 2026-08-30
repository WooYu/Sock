'use client'

import { useMemo, useRef, useState } from 'react'
import type { Candle, MarketSnapshot } from '../workspace/stock-workspace-types'
import { ChartAnnotationStore, type ChartAnnotation, type ChartTool } from './chart-annotation-store'
import { ChartLayerPanel, type ChartLayerState } from './chart-layer-panel'
import { ChartToolbar } from './chart-toolbar'

type ChartPeriod = 'day' | 'week' | 'month'
type IndicatorKey = 'ma5' | 'ma10' | 'ma20' | 'boll'

const periods: Array<[ChartPeriod, string]> = [['day', '日线'], ['week', '周线'], ['month', '月线']]
const indicatorOptions: Array<[IndicatorKey, string]> = [['ma5', 'MA5'], ['ma10', 'MA10'], ['ma20', 'MA20'], ['boll', 'BOLL']]
const indicatorColors: Record<IndicatorKey, string> = { ma5: '#d6a12a', ma10: '#4e9bd6', ma20: '#a46ee8', boll: '#6f7fd8' }

const demoCandles: Candle[] = Array.from({ length: 42 }, (_, index) => {
  const close = 31.2 + Math.sin(index / 3.8) * 1.1 + index * 0.035
  const open = close - Math.cos(index / 2.7) * 0.28
  return {
    day: `2026-08-${String(index + 1).padStart(2, '0')}`,
    open,
    high: Math.max(open, close) + 0.22 + (index % 3) * 0.04,
    low: Math.min(open, close) - 0.18 - (index % 2) * 0.03,
    close,
    volume: 100000 + index * 4500,
  }
})

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
  const [layers, setLayers] = useState<ChartLayerState>({ keyLevels: true, predictionPaths: true, trades: true, annotations: true })
  const [annotations, setAnnotations] = useState<ChartAnnotation[]>([])
  const store = useRef(new ChartAnnotationStore())

  const sourceCandles = snapshot?.dailyCandles?.length ? snapshot.dailyCandles : demoCandles
  const candles = useMemo(() => aggregateCandles(sourceCandles, activePeriod), [activePeriod, sourceCandles])
  const movingAverages = useMemo(() => ({ ma5: movingAverage(candles, 5), ma10: movingAverage(candles, 10), ma20: movingAverage(candles, 20) }), [candles])
  const boll = useMemo(() => bollinger(candles), [candles])
  const lastClose = candles[candles.length - 1]?.close ?? snapshot?.quote.price ?? 0
  const futureValues = useMemo(() => [1, 2, 3].map((day) => ({
    day,
    ma5: lastClose + day * 0.12,
    ma10: lastClose + day * 0.06,
    ma20: lastClose + day * 0.025,
    upper: lastClose + 0.72 + day * 0.09,
    middle: lastClose + day * 0.025,
    lower: lastClose - 0.67 + day * 0.01,
  })), [lastClose])

  const addRectangle = () => {
    const next = store.current.create({ id: `rectangle-${Date.now()}`, kind: 'rectangle', start: { x: 20, y: 20 }, end: { x: 130, y: 90 } })
    setAnnotations(next)
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
  const keyLevels = [currentPrice + 0.72, currentPrice - 0.64]

  return (
    <section className="sc-kline-workspace">
      <header className="sc-kline-header">
        <div>
          <p className="sc-eyebrow">价格结构 · 多周期观察</p>
          <div className="sc-kline-title-row">
            <h1>专业 K 线</h1>
            <span>{snapshot?.quote.security.name ?? '华芯动力'}</span>
            <code>{snapshot?.quote.security.code ?? 'DEMO·001'}</code>
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
              <span className="sc-kline-data-badge">{snapshot?.source.online ? '实时接口' : '演示数据'}</span>
            </div>
            <div className="sc-kline-chart-scroll">
              <div className="sc-kline-chart-surface" data-zoom={zoom} style={{ width: `${zoom}%` }}>
                <svg aria-label="K线主图" className="sc-kline-svg" role="img" viewBox="0 0 960 430">
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
                  {layers.keyLevels && keyLevels.map((price, index) => <g key={price}><line className="sc-key-level-line" x1={chartLeft} x2={chartLeft + chartWidth} y1={yForValue(price)} y2={yForValue(price)} /><text className="sc-key-level-label" x={chartLeft + chartWidth - 78} y={yForValue(price) - 5}>{index === 0 ? '目标位' : '支撑位'} {priceText(price)}</text></g>)}
                  {layers.predictionPaths && <path className="sc-prediction-path" d={`M ${xForIndex(candles.length - 1)} ${yForValue(lastClose)} L ${xForIndex(candles.length - 1) + 76} ${yForValue(futureValues[0].ma5)} L ${xForIndex(candles.length - 1) + 152} ${yForValue(futureValues[1].ma5)} L ${xForIndex(candles.length - 1) + 228} ${yForValue(futureValues[2].ma5)}`} fill="none" />}
                  {layers.trades && <g data-testid="trade-layer"><circle className="sc-trade-buy" cx={xForIndex(Math.max(0, candles.length - 8))} cy={yForValue(candles[Math.max(0, candles.length - 8)]?.low ?? lastClose) + 14} r="5" /><text className="sc-trade-label" x={xForIndex(Math.max(0, candles.length - 8)) - 14} y={yForValue(candles[Math.max(0, candles.length - 8)]?.low ?? lastClose) + 32}>买入</text></g>}
                  <g className="sc-volume-bars">{candles.map((candle, index) => <rect key={index} height={Math.max(3, (candle.volume / Math.max(...candles.map((item) => item.volume))) * volumeHeight)} width={Math.max(5, Math.min(14, chartWidth / candles.length * 0.56))} x={xForIndex(index) - 5} y={volumeTop + volumeHeight - Math.max(3, (candle.volume / Math.max(...candles.map((item) => item.volume))) * volumeHeight)} />)}</g>
                  <text className="sc-volume-label" x={chartLeft} y={volumeTop + volumeHeight + 23}>成交量</text>
                  {crosshair && <g data-testid="crosshair-layer"><line className="sc-crosshair" x1={xForIndex(Math.max(0, candles.length - 4))} x2={xForIndex(Math.max(0, candles.length - 4))} y1={chartTop} y2={volumeTop + volumeHeight} /><line className="sc-crosshair" x1={chartLeft} x2={chartLeft + chartWidth} y1={yForValue(lastClose)} y2={yForValue(lastClose)} /></g>}
                </svg>
                {layers.annotations && annotations.map((annotation) => <div className="sc-kline-annotation" data-testid={`annotation-${annotation.kind}`} key={annotation.id} style={{ left: annotation.start.x, top: annotation.start.y, width: (annotation.end?.x ?? annotation.start.x) - annotation.start.x, height: (annotation.end?.y ?? annotation.start.y) - annotation.start.y }} />)}
              </div>
            </div>
            <div className="sc-kline-statusbar"><span>共 {candles.length} 根 K 线</span><span>当前周期：{periods.find(([period]) => period === activePeriod)?.[1]}</span><span>数据源：{snapshot?.source.name ?? '本地演示'}</span></div>
          </div>
          {activeTool === 'rectangle' && <button className="sc-kline-add-annotation" onClick={addRectangle} type="button">添加矩形示例</button>}

          <section className="sc-future-panel">
            <div className="sc-kline-section-heading"><div><p className="sc-eyebrow">指标推演 · 可追溯</p><h2>日线与未来指标延伸</h2></div><span>未来 3 个交易日</span></div>
            <div className="sc-future-grid">
              {futureValues.map((value) => <article className="sc-future-card" key={value.day}><div className="sc-future-card-head"><strong>D+{value.day}</strong><span>{value.day === 1 ? '最近' : '候选值'}</span></div><div className="sc-future-value-row"><span>MA5</span><b>{priceText(value.ma5)}</b></div><div className="sc-future-value-row"><span>MA10</span><b>{priceText(value.ma10)}</b></div><div className="sc-future-value-row"><span>MA20</span><b>{priceText(value.ma20)}</b></div><div className="sc-future-value-row"><span>BOLL上轨</span><b>{priceText(value.upper)}</b></div><div className="sc-future-value-row"><span>BOLL中轨</span><b>{priceText(value.middle)}</b></div><div className="sc-future-value-row is-muted"><span>BOLL下轨</span><b>{priceText(value.lower)}</b></div></article>)}
            </div>
            <p className="sc-future-footnote">未来值根据当前周期的 MA / BOLL 结构和近期价格路径推演，仅作为图表参考，不代表实际最高价或收盘价。</p>
          </section>
        </div>
        <aside className="sc-kline-side-column"><ChartLayerPanel layers={layers} onChange={(key, value) => setLayers((old) => ({ ...old, [key]: value }))} /><section className="sc-kline-side-card"><p className="sc-eyebrow">当前观察</p><h2>{snapshot?.quote.security.name ?? '华芯动力'}</h2><dl><div><dt>现价</dt><dd>{priceText(currentPrice)}</dd></div><div><dt>近端目标</dt><dd>{priceText(keyLevels[0])}</dd></div><div><dt>防守位置</dt><dd>{priceText(keyLevels[1])}</dd></div></dl><p>先用周期和图层筛选结构，再用绘图工具记录买入、止盈和失效条件。</p></section></aside>
      </div>
    </section>
  )
}
