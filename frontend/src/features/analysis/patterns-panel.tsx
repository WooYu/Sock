import type { StockAnalysis } from '../workspace/stock-workspace-types'

export function PatternsPanel({ analysis }: { analysis?: StockAnalysis | null }) {
  if (!analysis) return <p className="rounded-2xl border border-dashed border-[var(--sc-border)] p-6 text-sm text-[var(--sc-muted)]">盈利模式等待行情快照。</p>
  const rules = analysis.matchedRules
  return <section className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5"><p className="text-sm text-[var(--sc-muted)]">规则命中 {rules.length} 条</p><h2 className="mt-1 text-xl font-semibold">盈利模式</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{(rules.length ? rules : [{ name: '等待已发布规则', score: 0, band: '待确认' }]).map((rule) => <article className="rounded-xl bg-[var(--sc-surface-muted)] p-4" key={rule.name}><p className="font-semibold">{rule.name}</p><p className="mt-2 text-sm text-[var(--sc-muted)]">匹配分数 {rule.score} · {rule.band}</p></article>)}</div></section>
}
