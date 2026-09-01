import type { StockAnalysis } from '../workspace/stock-workspace-types'

export function FutureIndicatorsPanel({ analysis }: { analysis?: StockAnalysis | null }) {
  if (!analysis) return <p className="sc-analysis-empty rounded-2xl border border-dashed border-[var(--sc-border)] p-6 text-sm text-[var(--sc-muted)]">未来指标等待行情快照。</p>
  return <section className="sc-analysis-panel sc-analysis-secondary-panel rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5"><p className="text-sm text-[var(--sc-muted)]">算法外推 · 生成时间以行情快照为准</p><h2 className="mt-1 text-xl font-semibold">未来三日指标</h2><div className="mt-4 grid gap-3 sm:grid-cols-3">{(analysis.future.length ? analysis.future : [{ day: '—', maValues: {}, bollUpper: 0, bollMiddle: 0, bollLower: 0 }]).map((item) => <article className="sc-analysis-secondary-card rounded-xl border border-dashed border-[var(--sc-border)] p-4" key={item.day}><p className="text-sm text-[var(--sc-muted)]">{item.day}</p><p className="mt-2 text-sm">MA {Object.values(item.maValues)[0] ?? '—'}</p><p className="mt-1 text-sm text-[var(--sc-muted)]">BOLL {item.bollLower} / {item.bollMiddle} / {item.bollUpper}</p></article>)}</div></section>
}
