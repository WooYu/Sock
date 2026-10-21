'use client'

import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import type { Candle } from '../workspace/stock-workspace-types'
import type { ChartTransform } from './chart-coordinates'
import type { ChartTool } from './chart-annotation-store'
import type { DrawingKind, DrawingObject, PredictionSnapshot, TimePricePoint } from './chart-types'
import { MA_COLORS, MA_PERIODS, formatChartTime, isIntradayPeriod, type ChartPeriod, type IndicatorKey, type IndicatorValue, type IndicatorValues, type MaKey } from './chart-periods'
import type { DrawingMove } from './drawing-engine'
import { DrawingLayer } from './drawing-layer'
import { PredictionLayer } from './prediction-layer'
import { IndicatorProjectionLayer } from './indicator-projection-layer'
import type { IndicatorProjection } from './indicator-projection'

type ChartCanvasProps = {
  candles: Candle[]
  kind?: 'candles' | 'intraday'
  limitRatio?: number
  previousClose?: number
  /** Close immediately before the visible candle window, in the same adjustment basis. */
  precedingClose?: number
  prediction: PredictionSnapshot | null
  transform: ChartTransform
  indicators: Partial<Record<IndicatorKey, boolean>>
  indicatorValues: IndicatorValues
  keyLevels: number[]
  showKeyLevels: boolean
  drawings: DrawingObject[]
  showDrawings: boolean
  selectedId: string | null
  hoveredDay: string | null
  selectedPredictionDay?: string | null
  crosshair: boolean
  activeTool: ChartTool
  symbol: string
  period: ChartPeriod
  onHoverDay: (day: string | null) => void
  onSelectPredictionDay?: (day: string) => void
  onSelectDrawing: (id: string | null) => void
  onCreateDrawing: (drawing: DrawingObject) => void
  onMoveDrawing: (drawingId: string, delta: DrawingMove) => void
  onMovePoint: (drawingId: string, pointIndex: number, point: TimePricePoint) => void
  onDeleteSelected?: () => void
  onUndo?: () => void
  onRedo?: () => void
  onPan?: (deltaX: number) => void
  onPanEnd?: () => void
  panOnPointer?: boolean
  onViewportZoom?: (factor: number, anchor?: number) => void
  onViewportPan?: (bars: number) => void
  onViewportReset?: () => void
  projectedTimes?: string[]
  projectedEstimated?: boolean
  selectedProjectionTime?: string | null
  onSelectProjectionTime?: (time: string | null) => void
  projectedRanges?: IndicatorProjection['ranges'][]
}

type PointerGesture = {
  kind: 'create' | 'move-drawing' | 'move-point' | 'pan'
  pointerId: number
  captureTarget: SVGElement
  start: TimePricePoint
  lastClientX?: number
  moved?: boolean
  drawingId?: string
  pointIndex?: number
  drawingKind?: 'trend-line' | 'rectangle'
}

const maKeys: readonly MaKey[] = MA_PERIODS.map((period) => `ma${period}` as MaKey)
const viewBox = { width: 960, height: 430 }
const volumeTop = 345
const volumeHeight = 55

function screenPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
  const screenMatrix = svg.getScreenCTM?.()
  if (screenMatrix) {
    try {
      const inverse = screenMatrix.inverse()
      return {
        x: inverse.a * clientX + inverse.c * clientY + inverse.e,
        y: inverse.b * clientX + inverse.d * clientY + inverse.f,
      }
    } catch {
      // A detached or zero-sized SVG can expose a non-invertible CTM. Fall
      // back to the default xMidYMid/meet viewBox mapping in that case.
    }
  }

  const bounds = svg.getBoundingClientRect()
  const width = bounds.width || viewBox.width
  const height = bounds.height || viewBox.height
  if (svg.getAttribute('preserveAspectRatio') === 'none') return { x: (clientX - bounds.left) / width * viewBox.width, y: (clientY - bounds.top) / height * viewBox.height }
  const scale = Math.min(width / viewBox.width, height / viewBox.height)
  const left = bounds.left + (width - viewBox.width * scale) / 2
  const top = bounds.top + (height - viewBox.height * scale) / 2
  return {
    x: Math.max(0, Math.min(viewBox.width, (clientX - left) / scale)),
    y: Math.max(0, Math.min(viewBox.height, (clientY - top) / scale)),
  }
}

