export type ChartViewport = { count: number; offset: number }
export const DEFAULT_VISIBLE_BARS = 80
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export function normalizeViewport(view: ChartViewport, total: number): ChartViewport {
  const count = clamp(view.count, Math.min(12, total), total)
  return { count, offset: clamp(view.offset, 0, Math.max(0, total - count)) }
}

export function viewportRange(view: ChartViewport, total: number) {
  const normalized = normalizeViewport(view, total)
  const end = Math.round(total - normalized.offset)
  return { start: Math.max(0, end - Math.round(normalized.count)), end }
}

/** Keep the candle under the cursor at the same relative horizontal position. */
export function zoomViewport(view: ChartViewport, total: number, factor: number, anchor = 1): ChartViewport {
  const current = normalizeViewport(view, total)
  const fraction = clamp(anchor, 0, 1)
  const count = normalizeViewport({ count: current.count * factor, offset: 0 }, total).count
  const anchorIndex = total - current.offset - current.count * (1 - fraction)
  return normalizeViewport({ count, offset: total - anchorIndex - count * (1 - fraction) }, total)
}

export function panViewport(view: ChartViewport, total: number, bars: number): ChartViewport {
  const current = normalizeViewport(view, total)
  return normalizeViewport({ ...current, offset: current.offset - bars }, total)
}
