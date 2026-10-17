'use client'

import { useCallback, useState } from 'react'
import { DEFAULT_VISIBLE_BARS, normalizeViewport, panViewport, viewportRange, zoomViewport, type ChartViewport } from './chart-viewport'

/** Viewport navigation stays separate from immutable drawing commands and their undo history. */
export function useChartViewport(key: string, total: number) {
  const [views, setViews] = useState<Record<string, ChartViewport>>({})
  const view = normalizeViewport(views[key] ?? { count: DEFAULT_VISIBLE_BARS, offset: 0 }, total)
  const range = viewportRange(view, total)
  const update = useCallback((fn: (previous: ChartViewport) => ChartViewport) => {
    setViews(previous => ({ ...previous, [key]: fn(previous[key] ?? { count: DEFAULT_VISIBLE_BARS, offset: 0 }) }))
  }, [key])
  const zoomBy = useCallback((factor: number, anchor = 1) => update(view => zoomViewport(view, total, factor, anchor)), [total, update])
  const panBy = useCallback((bars: number) => update(view => panViewport(view, total, bars)), [total, update])
  const latest = useCallback(() => update(view => ({ ...view, offset: 0 })), [update])
  const reset = useCallback(() => update(() => ({ count: DEFAULT_VISIBLE_BARS, offset: 0 })), [update])
  const fit = useCallback(() => update(() => ({ count: total, offset: 0 })), [total, update])
  const reveal = useCallback((index: number) => update(view => {
    const current = normalizeViewport(view, total)
    return normalizeViewport({ ...current, offset: total - index - current.count / 2 }, total)
  }), [total, update])
  const seek = useCallback((end: number) => update(view => normalizeViewport({ ...view, offset: total - end }, total)), [total, update])
  return { ...range, count: range.end - range.start, atLatest: range.end === total, zoomBy, panBy, latest, reset, fit, reveal, seek }
}
