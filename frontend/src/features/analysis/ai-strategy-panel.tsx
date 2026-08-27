import type { StockAnalysis } from '../workspace/stock-workspace-types'

export function AiStrategyPanel({ analysis }: { analysis?: StockAnalysis | null }) {
  return <section className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5"><p className="text-sm text-[var(--sc-muted)]">数值计算 → 规则匹配 → AI 解释</p><h2 className="mt-1 text-xl font-semibold">AI 策略</h2>{analysis ? <div className="mt-4 grid gap-3 sm:grid-cols-3">{['数值计算', '规则匹配', 'AI 解释'].map((label) => <article className="rounded-xl bg-[var(--sc-surface-muted)] p-4" key={label}><p className="font-semibold">{label}</p><p className="mt-2 text-sm text-[var(--sc-muted)]">已读取当前分析快照；解释结果需后端 AI 服务可用。</p></article>)}</div> : <p className="mt-4 rounded-xl bg-[var(--sc-surface-muted)] p-4 text-sm text-[var(--sc-muted)]">请先加载行情，未生成伪 AI 结果。</p>}</section>
}
