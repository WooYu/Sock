'use client'

import Link from 'next/link'
import { useStockWorkspace } from '../workspace/stock-workspace-provider'

export type OverviewHolding = { symbol: string; name: string; marketValue?: number; profitRate?: number }

export function OverviewPage({ holdings = [] }: { holdings?: OverviewHolding[] }) {
  const workspace = useStockWorkspace()

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--sc-primary)]">StockCal</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">组合总览</h1>
        </div>
        <span className="text-sm text-[var(--sc-muted)]">{workspace.status === 'idle' ? '等待选择股票' : `状态：${workspace.status}`}</span>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['持仓股票', holdings.length.toString()],
          ['总投入', '—'],
          ['当前市值', '—'],
          ['浮动盈亏', '—'],
        ].map(([label, value]) => (
          <article className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-4" key={label}>
            <p className="text-sm text-[var(--sc-muted)]">{label}</p>
            <p className="mt-2 text-xl font-semibold">{value}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">持仓摘要</h2>
          <Link className="text-sm font-semibold text-[var(--sc-primary)]" href="/trading/positions">查看交易</Link>
        </div>
        {holdings.length === 0 ? (
          <p className="mt-8 rounded-xl bg-[var(--sc-surface-muted)] p-6 text-center text-sm text-[var(--sc-muted)]">暂无持仓数据，请先登录或配置组合。</p>
        ) : (
          <div className="mt-4 divide-y divide-[var(--sc-border)]">
            {holdings.map((holding) => (
              <div className="flex flex-wrap items-center justify-between gap-3 py-4" key={holding.symbol}>
                <button
                  className="min-h-12 rounded-xl px-2 text-left font-semibold hover:bg-[var(--sc-surface-muted)]"
                  onClick={() => void workspace.selectStock(holding.symbol)}
                  type="button"
                >
                  {holding.name} {holding.symbol}
                </button>
                <div className="flex items-center gap-4 text-sm text-[var(--sc-muted)]">
                  <span>市值 {holding.marketValue ?? '—'}</span>
                  <span>收益率 {holding.profitRate ?? '—'}</span>
                  <Link className="font-semibold text-[var(--sc-primary)]" href={`/analysis/key-levels?symbol=${holding.symbol}`}>查看个股分析</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {workspace.selectedSymbol ? (
        <p className="rounded-xl border border-[var(--sc-primary)]/20 bg-[var(--sc-primary)]/5 p-4 text-sm font-medium">
          当前股票：{workspace.selectedSymbol}
        </p>
      ) : null}
    </div>
  )
}
