'use client'

import Link from 'next/link'
import { useState } from 'react'

export type ReviewTab = 'daily' | 'trade' | 'history' | 'backtest'
const tabs: Array<[ReviewTab, string]> = [['daily', '当日总结'], ['trade', '单笔复盘'], ['history', '历史复盘'], ['backtest', '规则回测']]

export function ReviewPage({ initialTab = 'daily' }: { initialTab?: ReviewTab }) {
  const [tab, setTab] = useState<ReviewTab>(initialTab)
  const label = tabs.find(([key]) => key === tab)?.[1] ?? '当日总结'
  return <section className="space-y-5 rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5"><div><p className="text-sm text-[var(--sc-muted)]">复盘工作台</p><h1 className="mt-1 text-2xl font-semibold">{label}</h1></div><div className="flex min-w-max gap-2 overflow-x-auto" role="tablist" aria-label="复盘内容">{tabs.map(([key, name]) => <Link className="min-h-12 rounded-xl px-4 py-3 text-sm data-[active=true]:bg-[var(--sc-primary)] data-[active=true]:text-white" data-active={tab === key} href={`/review/${key}`} key={key} onClick={() => setTab(key)} role="tab" aria-selected={tab === key}>{name}</Link>)}</div><ReviewContent tab={tab} /></section>
}

function ReviewContent({ tab }: { tab: ReviewTab }) {
  if (tab === 'daily') return <div className="space-y-3"><textarea className="min-h-36 w-full rounded-xl border border-[var(--sc-border)] bg-transparent p-4 text-sm" placeholder="记录今天的市场判断、执行情况和改进点" aria-label="当日复盘内容" /><button className="min-h-12 rounded-xl bg-[var(--sc-primary)] px-4 text-sm font-semibold text-white" type="button">保存当日总结</button></div>
  if (tab === 'trade') return <ReviewEmpty title="单笔复盘" action="前往交易流水选择记录" href="/trading/ledger" />
  if (tab === 'history') return <ReviewEmpty title="历史复盘" action="查看预测记录" href="/trading/predictions" />
  return <ReviewEmpty title="规则回测" action="前往规则库" href="/rules" />
}

function ReviewEmpty({ title, action, href }: { title: string; action: string; href: string }) {
  return <div className="rounded-xl border border-dashed border-[var(--sc-border)] p-6"><p className="font-medium">暂无{title}数据</p><p className="mt-2 text-sm text-[var(--sc-muted)]">完成交易或保存复盘后，这里会形成可追踪记录。</p><Link className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-[var(--sc-primary)] px-4 py-3 text-sm font-semibold text-white" href={href}>{action}</Link></div>
}
