'use client'

import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import type { Candle } from '../workspace/stock-workspace-types'
import type { ChartTransform } from './chart-coordinates'
import type { ChartTool } from './chart-annotation-store'
import type { ChartPeriod, DrawingKind, DrawingObject, PredictionSnapshot, TimePricePoint } from './chart-types'
import type { DrawingMove } from './drawing-engine'
import { DrawingLayer } from './drawing-layer'
import { PredictionLayer } from './prediction-layer'

type IndicatorKey = 'ma5' | 'ma10' | 'ma20' | 'boll'

type IndicatorValues = {
  ma5: number[]
  ma10: number[]
  ma20: number[]
  boll: { upper: number[]; middle: number[]; lower: number[] }
}

type ChartCanvasProps = {
  candles: Candle[]
  prediction: PredictionSnapshot | null
  transform: ChartTransform
  indicators: Record<IndicatorKey, boolean>
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
}

type PointerGesture = {
  kind: 'create' | 'move-drawing' | 'move-point'
  pointerId: number
  captureTarget: SVGElement
  start: TimePricePoint
  drawingId?: string
  pointIndex?: number
  drawingKind?: 'trend-line' | 'rectangle'
}

const indicatorColors: Record<IndicatorKey, string> = { ma5: '#d6a12a', ma10: '#4e9bd6', ma20: '#a46ee8', boll: '#6f7fd8' }
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
  return value.toFixed(2)
}

function linePath(values: number[], times: readonly string[], transform: ChartTransform) {
  return values.map((value, index) => `${index === 0 ? 'M' : 'L'} ${transform.xForTime(times[index]).toFixed(2)} ${transform.yForPrice(value).toFixed(2)}`).join(' ')
}

function HistoricalLayer({ candles, transform, keyLevels, showKeyLevels }: Pick<ChartCanvasProps, 'candles' | 'transform' | 'keyLevels' | 'showKeyLevels'>) {
  const maxVolume = Math.max(...candles.map((candle) => candle.volume), 1)
  const candleWidth = Math.max(5, Math.min(14, transform.rect.width / transform.times.length * 0.56))
  return (
    <g data-chart-layer="historical">
      <rect fill="#fbfcff" height={viewBox.height} width={viewBox.width} x="0" y="0" />
      <g className="sc-kline-grid">
        {[0, 1, 2, 3, 4].map((line) => <line key={`h-${line}`} x1={transform.rect.left} x2={transform.rect.left + transform.rect.width} y1={transform.rect.top + line * (transform.rect.height / 4)} y2={transform.rect.top + line * (transform.rect.height / 4)} />)}
        {[0, 1, 2, 3, 4, 5].map((line) => <line key={`v-${line}`} x1={transform.rect.left + line * (transform.rect.width / 5)} x2={transform.rect.left + line * (transform.rect.width / 5)} y1={transform.rect.top} y2={volumeTop + volumeHeight} />)}
      </g>
      <g className="sc-kline-axis-labels">
        {[0, 1, 2, 3, 4].map((line) => {
          const y = transform.rect.top + line * (transform.rect.height / 4)
          return <text key={line} x={transform.rect.left + transform.rect.width + 12} y={y + 4}>{priceText(transform.priceForY(y))}</text>
        })}
      </g>
      <g data-testid="candlestick-layer">
        {candles.map((candle) => {
          const x = transform.xForTime(candle.day)
          const openY = transform.yForPrice(candle.open)
          const closeY = transform.yForPrice(candle.close)
          const rising = candle.close >= candle.open
          return <g key={candle.day}><line className={rising ? 'sc-rise-stroke' : 'sc-fall-stroke'} x1={x} x2={x} y1={transform.yForPrice(candle.high)} y2={transform.yForPrice(candle.low)} /><rect className={rising ? 'sc-rise-fill' : 'sc-fall-fill'} height={Math.max(3, Math.abs(closeY - openY))} width={candleWidth} x={x - candleWidth / 2} y={Math.min(openY, closeY)} /></g>
        })}
      </g>
      {showKeyLevels ? <g data-testid="key-level-layer">{keyLevels.map((price, index) => <g key={price}><line className="sc-key-level-line" x1={transform.rect.left} x2={transform.rect.left + transform.rect.width} y1={transform.yForPrice(price)} y2={transform.yForPrice(price)} /><text className="sc-key-level-label" x={transform.rect.left + transform.rect.width - 78} y={transform.yForPrice(price) - 5}>{index === 0 ? '近20日高点' : '近20日低点'} {priceText(price)}</text></g>)}</g> : null}
      <g className="sc-volume-bars">{candles.map((candle) => {
        const height = Math.max(3, (candle.volume / maxVolume) * volumeHeight)
        return <rect height={height} key={candle.day} width={candleWidth} x={transform.xForTime(candle.day) - candleWidth / 2} y={volumeTop + volumeHeight - height} />
      })}</g>
      <text className="sc-volume-label" x={transform.rect.left} y={volumeTop + volumeHeight + 23}>成交量</text>
    </g>
  )
}

