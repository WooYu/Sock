import { act, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { ChartTooltipFrame } from './chart-tooltip-frame'

test('cancels independent SVG scales and recalculates available width on resize', () => {
  let resize = () => {}
  const disconnect = vi.fn()
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resize = callback }
    observe() {}
    disconnect = disconnect
  })
  let matrix = { a: 1.5, b: 0, c: 0, d: .8 }
  const original = SVGSVGElement.prototype.getScreenCTM
  SVGSVGElement.prototype.getScreenCTM = () => matrix as DOMMatrix
  try {
    const view = render(<svg><ChartTooltipFrame x={10} y={20} maxWidth={300} testId="tooltip">{width => <rect width={width} />}</ChartTooltipFrame></svg>)
    const tooltip = screen.getByTestId('tooltip')
    expect(tooltip).toHaveAttribute('transform', 'translate(10 20) scale(0.6666666666666666 1.25)')
    expect(tooltip.querySelector('rect')).toHaveAttribute('width', '450')
    matrix = { a: .5, b: 0, c: 0, d: 1 }
    act(() => resize())
    expect(tooltip).toHaveAttribute('transform', 'translate(10 20) scale(2 1)')
    expect(tooltip.querySelector('rect')).toHaveAttribute('width', '150')
    view.unmount()
    expect(disconnect).toHaveBeenCalledOnce()
  } finally {
    SVGSVGElement.prototype.getScreenCTM = original
    vi.unstubAllGlobals()
  }
})