function samePoint(left: TimePricePoint, right: TimePricePoint) {
  return left.time === right.time && left.price === right.price
}

function priceText(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : '--'
}

function optionalPriceText(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? priceText(value) : '--'
}

function linePath(values: readonly (IndicatorValue | undefined)[], times: readonly string[], transform: ChartTransform) {
  const commands: string[] = []
  let connected = false
  values.forEach((value, index) => {
    const time = times[index]
    if (typeof value !== 'number' || !Number.isFinite(value) || !time) { connected = false; return }
    const x = transform.xForTime(time), y = transform.yForPrice(value)
    if (!Number.isFinite(x) || !Number.isFinite(y)) { connected = false; return }
    commands.push(`${connected ? 'L' : 'M'} ${x.toFixed(2)} ${y.toFixed(2)}`)
    connected = true
  })
  return commands.join(' ')
}

function axisTime(time: string, period: ChartPeriod) {
  const formatted = formatChartTime(time, period)
  if (period === 'intraday') return formatted.slice(11, 16)
  if (isIntradayPeriod(period)) return formatted.slice(5, 16)
  if (period === 'day' || period === 'week') return formatted.slice(5)
  return formatted
}

function IntradayPrices({ candles, transform, previousClose }: Pick<ChartCanvasProps, 'candles' | 'transform' | 'previousClose'>) {
  const times = candles.map((candle) => candle.day)
  const prices = linePath(candles.map((candle) => candle.close), times, transform)
  const average = linePath(candles.map((candle) => candle.averagePrice), times, transform)
  return <g data-testid="intraday-price-layer">
    {typeof previousClose === 'number' && Number.isFinite(previousClose) && previousClose > 0 ? <g><line data-testid="previous-close-line" x1={transform.rect.left} x2={transform.rect.left + transform.rect.width} y1={transform.yForPrice(previousClose)} y2={transform.yForPrice(previousClose)} stroke="#9ba5b6" strokeDasharray="4 5" /><text fill="#929bad" fontSize="10" x={transform.rect.left + 6} y={transform.yForPrice(previousClose) - 5}>昨收 {priceText(previousClose)}</text></g> : null}
    {prices ? <path data-testid="intraday-price-line" d={prices} fill="none" stroke="#5869d5" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" /> : null}
    {average ? <path data-testid="intraday-average-line" d={average} fill="none" stroke="#c79b28" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" /> : null}
  </g>
}

function HistoricalLayer({ candles, transform, keyLevels, showKeyLevels, kind = 'candles', previousClose, period }: Pick<ChartCanvasProps, 'candles' | 'transform' | 'keyLevels' | 'showKeyLevels' | 'kind' | 'previousClose' | 'period'>) {
  const maxVolume = Math.max(...candles.map((candle) => Number.isFinite(candle.volume) ? candle.volume : 0), 1)
  const candleWidth = Math.max(1, Math.min(14, transform.widthForTime(candles[0]?.day ?? '') * 0.56))
  return (
    <g data-chart-layer="historical">
      <rect fill="#ffffff" height={viewBox.height} width={viewBox.width} x="0" y="0" />
      <g className="sc-kline-grid">
        {[0, 1, 2, 3, 4].map((line) => <line key={`h-${line}`} x1={transform.rect.left} x2={transform.rect.left + transform.rect.width} y1={transform.rect.top + line * (transform.rect.height / 4)} y2={transform.rect.top + line * (transform.rect.height / 4)} />)}
        {[0, 1, 2, 3, 4, 5].map((line) => <line key={`v-${line}`} x1={transform.rect.left + line * (transform.rect.width / 5)} x2={transform.rect.left + line * (transform.rect.width / 5)} y1={transform.rect.top} y2={volumeTop + volumeHeight} />)}
      </g>
      <g className="sc-kline-axis-labels">
        {[0, 1, 2, 3, 4].map((line) => {
          const y = transform.rect.top + line * (transform.rect.height / 4)
          return <text key={line} x={viewBox.width - 10} textAnchor="end" y={y + 4}>{priceText(transform.priceForY(y))}</text>
        })}
      </g>
      {kind === 'intraday' ? <IntradayPrices candles={candles} transform={transform} previousClose={previousClose} /> : <g data-testid="candlestick-layer">
        {candles.map((candle) => {
          const x = transform.xForTime(candle.day)
          const openY = transform.yForPrice(candle.open)
          const closeY = transform.yForPrice(candle.close)
          const rising = candle.close >= candle.open
          return <g key={candle.day}><line className={rising ? 'sc-rise-stroke' : 'sc-fall-stroke'} x1={x} x2={x} y1={transform.yForPrice(candle.high)} y2={transform.yForPrice(candle.low)} /><rect className={rising ? 'sc-rise-fill' : 'sc-fall-fill'} height={Math.max(3, Math.abs(closeY - openY))} width={candleWidth} x={x - candleWidth / 2} y={Math.min(openY, closeY)} /></g>
        })}
      </g>}
      {showKeyLevels && kind === 'candles' ? <g data-testid="key-level-layer">{keyLevels.filter(Number.isFinite).map((price, index) => <g key={price}><line className="sc-key-level-line" x1={transform.rect.left} x2={transform.rect.left + transform.rect.width} y1={transform.yForPrice(price)} y2={transform.yForPrice(price)} /><text className="sc-key-level-label" x={transform.rect.left + transform.rect.width - 78} y={transform.yForPrice(price) - 5}>{index === 0 ? '近20根高点' : '近20根低点'} {priceText(price)}</text></g>)}</g> : null}
      <g className="sc-volume-bars">{candles.map((candle) => {
        if (!Number.isFinite(candle.volume) || candle.volume <= 0) return null
        const height = Number(((candle.volume / maxVolume) * volumeHeight).toFixed(4))
        return <rect height={height} key={candle.day} width={candleWidth} x={transform.xForTime(candle.day) - candleWidth / 2} y={volumeTop + volumeHeight - height} />
      })}</g>
      <text className="sc-volume-label" x={transform.rect.left} y={volumeTop - 7}>成交量</text>
      <g className="sc-kline-axis-labels" aria-label={isIntradayPeriod(period) ? '交易时间' : '交易日期'}>{candles.filter((_, index) => index % Math.max(1, Math.ceil(candles.length / 5)) === 0).map((candle) => <text key={candle.day} x={transform.xForTime(candle.day)} y={volumeTop + volumeHeight + 22} textAnchor="middle" fontSize="11">{axisTime(candle.day, period)}</text>)}</g>
    </g>
  )
}

function IndicatorLine({ values, color, width, dashed, solidForecast, transform, historicalCount }: { values: IndicatorValue[]; color: string; width: number; dashed?: boolean; solidForecast?: boolean; transform: ChartTransform; historicalCount: number }) {
  if (!values.length) return null
  const historicalPath = linePath(values.slice(0, historicalCount), transform.times, transform)
  const predictionStart = Math.max(0, historicalCount - 1)
  const predictedPath = values.length > historicalCount ? linePath(values.slice(predictionStart), transform.times.slice(predictionStart), transform) : ''
  return <>{historicalPath ? <path d={historicalPath} fill="none" stroke={color} strokeDasharray={dashed ? '5 4' : undefined} strokeWidth={width} /> : null}{predictedPath ? <path data-testid="predicted-indicator-line" d={predictedPath} fill="none" stroke={color} strokeDasharray={solidForecast ? undefined : "4 4"} opacity="0.75" strokeWidth={width} /> : null}</>
}

function IndicatorLayer({ indicators, indicatorValues, transform, candles }: Pick<ChartCanvasProps, 'indicators' | 'indicatorValues' | 'transform' | 'candles'>) {
  const shared = { transform, historicalCount: candles.length }
  return (
    <g data-chart-layer="indicator">
      {maKeys.map((key) => indicators[key] ? <g key={key} data-indicator={key}><IndicatorLine {...shared} values={indicatorValues[key] ?? []} color={MA_COLORS[key]} width={1.4} /></g> : null)}
      {indicators.boll ? <><g data-testid="boll-channel" pointerEvents="none">{indicatorValues.boll.upper.map((upper, i) => {
        const lower = indicatorValues.boll.lower[i], nextUpper = indicatorValues.boll.upper[i + 1], nextLower = indicatorValues.boll.lower[i + 1]
        if (![upper, lower, nextUpper, nextLower].every(v => v != null && Number.isFinite(v)) || !transform.times[i + 1]) return null
        return <path key={i} d={`M ${transform.xForTime(transform.times[i])} ${transform.yForPrice(upper!)} L ${transform.xForTime(transform.times[i + 1])} ${transform.yForPrice(nextUpper!)} L ${transform.xForTime(transform.times[i + 1])} ${transform.yForPrice(nextLower!)} L ${transform.xForTime(transform.times[i])} ${transform.yForPrice(lower!)} Z`} fill="#8490d8" opacity={i >= candles.length - 1 ? '.10' : '.04'} />
      })}</g><IndicatorLine {...shared} values={indicatorValues.boll.upper} color="#6f7fd8" width={1} solidForecast />{!indicators.ma20 ? <IndicatorLine {...shared} values={indicatorValues.boll.middle} color="#94a3b8" width={0.8} solidForecast /> : null}<IndicatorLine {...shared} values={indicatorValues.boll.lower} color="#6f7fd8" width={1} solidForecast /></> : null}
    </g>
  )
}

function CrosshairTooltip({ candle, price, index, kind, period, transform, indicators, indicatorValues, referenceClose, cursorX }: Pick<ChartCanvasProps, 'kind' | 'period' | 'transform' | 'indicators' | 'indicatorValues'> & { candle: Candle | PredictionSnapshot['days'][number]; price: number; index: number; referenceClose?: number; cursorX: number }) {
  const cells: Array<{ label: string; value: string; color?: string }> = kind === 'intraday'
    ? [{ label: '价格', value: priceText(candle.close) }, { label: '均价', value: optionalPriceText('averagePrice' in candle ? candle.averagePrice : undefined), color: '#eed083' }]
    : [{ label: '开', value: priceText(candle.open) }, { label: '高', value: priceText(candle.high) }, { label: '低', value: priceText(candle.low) }, { label: '收', value: priceText(candle.close) }]
  if (kind !== 'intraday') {
    const reference = typeof referenceClose === 'number' && Number.isFinite(referenceClose) && referenceClose > 0 ? referenceClose : null
    const change = reference === null ? null : candle.close - reference
    const range = candle.high - candle.low
    const signed = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}`
    cells.push({ label: period === 'day' ? '当日涨跌' : '本根涨跌', value: change === null ? '-- / --' : `${signed(change)} / ${signed(change / reference! * 100)}%`, color: change === null || change === 0 ? undefined : change > 0 ? '#ff9eaa' : '#7fe0bd' })
    cells.push({ label: '振幅', value: `${priceText(range)} / ${reference === null ? '--' : `${(range / reference * 100).toFixed(2)}%`}` })
    cells.push({ label: '前收', value: optionalPriceText(reference) })
    if ('volume' in candle && Number.isFinite(candle.volume)) cells.push({ label: '成交量', value: candle.volume.toLocaleString('zh-CN') })
  }
  cells.push({ label: '光标', value: priceText(price) })
  if (kind === 'intraday') {
    if ('volume' in candle && Number.isFinite(candle.volume)) cells.push({ label: '成交量', value: candle.volume.toLocaleString('zh-CN') })
  }
  {
    for (const key of maKeys) if (indicators[key]) cells.push({ label: key.toUpperCase(), value: optionalPriceText(indicatorValues[key]?.[index]), color: MA_COLORS[key] })
    if (indicators.boll) {
      cells.push({ label: 'BOLL上', value: optionalPriceText(indicatorValues.boll.upper[index]), color: '#6f7fd8' })
      cells.push({ label: 'BOLL中', value: optionalPriceText(indicatorValues.boll.middle[index]), color: indicators.ma20 ? MA_COLORS.ma20 : '#94a3b8' })
      cells.push({ label: 'BOLL下', value: optionalPriceText(indicatorValues.boll.lower[index]), color: '#6f7fd8' })
    }
  }
  const longest = Math.max(...cells.map((cell) => `${cell.label} ${cell.value}`.length), 1)
  const width = Math.min(transform.rect.width - 12, Math.max(256, Math.min(410, longest * 12 + 42)))
  const columns = width < 240 || longest * 6 + 20 > width / 2 ? 1 : 2
  const rowHeight = 17
  const height = 37 + Math.ceil(cells.length / columns) * rowHeight
  const x = cursorX < transform.rect.left + transform.rect.width / 2 ? transform.rect.left + transform.rect.width - width - 6 : transform.rect.left + 6, y = transform.rect.top + 8
  return <g data-testid="crosshair-tooltip" pointerEvents="none">
    <rect fill="#17213c" height={height} opacity="0.94" rx="5" width={width} x={x} y={y} />
    <text fill="#fff" fontSize="11" x={x + 10} y={y + 18}>{formatChartTime(candle.day, period)}{'volume' in candle ? '' : ' · 预测'}</text>
    {cells.map((cell, cellIndex) => <text key={cell.label} fill={cell.color ?? '#edf0ff'} fontSize="10" x={x + 10 + cellIndex % columns * (width - 20) / columns} y={y + 35 + Math.floor(cellIndex / columns) * rowHeight}>{cell.label} {cell.value}</text>)}
  </g>
}

export function ChartCanvas(props: ChartCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const gesture = useRef<PointerGesture | null>(null)
  const consumeGestureClick = useRef(false)
  const [crosshairPoint, setCrosshairPoint] = useState<{ x: number; y: number } | null>(null)
  const kind = props.kind ?? 'candles'
  const touchPoints = useRef(new Map<number, { x: number; y: number }>())
  const pinchDistance = useRef(0)
  const prediction = kind === 'candles' && props.period === 'day' ? props.prediction : null

  const svgPoint = (event: ReactMouseEvent<SVGSVGElement> | ReactPointerEvent<SVGSVGElement>) => {
    return screenPoint(event.currentTarget, event.clientX, event.clientY)
  }
  const dataPointAt = (svg: SVGSVGElement, clientX: number, clientY: number): TimePricePoint => {
    const point = screenPoint(svg, clientX, clientY)
    return { time: props.transform.timeForX(point.x), price: props.transform.priceForY(point.y) }
  }
  const dataPoint = (event: ReactMouseEvent<SVGSVGElement> | ReactPointerEvent<SVGSVGElement>) => dataPointAt(event.currentTarget, event.clientX, event.clientY)
  const drawing = (kind: DrawingKind, points: TimePricePoint[]): DrawingObject => ({
    id: `${kind}-${crypto.randomUUID()}`,
    symbol: props.symbol,
    period: props.period,
    kind,
    points,
    style: { color: '#ef4444', width: 2, lineStyle: 'solid', opacity: 1 },
    text: kind === 'text' ? '文字备注' : undefined,
    locked: false,
    visible: true,
    version: 0,
    updatedAt: new Date().toISOString(),
  })
  const createPointDrawing = (event: ReactMouseEvent<SVGSVGElement>) => {
    if (consumeGestureClick.current) { consumeGestureClick.current = false; return }
    if (props.activeTool === 'pointer' || props.activeTool === 'pan' || props.activeTool === 'trend-line' || props.activeTool === 'rectangle') {
      if (props.activeTool === 'pointer') { props.onSelectDrawing(null); setCrosshairPoint(svgPoint(event)) }
      return
    }
    if (!dataPoint(event).time.startsWith('forecast:')) props.onCreateDrawing(drawing(props.activeTool, [dataPoint(event)]))
  }
  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    consumeGestureClick.current = false
    if (props.activeTool === 'pointer' && (event.target as Element).closest('[data-testid="prediction-candle"]')) return
    event.currentTarget.focus({ preventScroll: true })
    if (event.pointerType === 'touch' && props.onViewportZoom) {
      touchPoints.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (touchPoints.current.size > 1) {
        const points = [...touchPoints.current.values()]
        pinchDistance.current = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y)
        gesture.current = null
        consumeGestureClick.current = true
        event.currentTarget.setPointerCapture?.(event.pointerId)
        return
      }
    }
    if (props.activeTool === 'pan' || (props.panOnPointer && props.activeTool === 'pointer')) {
      event.currentTarget.setPointerCapture?.(event.pointerId)
      gesture.current = { kind: 'pan', pointerId: event.pointerId, captureTarget: event.currentTarget, start: dataPoint(event), lastClientX: event.clientX }
      return
    }
    if (props.activeTool !== 'trend-line' && props.activeTool !== 'rectangle') return
    if (dataPoint(event).time.startsWith('forecast:')) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    gesture.current = { kind: 'create', pointerId: event.pointerId, captureTarget: event.currentTarget, start: dataPoint(event), drawingKind: props.activeTool }
  }
  const beginDrawingMove = (drawingId: string, event: ReactPointerEvent<SVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    gesture.current = { kind: 'move-drawing', pointerId: event.pointerId, captureTarget: event.currentTarget, start: dataPointAt(svg, event.clientX, event.clientY), drawingId }
  }
  const beginPointMove = (drawingId: string, pointIndex: number, event: ReactPointerEvent<SVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    gesture.current = { kind: 'move-point', pointerId: event.pointerId, captureTarget: event.currentTarget, start: dataPointAt(svg, event.clientX, event.clientY), drawingId, pointIndex }
  }
  const releaseGestureCapture = (active: PointerGesture) => {
    try {
      active.captureTarget.releasePointerCapture?.(active.pointerId)
    } catch {
      // Browsers may release capture before dispatching pointercancel.
    }
  }
  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    touchPoints.current.delete(event.pointerId)
    if (pinchDistance.current) {
      if (!touchPoints.current.size) pinchDistance.current = 0
      gesture.current = null
      consumeGestureClick.current = true
      return
    }
    const active = gesture.current
    if (!active || active.pointerId !== event.pointerId) return
    gesture.current = null
    const end = dataPoint(event)
    if (active.kind !== 'pan' && end.time.startsWith('forecast:')) { releaseGestureCapture(active); consumeGestureClick.current = true; return }
    if (active.kind === 'pan') {
      if (active.moved) consumeGestureClick.current = true
      const finalDelta = (active.lastClientX ?? event.clientX) - event.clientX
      if (finalDelta) props.onPan?.(finalDelta)
      props.onPanEnd?.()
    } else if (active.kind === 'move-point' && active.drawingId !== undefined && active.pointIndex !== undefined) {
      if (!samePoint(active.start, end)) props.onMovePoint(active.drawingId, active.pointIndex, end)
    } else if (active.kind === 'move-drawing' && active.drawingId !== undefined) {
      const delta = {
        timeIndexDelta: props.transform.domainTimes.indexOf(end.time) - props.transform.domainTimes.indexOf(active.start.time),
        timeDomain: props.transform.domainTimes,
        priceDelta: end.price - active.start.price,
      }
      if (delta.timeIndexDelta !== 0 || delta.priceDelta !== 0) props.onMoveDrawing(active.drawingId, delta)
    } else if (active.kind === 'create' && active.drawingKind) {
      if (!samePoint(active.start, end)) {
        consumeGestureClick.current = true
        props.onCreateDrawing(drawing(active.drawingKind, [active.start, end]))
      }
    }
    releaseGestureCapture(active)
  }
  const cancelPointerGesture = (event: ReactPointerEvent<SVGSVGElement>) => {
    touchPoints.current.delete(event.pointerId)
    if (!touchPoints.current.size) pinchDistance.current = 0
    const active = gesture.current
    if (!active || active.pointerId !== event.pointerId) return
    gesture.current = null
    releaseGestureCapture(active)
  }
  const clearLostPointerGesture = (event: ReactPointerEvent<SVGSVGElement>) => {
    touchPoints.current.delete(event.pointerId)
    if (!touchPoints.current.size) pinchDistance.current = 0
    const active = gesture.current
    if (active?.pointerId === event.pointerId) gesture.current = null
  }
  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.pointerType === 'touch' && touchPoints.current.has(event.pointerId)) {
      touchPoints.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (touchPoints.current.size > 1 && props.onViewportZoom) {
        const points = [...touchPoints.current.values()]
        const distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y)
        const center = screenPoint(event.currentTarget, (points[0].x + points[1].x) / 2, (points[0].y + points[1].y) / 2)
        if (distance > 0 && pinchDistance.current > 0) props.onViewportZoom(pinchDistance.current / distance, (center.x - props.transform.rect.left) / props.transform.rect.width)
        pinchDistance.current = distance
        return
      }
    }
    const active = gesture.current
    if (active?.kind === 'pan' && active.pointerId === event.pointerId) {
      const delta = (active.lastClientX ?? event.clientX) - event.clientX
      if (delta) { props.onPan?.(delta); active.moved = true }
      active.lastClientX = event.clientX
    }
    if (props.crosshair || props.activeTool === 'pointer') setCrosshairPoint(svgPoint(event))
  }
  const handleKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    const modifier = event.ctrlKey || event.metaKey
    if (!modifier && props.onViewportZoom && ['ArrowUp', 'ArrowDown', '+', '=', '-'].includes(event.key)) {
      event.preventDefault()
      props.onViewportZoom(['ArrowUp', '+', '='].includes(event.key) ? 0.8 : 1.25)
      return
    }
    if (!modifier && props.onViewportPan && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault()
      props.onViewportPan(event.key === 'ArrowLeft' ? -Math.max(1, props.candles.length / 10) : Math.max(1, props.candles.length / 10))
      return
    }
    if (!modifier && event.key === '0' && props.onViewportReset) {
      event.preventDefault(); props.onViewportReset(); return
    }
    if (modifier && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      if (event.shiftKey) props.onRedo?.()
      else props.onUndo?.()
      return
    }
    if (modifier && event.key.toLowerCase() === 'y') {
      event.preventDefault()
      props.onRedo?.()
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      const active = gesture.current
      if (active) {
        gesture.current = null
        releaseGestureCapture(active)
      }
      props.onSelectDrawing(null)
      return
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && props.selectedId) {
      event.preventDefault()
      props.onDeleteSelected?.()
    }
  }
  const crosshairTime = crosshairPoint ? props.transform.timeForX(crosshairPoint.x) : null
  const crosshairIndex = crosshairTime ? props.transform.times.indexOf(crosshairTime) : -1
  const crosshairCandle = crosshairTime ? [...props.candles, ...(prediction?.days ?? [])].find((candle) => candle.day === crosshairTime) ?? null : null
  const historicalIndex = crosshairTime ? props.candles.findIndex(candle => candle.day === crosshairTime) : -1
  const predictedIndex = crosshairTime ? prediction?.days.findIndex(candle => candle.day === crosshairTime) ?? -1 : -1
  const referenceClose = historicalIndex > 0 ? props.candles[historicalIndex - 1].close : historicalIndex === 0 ? props.precedingClose : predictedIndex > 0 ? prediction?.days[predictedIndex - 1].close : predictedIndex === 0 ? props.candles.at(-1)?.close : undefined
  const crosshairPrice = crosshairPoint ? props.transform.priceForY(crosshairPoint.y) : null

  return (
    <svg aria-keyshortcuts="Delete Escape Control+Z Meta+Z Control+Y Meta+Y" aria-label={kind === 'intraday' ? '分时主图' : 'K线主图'} className={`sc-kline-svg ${props.panOnPointer ? 'sc-kline-svg-interactive' : ''}`} onPointerLeave={() => setCrosshairPoint(null)} onDoubleClick={() => { if (props.activeTool === 'pointer' || props.activeTool === 'pan') props.onViewportReset?.() }} onClick={createPointDrawing} onKeyDown={handleKeyDown} onLostPointerCapture={clearLostPointerGesture} onPointerCancel={cancelPointerGesture} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} preserveAspectRatio={props.panOnPointer ? 'none' : 'xMidYMid meet'} ref={svgRef} role="img" tabIndex={0} viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}>
      <HistoricalLayer candles={props.candles} keyLevels={props.keyLevels} showKeyLevels={props.showKeyLevels} transform={props.transform} kind={kind} previousClose={props.previousClose} period={props.period} />
      <IndicatorLayer candles={props.candles} indicatorValues={props.indicatorValues} indicators={props.indicators} transform={props.transform} />
      <g data-chart-layer="prediction">{prediction ? <PredictionLayer hoveredDay={props.hoveredDay} onHoverDay={props.onHoverDay} onSelectDay={props.onSelectPredictionDay} prediction={prediction} selectedDay={props.selectedPredictionDay} transform={props.transform} /> : null}</g>
      {props.projectedTimes?.length ? <IndicatorProjectionLayer previousClose={props.previousClose} baseClose={props.candles.at(-1)?.close} limitRatio={props.limitRatio} selectedTime={props.selectedProjectionTime} onSelect={props.onSelectProjectionTime} times={props.projectedTimes} estimated={props.projectedEstimated} ranges={props.projectedRanges} historicalCount={props.candles.length} transform={props.transform} period={props.period} indicators={props.indicators} values={props.indicatorValues} interactive={props.activeTool === 'pointer'} /> : null}
      <g data-chart-layer="drawing">{props.showDrawings ? <DrawingLayer drawings={props.drawings} interactionsDisabled={props.activeTool === 'pan'} onFocusEditor={() => svgRef.current?.focus()} onMoveDrawing={beginDrawingMove} onMovePoint={beginPointMove} onSelect={props.onSelectDrawing} selectedId={props.selectedId} transform={props.transform} /> : null}</g>
      <g data-chart-layer="crosshair">{(props.crosshair || props.activeTool === 'pointer') && crosshairPoint && crosshairCandle && crosshairPrice !== null ? <g data-testid="crosshair-layer"><line className="sc-crosshair" x1={props.transform.xForTime(crosshairCandle.day)} x2={props.transform.xForTime(crosshairCandle.day)} y1={props.transform.rect.top} y2={volumeTop + volumeHeight} /><line className="sc-crosshair" x1={props.transform.rect.left} x2={props.transform.rect.left + props.transform.rect.width} y1={props.transform.yForPrice(crosshairPrice)} y2={props.transform.yForPrice(crosshairPrice)} /><g data-testid="crosshair-axis-labels" pointerEvents="none">
        <rect x={viewBox.width - 58} y={Math.max(0, Math.min(volumeTop + volumeHeight - 20, crosshairPoint.y - 10))} width={58} height={20} rx={3} fill="#17213c" />
        <text x={viewBox.width - 4} y={Math.max(0, Math.min(volumeTop + volumeHeight - 20, crosshairPoint.y - 10)) + 14} textAnchor="end" fill="#fff" fontSize={10}>{priceText(crosshairPrice)}</text>
        <rect x={Math.max(0, Math.min(viewBox.width - 160, props.transform.xForTime(crosshairCandle.day) - 80))} y={volumeTop + volumeHeight + 5} width={160} height={22} rx={3} fill="#17213c" />
        <text x={Math.max(0, Math.min(viewBox.width - 160, props.transform.xForTime(crosshairCandle.day) - 80)) + 80} y={volumeTop + volumeHeight + 20} textAnchor="middle" fill="#fff" fontSize={11}>{formatChartTime(crosshairCandle.day, props.period)}</text>
      </g><CrosshairTooltip referenceClose={referenceClose} cursorX={crosshairPoint.x} candle={crosshairCandle} price={crosshairPrice} index={crosshairIndex} kind={kind} period={props.period} transform={props.transform} indicators={props.indicators} indicatorValues={props.indicatorValues} /></g> : null}</g>
    </svg>
  )
}
