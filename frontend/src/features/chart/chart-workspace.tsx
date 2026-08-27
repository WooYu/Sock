'use client'

import { useRef, useState } from 'react'
import type { MarketSnapshot } from '../workspace/stock-workspace-types'
import { ChartAnnotationStore, type ChartAnnotation, type ChartTool } from './chart-annotation-store'
import { ChartLayerPanel, type ChartLayerState } from './chart-layer-panel'
import { ChartToolbar } from './chart-toolbar'

export function ChartWorkspace({ snapshot }: { snapshot?: MarketSnapshot | null }) {
  const [activeTool, setActiveTool] = useState<ChartTool>('pointer')
  const [layers, setLayers] = useState<ChartLayerState>({ keyLevels: true, predictionPaths: true, trades: true, annotations: true })
  const [annotations, setAnnotations] = useState<ChartAnnotation[]>([])
  const store = useRef(new ChartAnnotationStore())
  const candles = snapshot?.dailyCandles ?? []

  const addRectangle = () => {
    const next = store.current.create({ id: `rectangle-${Date.now()}`, kind: 'rectangle', start: { x: 20, y: 20 }, end: { x: 130, y: 90 } })
    setAnnotations(next)
  }

  return <section className="space-y-4 rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-[var(--sc-muted)]">{snapshot?.quote.security.name ?? '等待行情快照'}</p><h1 className="mt-1 text-xl font-semibold">专业 K 线</h1></div><div className="flex gap-2"><button className="min-h-12 rounded-xl bg-[var(--sc-surface-muted)] px-3 text-sm" type="button">日线</button><button className="min-h-12 rounded-xl bg-[var(--sc-surface-muted)] px-3 text-sm" type="button">复位</button><button className="min-h-12 rounded-xl bg-[var(--sc-surface-muted)] px-3 text-sm" onClick={() => setAnnotations(store.current.undo())} type="button">撤销</button><button className="min-h-12 rounded-xl bg-[var(--sc-surface-muted)] px-3 text-sm" onClick={() => setAnnotations(store.current.redo())} type="button">重做</button></div></div><ChartToolbar activeTool={activeTool} onToolChange={setActiveTool} /><div className="grid gap-4 lg:grid-cols-[1fr_260px]"><div className="min-w-0 space-y-3"><div className="relative aspect-[16/9] min-h-[280px] overflow-hidden rounded-xl border border-[var(--sc-border)] bg-[#101729]" data-testid="chart-canvas"><svg aria-label="K线图" className="h-full w-full" viewBox="0 0 800 450" role="img"><g stroke="#33415f" strokeWidth="1">{[50, 130, 210, 290, 370].map((y) => <line key={y} x1="0" x2="800" y1={y} y2={y} />)}</g>{candles.map((candle, index) => { const x = 20 + index * 18; const high = 420 - candle.high; const low = 420 - candle.low; const open = 420 - candle.open; const close = 420 - candle.close; return <g key={`${candle.day}-${index}`}><line stroke={close >= open ? '#d94b5b' : '#15946f'} x1={x + 5} x2={x + 5} y1={high} y2={low} /><rect fill={close >= open ? '#d94b5b' : '#15946f'} height={Math.max(2, Math.abs(close - open))} width="10" x={x} y={Math.min(open, close)} /></g> })}</svg>{layers.keyLevels ? <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-[#d94b5b]" data-testid="key-level-layer" /> : null}{layers.trades ? <div data-testid="trade-layer" /> : null}{layers.annotations && annotations.map((annotation) => <div className="absolute border-2 border-[#f0b44d]" data-testid={`annotation-${annotation.kind}`} key={annotation.id} style={{ left: annotation.start.x, top: annotation.start.y, width: (annotation.end?.x ?? annotation.start.x) - annotation.start.x, height: (annotation.end?.y ?? annotation.start.y) - annotation.start.y }} />)}</div>{activeTool === 'rectangle' ? <button className="min-h-12 rounded-xl border border-dashed border-[var(--sc-primary)] px-4 text-sm font-semibold text-[var(--sc-primary)]" onClick={addRectangle} type="button">添加矩形示例</button> : null}</div><ChartLayerPanel layers={layers} onChange={(key, value) => setLayers((old) => ({ ...old, [key]: value }))} /></div></section>
}
