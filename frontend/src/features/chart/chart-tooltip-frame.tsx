import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/** Keep text and controls in CSS pixels when the plot stretches its SVG viewBox. */
export function ChartTooltipFrame({ x, y, maxWidth, testId, interactive = false, children }: {
  x: number; y: number; maxWidth: number; testId: string; interactive?: boolean; children: (width: number, scale: { x: number; y: number }) => ReactNode
}) {
  const ref = useRef<SVGGElement>(null)
  const [scale, setScale] = useState({ x: 1, y: 1 })
  useLayoutEffect(() => {
    const svg = ref.current?.ownerSVGElement
    if (!svg) return
    const measure = () => {
      const matrix = svg.getScreenCTM?.()
      if (!matrix) return
      const x = Math.hypot(matrix.a, matrix.b), y = Math.hypot(matrix.c, matrix.d)
      if (x > 0 && y > 0) setScale(current => current.x === x && current.y === y ? current : { x, y })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(svg)
    return () => observer.disconnect()
  }, [])
  return <g ref={ref} data-testid={testId} pointerEvents={interactive ? undefined : 'none'} transform={`translate(${x} ${y}) scale(${1 / scale.x} ${1 / scale.y})`}>
    {children(maxWidth * scale.x, scale)}
  </g>
}
