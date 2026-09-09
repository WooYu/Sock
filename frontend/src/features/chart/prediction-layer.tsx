import type { ChartTransform } from './chart-coordinates'
import type { PredictionSnapshot } from './chart-types'

type PredictionLayerProps = {
  prediction: PredictionSnapshot
  transform: ChartTransform
  hoveredDay: string | null
  onHoverDay: (day: string | null) => void
  selectedDay?: string | null
  onSelectDay?: (day: string) => void
}

export function PredictionLayer({ prediction, transform, hoveredDay, onHoverDay, selectedDay = null, onSelectDay }: PredictionLayerProps) {
  const days = prediction.days.filter((day) => transform.hasTime(day.day))
  if (!days.length) return null

  const step = transform.rect.width / transform.times.length
  const firstX = transform.xForTime(days[0].day)
  const boundaryX = firstX - step / 2
  const regionWidth = step * days.length
  const candleWidth = Math.max(5, Math.min(14, step * 0.56))

  return (
    <g data-testid="prediction-layer">
      <rect data-testid="prediction-region" fill="#eaf6ff" height={transform.rect.height} opacity="0.7" pointerEvents="none" width={regionWidth} x={boundaryX} y={transform.rect.top} />
      <line
        data-testid="prediction-boundary"
        pointerEvents="none"
        stroke="#60a5fa"
        strokeDasharray="6 4"
        x1={boundaryX}
        x2={boundaryX}
        y1={transform.rect.top}
        y2={transform.rect.top + transform.rect.height}
      />
      <text fill="#2563eb" fontSize="11" pointerEvents="none" x={boundaryX + 8} y={transform.rect.top + 14}>未来推演</text>
      {days.map((day) => {
        const x = transform.xForTime(day.day)
        const openY = transform.yForPrice(day.open)
        const closeY = transform.yForPrice(day.close)
        const rising = day.close >= day.open
        const highlighted = hoveredDay === day.day
        const selected = selectedDay === day.day
        return (
          <g
            data-active={selected || undefined}
            data-testid="prediction-candle"
            key={day.day}
            onClick={(event) => { event.stopPropagation(); onSelectDay?.(day.day) }}
            onMouseEnter={() => onHoverDay(day.day)}
            onMouseLeave={() => onHoverDay(null)}
            opacity="0.55"
            strokeDasharray="4 3"
          >
            {highlighted || selected ? <rect fill="#bfdbfe" height={transform.rect.height} opacity={selected ? '0.8' : '0.65'} width={step} x={x - step / 2} y={transform.rect.top} /> : null}
            <line stroke={rising ? '#dc2626' : '#16a34a'} strokeWidth="1.5" x1={x} x2={x} y1={transform.yForPrice(day.high)} y2={transform.yForPrice(day.low)} />
            <rect
              fill={rising ? '#fecaca' : '#bbf7d0'}
              height={Math.max(3, Math.abs(closeY - openY))}
              stroke={rising ? '#dc2626' : '#16a34a'}
              width={candleWidth}
              x={x - candleWidth / 2}
              y={Math.min(openY, closeY)}
            />
          </g>
        )
      })}
    </g>
  )
}
