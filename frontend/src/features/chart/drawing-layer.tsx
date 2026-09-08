import type { PointerEvent as ReactPointerEvent, ReactNode, SyntheticEvent } from 'react'
import type { ChartTransform } from './chart-coordinates'
import type { DrawingObject } from './chart-types'

type DrawingLayerProps = {
  drawings: DrawingObject[]
  transform: ChartTransform
  selectedId: string | null
  onSelect: (id: string) => void
  onFocusEditor?: () => void
  onMoveDrawing?: (drawingId: string, event: ReactPointerEvent<SVGElement>) => void
  onMovePoint: (drawingId: string, pointIndex: number, event: ReactPointerEvent<SVGElement>) => void
}

function markerLabel(kind: DrawingObject['kind']) {
  if (kind === 'buy') return '买入'
  if (kind === 'sell') return '卖出'
  if (kind === 'target') return '目标'
  return '止损'
}

function labelWidth(text: string) {
  const estimatedGlyphWidth = Array.from(text).reduce((width, glyph) => width + (/^[\x00-\x7F]$/.test(glyph) ? 7 : 12), 0)
  return Math.max(44, estimatedGlyphWidth + 8)
}

export function DrawingLayer({ drawings, transform, selectedId, onSelect, onFocusEditor, onMoveDrawing, onMovePoint }: DrawingLayerProps) {
  return (
    <g data-testid="drawing-layer">
      {drawings.map((drawing) => {
        if (!drawing.visible || !drawing.points.length || drawing.points.some((point) => !transform.hasTime(point.time))) return null

        const points = drawing.points.map((point) => ({ x: transform.xForTime(point.time), y: transform.yForPrice(point.price) }))
        const selected = drawing.id === selectedId
        const dash = drawing.style.lineStyle === 'dashed' ? '5 4' : undefined
        const common = { stroke: drawing.style.color, strokeDasharray: dash, strokeWidth: drawing.style.width, opacity: drawing.style.opacity }
        const hitWidth = Math.max(12, drawing.style.width)
        const select = (event: SyntheticEvent<SVGElement>) => {
          event.stopPropagation()
          onSelect(drawing.id)
        }
        const beginMove = (event: ReactPointerEvent<SVGElement>) => {
          onFocusEditor?.()
          select(event)
          if (!drawing.locked) onMoveDrawing?.(drawing.id, event)
        }
        const interaction = { onClick: select, onPointerDown: beginMove }
        let visible: ReactNode
        let hitArea: ReactNode

        if (drawing.kind === 'horizontal-line') {
          const y = points[0].y
          visible = <line data-testid="drawing-visible-line" {...common} {...interaction} x1={transform.rect.left} x2={transform.rect.left + transform.rect.width} y1={y} y2={y} />
          hitArea = <line data-testid="drawing-hit-area" onClick={select} onPointerDown={beginMove} pointerEvents="stroke" stroke="transparent" strokeWidth={hitWidth} x1={transform.rect.left} x2={transform.rect.left + transform.rect.width} y1={y} y2={y} />
        } else if (drawing.kind === 'rectangle' && points.length >= 2) {
          const x = Math.min(points[0].x, points[1].x)
          const y = Math.min(points[0].y, points[1].y)
          const width = Math.abs(points[1].x - points[0].x)
          const height = Math.abs(points[1].y - points[0].y)
          visible = <rect data-testid="drawing-visible-rectangle" fill={drawing.style.color} fillOpacity={drawing.style.opacity * 0.08} height={height} {...common} {...interaction} width={width} x={x} y={y} />
          hitArea = <rect data-testid="drawing-hit-area" fill="transparent" height={Math.max(height, hitWidth)} {...interaction} pointerEvents="all" stroke="transparent" strokeWidth={hitWidth} width={Math.max(width, hitWidth)} x={x} y={y} />
        } else if (drawing.kind === 'trend-line' && points.length >= 2) {
          visible = <line data-testid="drawing-visible-line" {...common} {...interaction} x1={points[0].x} x2={points[1].x} y1={points[0].y} y2={points[1].y} />
          hitArea = <line data-testid="drawing-hit-area" onClick={select} onPointerDown={beginMove} pointerEvents="stroke" stroke="transparent" strokeWidth={hitWidth} x1={points[0].x} x2={points[1].x} y1={points[0].y} y2={points[1].y} />
        } else if (drawing.kind === 'text') {
          const text = drawing.text ?? '文字备注'
          visible = <text fill={drawing.style.color} opacity={drawing.style.opacity} {...interaction} x={points[0].x} y={points[0].y}>{text}</text>
          hitArea = <rect data-testid="drawing-hit-area" fill="transparent" height="28" {...interaction} pointerEvents="all" width={labelWidth(text)} x={points[0].x - 4} y={points[0].y - 20} />
        } else {
          const text = `${markerLabel(drawing.kind)} · 价格 ${drawing.points[0].price.toFixed(2)}`
          visible = <g {...interaction}><circle cx={points[0].x} cy={points[0].y} fill={drawing.style.color} opacity={drawing.style.opacity} r="8" /><text fill={drawing.style.color} x={points[0].x + 11} y={points[0].y + 4}>{text}</text></g>
          hitArea = <rect data-testid="drawing-hit-area" fill="transparent" height="28" {...interaction} pointerEvents="all" width={21 + labelWidth(text)} x={points[0].x - 10} y={points[0].y - 14} />
        }

        return (
          <g data-selected={selected || undefined} data-testid={drawing.kind === 'rectangle' ? 'annotation-rectangle' : drawing.kind === 'trend-line' ? 'annotation-trend-line' : drawing.kind === 'horizontal-line' ? 'annotation-horizontal-line' : drawing.kind === 'text' ? 'annotation-text' : `annotation-${drawing.kind}`} key={drawing.id}>
            <g data-testid="drawing-object">
            {visible}
            {drawing.kind === 'horizontal-line' ? <text data-testid="drawing-price-label" fill={drawing.style.color} fontSize="11" textAnchor="end" x={transform.rect.left + transform.rect.width - 4} y={points[0].y - 5}>{drawing.points[0].price.toFixed(2)}</text> : null}
            {hitArea}
            {selected && !drawing.locked ? points.map((point, index) => (
              <circle
                data-testid="drawing-handle"
                fill="#fff"
                key={`${drawing.id}-${index}`}
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => { event.stopPropagation(); onFocusEditor?.(); onMovePoint(drawing.id, index, event) }}
                r="5"
                stroke={drawing.style.color}
                strokeWidth="2"
                cx={point.x}
                cy={point.y}
              />
            )) : null}
            </g>
          </g>
        )
      })}
    </g>
  )
}
