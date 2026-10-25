import type { StockAnalysis } from '../workspace/stock-workspace-types'

export function FutureIndicatorsPanel({ analysis }: { analysis?: StockAnalysis | null }) {
  if (!analysis) return <p className="sc-analysis-empty rounded-2xl border border-dashed border-[var(--sc-border)] p-6 text-sm text-[var(--sc-muted)]">未来指标等待行情快照。</p>
  return <section className="sc-analysis-panel sc-analysis-secondary-panel rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5"><p className="text-sm text-[var(--sc-muted)]">指标外推 · 生成时间以行情快照为准</p><h2 className="mt-1 text-xl font-semibold">未来三日指标</h2><p className="sc-form-note">这些数值来自指标外推，需结合后续行情核对。</p>{analysis.future.length ? <div className="sc-future-indicator-grid">{analysis.future.map(item => <article className="sc-future-indicator-card" key={item.day}><h3><time dateTime={item.day}>{formatDay(item.day)}</time></h3><dl>{Object.entries(item.maValues).map(([key, value]) => <div key={key}><dt>{key.toUpperCase().startsWith('MA') ? key.toUpperCase() : `MA${key}`}</dt><dd>{formatValue(value)}</dd></div>)}<div><dt>BOLL 上轨</dt><dd>{formatValue(item.bollUpper)}</dd></div><div><dt>BOLL 中轨</dt><dd>{formatValue(item.bollMiddle)}</dd></div><div><dt>BOLL 下轨</dt><dd>{formatValue(item.bollLower)}</dd></div></dl></article>)}</div> : <p className="sc-inline-status">当前快照没有未来指标，更新行情后再查看。</p>}</section>
}

function formatValue(value: number) { return Number.isFinite(value) ? value.toFixed(2) : '—' }
function formatDay(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'long', day: 'numeric' }) : value
}