function IndicatorLayer({ indicators, indicatorValues, transform }: Pick<ChartCanvasProps, 'indicators' | 'indicatorValues' | 'transform'>) {
  return (
    <g data-chart-layer="indicator">
      {indicators.ma5 && indicatorValues.ma5.length ? <path d={linePath(indicatorValues.ma5, transform.times, transform)} fill="none" stroke={indicatorColors.ma5} strokeWidth="2" /> : null}
      {indicators.ma10 && indicatorValues.ma10.length ? <path d={linePath(indicatorValues.ma10, transform.times, transform)} fill="none" stroke={indicatorColors.ma10} strokeWidth="2" /> : null}
      {indicators.ma20 && indicatorValues.ma20.length ? <path d={linePath(indicatorValues.ma20, transform.times, transform)} fill="none" stroke={indicatorColors.ma20} strokeWidth="2" /> : null}
      {indicators.boll && indicatorValues.boll.upper.length ? <><path d={linePath(indicatorValues.boll.upper, transform.times, transform)} fill="none" stroke={indicatorColors.boll} strokeDasharray="5 4" strokeWidth="1.5" /><path d={linePath(indicatorValues.boll.middle, transform.times, transform)} fill="none" stroke="#9aa5c4" strokeWidth="1.5" /><path d={linePath(indicatorValues.boll.lower, transform.times, transform)} fill="none" stroke={indicatorColors.boll} strokeDasharray="5 4" strokeWidth="1.5" /></> : null}
    </g>
  )
}

