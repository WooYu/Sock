'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { addRecord, createRecordId, loadRecords, saveRecords } from '../records/record-store'
import { syncRecord } from '../records/record-sync'
import { RecordSyncButton } from '../records/record-sync-button'
import { builtInRules } from './default-rules'

export type RuleRecord = {
  id: string
  title: string
  description?: string
  status: 'draft' | 'published'
  createdAt?: string
  source?: string
  mode?: string
  action?: string
  timeframe?: string
  priority?: number
}

export function RulesPage({ initialRules = [] }: { initialRules?: RuleRecord[] }) {
  const [rules, setRules] = useState(() => initialRules.length ? initialRules : initialRulesWithBuiltIns())
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [message, setMessage] = useState('')

  const publish = (id: string) => {
    const next = rules.map((item) => item.id === id ? { ...item, status: 'published' as const } : item)
    const published = next.find((item) => item.id === id)
    saveRecords('rules', next)
    setRules(next)
    if (published) void syncRecord('rules', published).catch(() => undefined)
    setMessage('规则已发布')
  }

  const saveDraft = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim()) {
      setMessage('请填写规则名称')
      return
    }
    const rule: RuleRecord = {
      id: createRecordId('rule'),
      title: title.trim(),
      description: description.trim(),
      status: 'draft',
      createdAt: new Date().toISOString(),
    }
    addRecord('rules', rule)
    void syncRecord('rules', rule).catch(() => undefined)
    setRules((items) => [...items, rule])
    setTitle('')
    setDescription('')
    setOpen(false)
    setMessage('规则草稿已保存')
  }

  return (
    <section className="space-y-5 rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--sc-muted)]">经验、知识与审批</p>
          <h1 className="mt-1 text-2xl font-semibold">规则库</h1>
          <p className="mt-2 text-sm text-[var(--sc-muted)]">已内置从股票笔记提炼的基础规则，后续可继续审批和补充个人规则。</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <RecordSyncButton />
          <button className="min-h-12 rounded-xl bg-[var(--sc-primary)] px-4 text-sm font-semibold text-white" onClick={() => { setOpen(true); setMessage('') }} type="button">新建规则</button>
          <Link className="min-h-12 rounded-xl border border-[var(--sc-border)] px-4 py-3 text-sm font-semibold" href="/review/backtest">查看规则回测</Link>
        </div>
      </div>
      {open ? <form className="space-y-3 rounded-xl border border-[var(--sc-border)] p-4" onSubmit={saveDraft}>
        <label className="block space-y-1 text-sm"><span>规则名称</span><input aria-label="规则名称" className="min-h-12 w-full rounded-xl border border-[var(--sc-border)] bg-transparent px-3" onChange={(event) => setTitle(event.target.value)} value={title} /></label>
        <label className="block space-y-1 text-sm"><span>规则说明</span><textarea aria-label="规则说明" className="min-h-28 w-full rounded-xl border border-[var(--sc-border)] bg-transparent p-3" onChange={(event) => setDescription(event.target.value)} value={description} /></label>
        <div className="flex gap-3"><button className="min-h-12 rounded-xl bg-[var(--sc-primary)] px-4 text-sm font-semibold text-white" type="submit">保存规则草稿</button><button className="min-h-12 rounded-xl border border-[var(--sc-border)] px-4" onClick={() => setOpen(false)} type="button">取消</button></div>
      </form> : null}
      {message ? <p className="text-sm text-emerald-700" role="status">{message}</p> : null}
      {rules.length === 0 ? <div className="rounded-xl bg-[var(--sc-surface-muted)] p-5 text-sm text-[var(--sc-muted)]">暂无规则，请先创建草稿。</div> : <div className="space-y-3">
        {rules.map((rule) => <article className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--sc-border)] p-4" key={rule.id}>
          <div>
            <div className="flex flex-wrap items-center gap-2"><h2 className="font-medium">{rule.title}</h2>{rule.source ? <span className="rounded-full bg-[var(--sc-surface-muted)] px-2 py-1 text-xs text-[var(--sc-muted)]">{rule.source}</span> : null}</div>
            {rule.description ? <p className="mt-1 text-sm text-[var(--sc-muted)]">{rule.description}</p> : null}
            <p className="mt-1 text-sm text-[var(--sc-muted)]">{rule.status === 'published' ? '参与分析' : '草稿'}</p>
            {rule.status === 'published' && (rule.timeframe || rule.mode) ? <p className="mt-1 text-xs text-[var(--sc-muted)]">已启用{rule.timeframe ? ` · ${rule.timeframe}` : ''}{rule.mode ? ` · ${rule.mode}` : ''}</p> : null}
          </div>
          {rule.status === 'published' ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-700">已发布</span> : <button className="min-h-12 rounded-xl bg-[var(--sc-primary)] px-4 text-sm font-semibold text-white" onClick={() => publish(rule.id)} type="button" aria-label={`发布${rule.title}`}>发布</button>}
        </article>)}
      </div>}
    </section>
  )
}

function initialRulesWithBuiltIns() {
  const stored = loadRecords<RuleRecord>('rules')
  const storedIds = new Set(stored.map((rule) => rule.id))
  return [...builtInRules.filter((rule) => !storedIds.has(rule.id)), ...stored]
}
