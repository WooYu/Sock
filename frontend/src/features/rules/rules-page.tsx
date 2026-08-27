'use client'

import { useState } from 'react'
import Link from 'next/link'

export type RuleRecord = { id: string; title: string; status: 'draft' | 'published' }

export function RulesPage({ initialRules = [] }: { initialRules?: RuleRecord[] }) {
  const [rules, setRules] = useState(initialRules)
  const publish = (id: string) => setRules((items) => items.map((item) => item.id === id ? { ...item, status: 'published' } : item))
  return <section className="space-y-5 rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-[var(--sc-muted)]">经验、知识与审批</p><h1 className="mt-1 text-2xl font-semibold">规则库</h1></div><Link className="min-h-12 rounded-xl border border-[var(--sc-border)] px-4 py-3 text-sm font-semibold" href="/review/backtest">查看规则回测</Link></div>{rules.length === 0 ? <div className="rounded-xl bg-[var(--sc-surface-muted)] p-5 text-sm text-[var(--sc-muted)]">暂无规则，请先创建草稿。</div> : <div className="space-y-3">{rules.map((rule) => <article className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--sc-border)] p-4" key={rule.id}><div><h2 className="font-medium">{rule.title}</h2>{rule.status === 'published' ? <p className="mt-1 text-sm text-[var(--sc-muted)]"><span className="ml-2">参与分析</span></p> : <p className="mt-1 text-sm text-[var(--sc-muted)]">草稿</p>}</div>{rule.status === 'published' ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-700">已发布</span> : <button className="min-h-12 rounded-xl bg-[var(--sc-primary)] px-4 text-sm font-semibold text-white" onClick={() => publish(rule.id)} type="button" aria-label={`发布${rule.title}`}>发布</button>}</article>)}</div>}</section>
}
