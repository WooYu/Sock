'use client'

import { useStockWorkspace } from '../workspace/stock-workspace-provider'
import type { OperationCycle } from '../workspace/stock-workspace-types'

const cycles: Array<[OperationCycle, string]> = [['short', '短线'], ['swing', '波段'], ['long', '中长线']]

export function StockHeader() {
  const workspace = useStockWorkspace()
  const quote = workspace.current?.market.quote
  const security = workspace.current?.security ?? workspace.selectedSecurity

  if (!security) {
    return <div className="rounded-2xl border border-dashed border-[var(--sc-border)] p-6 text-sm text-[var(--sc-muted)]">请从总览或搜索中选择股票。</div>
  }

  return (
    <section className="sc-stock-header rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--sc-muted)]">{security.code} · {security.exchange ?? 'A股'}</p>
          <h1 className="mt-1 text-2xl font-semibold">{security.name}</h1>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold">{quote?.price ?? '—'}</p>
          <p className="text-sm text-[var(--sc-muted)]">数据状态：{workspace.status}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-sm text-[var(--sc-muted)]">
        <span>开 {quote?.open ?? '—'}</span><span>高 {quote?.high ?? '—'}</span><span>低 {quote?.low ?? '—'}</span><span>量 {quote?.volume ?? '—'}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2" aria-label="操作周期">
        {cycles.map(([value, label]) => (
          <button
            aria-pressed={workspace.cycle === value}
            className={`min-h-12 rounded-xl px-4 text-sm font-semibold ${workspace.cycle === value ? 'bg-[var(--sc-primary)] text-white' : 'bg-[var(--sc-surface-muted)] text-[var(--sc-muted)]'}`}
            key={value}
            onClick={() => void workspace.setCycle(value)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  )
}