export function ChartCanvas(props: ChartCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const gesture = useRef<PointerGesture | null>(null)
  const [crosshairPoint, setCrosshairPoint] = useState<{ x: number; y: number } | null>(null)

  const svgPoint = (event: ReactMouseEvent<SVGSVGElement> | ReactPointerEvent<SVGSVGElement>) => {
    return screenPoint(event.currentTarget, event.clientX, event.clientY)
  }
  const dataPointAt = (svg: SVGSVGElement, clientX: number, clientY: number): TimePricePoint => {
    const point = screenPoint(svg, clientX, clientY)
    return { time: props.transform.timeForX(point.x), price: props.transform.priceForY(point.y) }
  }
  const dataPoint = (event: ReactMouseEvent<SVGSVGElement> | ReactPointerEvent<SVGSVGElement>) => dataPointAt(event.currentTarget, event.clientX, event.clientY)
  const drawing = (kind: DrawingKind, points: TimePricePoint[]): DrawingObject => ({
    id: `${kind}-${Date.now()}`,
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
    if (props.activeTool === 'pointer' || props.activeTool === 'trend-line' || props.activeTool === 'rectangle' || props.activeTool === 'marker') {
      if (props.activeTool === 'pointer') props.onSelectDrawing(null)
      return
    }
    props.onCreateDrawing(drawing(props.activeTool, [dataPoint(event)]))
  }
  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (props.activeTool !== 'trend-line' && props.activeTool !== 'rectangle') return
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
    const active = gesture.current
    if (!active || active.pointerId !== event.pointerId) return
    gesture.current = null
    const end = dataPoint(event)
    if (active.kind === 'move-point' && active.drawingId !== undefined && active.pointIndex !== undefined) {
      if (!samePoint(active.start, end)) props.onMovePoint(active.drawingId, active.pointIndex, end)
    } else if (active.kind === 'move-drawing' && active.drawingId !== undefined) {
      const delta = {
        timeIndexDelta: props.transform.times.indexOf(end.time) - props.transform.times.indexOf(active.start.time),
        timeDomain: props.transform.times,
        priceDelta: end.price - active.start.price,
      }
      if (delta.timeIndexDelta !== 0 || delta.priceDelta !== 0) props.onMoveDrawing(active.drawingId, delta)
    } else if (active.kind === 'create' && active.drawingKind) {
      if (!samePoint(active.start, end)) props.onCreateDrawing(drawing(active.drawingKind, [active.start, end]))
    }
    releaseGestureCapture(active)
  }
  const cancelPointerGesture = (event: ReactPointerEvent<SVGSVGElement>) => {
    const active = gesture.current
    if (!active || active.pointerId !== event.pointerId) return
    gesture.current = null
    releaseGestureCapture(active)
  }
  const clearLostPointerGesture = (event: ReactPointerEvent<SVGSVGElement>) => {
    const active = gesture.current
    if (active?.pointerId === event.pointerId) gesture.current = null
  }
  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (props.crosshair) setCrosshairPoint(svgPoint(event))
  }
  const handleKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    const modifier = event.ctrlKey || event.metaKey
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
  const crosshairIndex = crosshairTime ? props.candles.findIndex((candle) => candle.day === crosshairTime) : -1
  const crosshairCandle = crosshairIndex >= 0 ? props.candles[crosshairIndex] : null
  const crosshairPrice = crosshairPoint ? props.transform.priceForY(crosshairPoint.y) : null

  return (
    <svg aria-keyshortcuts="Delete Escape Control+Z Meta+Z Control+Y Meta+Y" aria-label="K线主图" className="sc-kline-svg" onClick={createPointDrawing} onKeyDown={handleKeyDown} onLostPointerCapture={clearLostPointerGesture} onPointerCancel={cancelPointerGesture} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} preserveAspectRatio="xMidYMid meet" ref={svgRef} role="img" tabIndex={0} viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}>
      <HistoricalLayer candles={props.candles} keyLevels={props.keyLevels} showKeyLevels={props.showKeyLevels} transform={props.transform} />
      <IndicatorLayer indicatorValues={props.indicatorValues} indicators={props.indicators} transform={props.transform} />
      <g data-chart-layer="prediction">{props.prediction ? <PredictionLayer hoveredDay={props.hoveredDay} onHoverDay={props.onHoverDay} onSelectDay={props.onSelectPredictionDay} prediction={props.prediction} selectedDay={props.selectedPredictionDay} transform={props.transform} /> : null}</g>
      <g data-chart-layer="drawing">{props.showDrawings ? <DrawingLayer drawings={props.drawings} onFocusEditor={() => svgRef.current?.focus()} onMoveDrawing={beginDrawingMove} onMovePoint={beginPointMove} onSelect={props.onSelectDrawing} selectedId={props.selectedId} transform={props.transform} /> : null}</g>
      <g data-chart-layer="crosshair">{props.crosshair && crosshairPoint && crosshairCandle && crosshairPrice !== null ? <g data-testid="crosshair-layer"><line className="sc-crosshair" x1={props.transform.xForTime(crosshairCandle.day)} x2={props.transform.xForTime(crosshairCandle.day)} y1={props.transform.rect.top} y2={volumeTop + volumeHeight} /><line className="sc-crosshair" x1={props.transform.rect.left} x2={props.transform.rect.left + props.transform.rect.width} y1={props.transform.yForPrice(crosshairPrice)} y2={props.transform.yForPrice(crosshairPrice)} /><g data-testid="crosshair-tooltip"><rect fill="#17213c" height="66" opacity="0.94" rx="5" width="188" x={props.transform.rect.left + 6} y={props.transform.rect.top + 8} /><text fill="#fff" fontSize="11" x={props.transform.rect.left + 14} y={props.transform.rect.top + 26}>{crosshairCandle.day} · 开 {priceText(crosshairCandle.open)} 高 {priceText(crosshairCandle.high)}</text><text fill="#fff" fontSize="11" x={props.transform.rect.left + 14} y={props.transform.rect.top + 43}>低 {priceText(crosshairCandle.low)} 收 {priceText(crosshairCandle.close)} · 光标 {priceText(crosshairPrice)}</text><text fill="#dfe6ff" fontSize="10" x={props.transform.rect.left + 14} y={props.transform.rect.top + 58}>MA5 {priceText(props.indicatorValues.ma5[crosshairIndex])} · BOLL {priceText(props.indicatorValues.boll.middle[crosshairIndex])}</text></g></g> : null}</g>
    </svg>
  )
}
