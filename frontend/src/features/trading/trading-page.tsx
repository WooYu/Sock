'use client'

import Link from 'next/link'
import { useState } from 'react'

export type TradingTab = 'positions' | 'ledger' | 'predictions' | 'statistics'

const tabs: Array<[TradingTab, string]> = [['positions', '持仓与交易'], ['ledger', '交易流水'], ['predictions', '预测记录'], ['statistics', '统计图表']]

export function TradingPage({ symbol, initialTab = 'positions' }: { symbol?: string | null; initialTab?: TradingTab }) {
  const [tab, setTab] = useState<TradingTab>(initialTab)
  const label = tabs.find(([key]) => key === tab)?.[1] ?? '持仓与交易'
  return <section className="space-y-5 rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5"><div><p className="text-sm text-[var(--sc-muted)]">{symbol ? `当前股票：${symbol}` : '账户与组合'}</p><h1 className="mt-1 text-2xl font-semibold">{label}</h1></div><div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="交易内容"><div className="flex min-w-max gap-2">{tabs.map(([key, name]) => <Link className="min-h-12 rounded-xl px-4 py-3 text-sm data-[active=true]:bg-[var(--sc-primary)] data-[active=true]:text-white" data-active={tab === key} href={`/trading/${key}${symbol ? `?symbol=${symbol}` : ''}`} key={key} onClick={() => setTab(key)} role="tab" aria-selected={tab === key}>{name}</Link>)}</div></div><TradingContent tab={tab} symbol={symbol} /></section>
}

function TradingContent({ tab, symbol }: { tab: TradingTab; symbol?: string | null }) {
  if (tab === 'positions') return <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-3">{[['持仓市值', '—'], ['今日盈亏', '—'], ['累计收益率', '—']].map(([title, value]) => <article className="rounded-xl bg-[var(--sc-surface-muted)] p-4" key={title}><p className="text-sm text-[var(--sc-muted)]">{title}</p><p className="mt-2 text-xl font-semibold">{value}</p></article>)}</div><div className="flex flex-wrap gap-3"><Link className="min-h-12 rounded-xl bg-[var(--sc-primary)] px-4 py-3 text-sm font-semibold text-white" href={`/analysis/key-levels${symbol ? `?symbol=${symbol}` : ''}`}>查看个股分析</Link><Link className="min-h-12 rounded-xl border border-[var(--sc-border)] px-4 py-3 text-sm font-semibold" href={`/chart${symbol ? `?symbol=${symbol}` : ''}`}>打开 K 线</Link></div></div>
  if (tab === 'ledger') return <EmptyTradingState title="交易流水" action="记录第一笔交易" />
  if (tab === 'predictions') return <EmptyTradingState title="预测记录" action="从个股分析创建预测" href={`/analysis/key-levels${symbol ? `?symbol=${symbol}` : ''}`} />
  return <div className="grid gap-3 sm:grid-cols-2"><article className="rounded-xl bg-[var(--sc-surface-muted)] p-4"><p className="text-sm text-[var(--sc-muted)]">胜率</p><p className="mt-2 text-2xl font-semibold">—</p></article><article className="rounded-xl bg-[var(--sc-surface-muted)] p-4"><p className="text-sm text-[var(--sc-muted)]">盈亏比</p><p className="mt-2 text-2xl font-semibold">—</p></article></div>
}

function EmptyTradingState({ title, action, href }: { title: string; action: string; href?: string }) {
  return <div className="rounded-xl border border-dashed border-[var(--sc-border)] p-6"><p className="font-medium">暂无{title}</p><p className="mt-2 text-sm text-[var(--sc-muted)]">数据接入后将在这里展示。</p>{href ? <Link className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-[var(--sc-primary)] px-4 text-sm font-semibold text-white" href={href}>{action}</Link> : null}</div>
}
