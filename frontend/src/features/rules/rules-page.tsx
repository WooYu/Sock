'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'
import { addRecord, createRecordId, loadRecords, saveRecords } from '../records/record-store'
import { syncRecord } from '../records/record-sync'
import { RecordSyncButton } from '../records/record-sync-button'
import { builtInRules } from './default-rules'
import { MarkdownImportPanel } from './markdown-import-panel'
import { KnowledgeReviewPanel } from './knowledge-review-panel'
import { getPublishedKnowledgeRules, togglePublishedKnowledgeRule, type PublishedKnowledgeRule } from '@/lib/api/knowledge-client'
import type { RuleCondition } from '../workspace/stock-workspace-types'

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
  conditions?: RuleCondition[]
}

export type RulesClient = {
  list: () => Promise<PublishedKnowledgeRule[]>
  toggle: (id: string, enabled: boolean) => Promise<Pick<PublishedKnowledgeRule, 'enabled'>>
}

const defaultClient: RulesClient = { list: getPublishedKnowledgeRules, toggle: togglePublishedKnowledgeRule }

export function RulesPage({ initialRules = [], client = defaultClient }: { initialRules?: RuleRecord[]; client?: RulesClient }) {
  const [rules, setRules] = useState(() => initialRules.length ? initialRules : initialRulesWithBuiltIns())
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [message, setMessage] = useState('')
  const [enabledRules, setEnabledRules] = useState<Record<string, boolean>>(() =>
    Object.fromEntries([...initialRules, ...initialRulesWithBuiltIns()].map((rule) => [rule.id, true])),
  )
  const [selectedRule, setSelectedRule] = useState<RuleRecord | null>(null)
  const [query, setQuery] = useState('')
  const [serverStatistics, setServerStatistics] = useState<{ total: number; published: number; enabled: number; drafts: number } | null>(null)
  const visibleRules = rules.filter((rule) => `${rule.title} ${rule.description ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()))

  useEffect(() => {
    let active = true
    void client.list().then((remoteRules) => {
      if (!active) return
      const remote = remoteRules.map((rule) => ({
        id: String(rule.id),
        title: String(rule.name ?? '未命名规则'),
        description: String(rule.description ?? ''),
        status: 'published' as const,
        source: String(rule.sourceDocumentId ?? '阿里云知识库'),
        mode: typeof rule.mode === 'string' ? rule.mode : undefined,
        action: typeof rule.action === 'string' ? rule.action : undefined,
        timeframe: typeof rule.timeframe === 'string' ? rule.timeframe : undefined,
      }))
      if (remote.length) setRules(remote)
      setEnabledRules(Object.fromEntries(remoteRules.map((rule) => [String(rule.id), rule.enabled !== false])))
      setServerStatistics({
        total: remote.length,
        published: remote.length,
        enabled: remoteRules.filter((rule) => rule.enabled !== false).length,
        drafts: 0,
      })
    }).catch(() => undefined)
    return () => { active = false }
  }, [client])

  const toggleRule = async (rule: RuleRecord) => {
    const enabled = !(enabledRules[rule.id] ?? rule.status === 'published')
    try {
      const updated = await client.toggle(rule.id, enabled)
      setEnabledRules((current) => ({ ...current, [rule.id]: updated.enabled }))
      setMessage(updated.enabled ? '规则已启用并参与分析' : '规则已停用，不再参与分析')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '规则状态保存失败')
    }
  }

  const publish = (id: string) => {
    const draft = rules.find((item) => item.id === id)
    if (!draft?.conditions?.length) {
      setMessage('规则缺少可计算条件，请通过知识导入并审核后发布')
      return
    }
    const next = rules.map((item) => item.id === id ? { ...item, status: 'published' as const } : item)
    const published = next.find((item) => item.id === id)
    saveRecords('rules', next)
    setRules(next)
    setEnabledRules((current) => ({ ...current, [id]: true }))
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
    <section className="sc-rules-page">
      <header className="sc-rules-header">
        <div>
          <p className="sc-eyebrow">经验、知识与审批</p>
          <h1>规则库</h1>
          <p>已内置从股票笔记提炼的基础规则，后续可继续审批和补充个人规则。</p>
        </div>
        <div className="sc-rules-actions">
          <RecordSyncButton />
          <button onClick={() => { setOpen(true); setMessage('') }} type="button">新建规则</button>
          <Link href="/review/backtest">查看规则回测</Link>
        </div>
      </header>
      <div className="sc-rules-overview" aria-label="规则统计">
        <div><span>规则总数</span><strong>{serverStatistics?.total ?? '—'}</strong></div>
        <div><span>已上线</span><strong>{serverStatistics?.published ?? '—'}</strong></div>
        <div><span>已启用</span><strong>{serverStatistics?.enabled ?? '—'}</strong></div>
        <div><span>待处理草稿</span><strong>{serverStatistics?.drafts ?? '—'}</strong></div>
      </div>
      <div className="sc-rules-filter"><input aria-label="搜索规则" onChange={(event) => setQuery(event.target.value)} placeholder="搜索规则名称或条件" role="searchbox" value={query} /><span>{visibleRules.length} 条结果</span></div>
      <MarkdownImportPanel />
      <KnowledgeReviewPanel onPublished={(published) => {
        setRules((items) => items.some((item) => item.id === published.id) ? items : [...items, {
          id: published.id,
          title: published.name,
          description: published.description,
          status: 'published',
          source: published.sourceDocumentId ?? '阿里云知识库',
          action: published.action,
          mode: published.mode,
          timeframe: published.timeframe,
          priority: published.priority,
        }])
      }} />
      {open ? <form className="sc-rule-editor" onSubmit={saveDraft}>
        <label className="block space-y-1 text-sm"><span>规则名称</span><input aria-label="规则名称" className="min-h-12 w-full rounded-xl border border-[var(--sc-border)] bg-transparent px-3" onChange={(event) => setTitle(event.target.value)} value={title} /></label>
        <label className="block space-y-1 text-sm"><span>规则说明</span><textarea aria-label="规则说明" className="min-h-28 w-full rounded-xl border border-[var(--sc-border)] bg-transparent p-3" onChange={(event) => setDescription(event.target.value)} value={description} /></label>
        <div className="flex gap-3"><button className="min-h-12 rounded-xl bg-[var(--sc-primary)] px-4 text-sm font-semibold text-white" type="submit">保存规则草稿</button><button className="min-h-12 rounded-xl border border-[var(--sc-border)] px-4" onClick={() => setOpen(false)} type="button">取消</button></div>
      </form> : null}
      {message ? <p className="text-sm text-emerald-700" role="status">{message}</p> : null}
      {visibleRules.length === 0 ? <div className="sc-rules-empty">没有匹配的规则。</div> : <div className="sc-rules-table-wrap"><table aria-label="规则表格" className="sc-rules-table">
        <thead><tr><th>规则名称</th><th>周期</th><th>模式</th><th>条件完整性</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>{visibleRules.map((rule) => <tr className="sc-rule-card" key={rule.id}>
          <td className="sc-rule-card-main" data-label="规则名称"><div><h2>{rule.title}</h2>{rule.source ? <span>{rule.source}</span> : null}</div>{rule.description ? <p>{rule.description}</p> : null}</td>
          <td data-label="周期">{rule.timeframe ?? '—'}</td>
          <td data-label="模式">{rule.mode ?? rule.action ?? '—'}</td>
          <td data-label="条件完整性"><span className={`sc-rule-completeness ${rule.conditions?.length ? 'complete' : 'missing'}`}>{rule.conditions?.length ? '完整' : '缺失'}</span></td>
          <td data-label="状态">{rule.status === 'published' ? <><span className="sc-rule-status published">已发布</span><span className="sc-rule-participation">{enabledRules[rule.id] ? '参与分析' : '不参与分析'}</span></> : <span className="sc-rule-status draft">草稿</span>}</td>
          <td data-label="操作"><div className="sc-rule-card-actions">
            {rule.status === 'published' ? <button aria-label={`${enabledRules[rule.id] ? '停用' : '启用'}规则 ${rule.title}`} aria-pressed={enabledRules[rule.id] ?? true} className={`sc-rule-toggle ${enabledRules[rule.id] ? 'enabled' : ''}`} onClick={() => void toggleRule(rule)} type="button">{enabledRules[rule.id] ? '已启用' : '已停用'}</button> : <button className="sc-rule-publish" onClick={() => publish(rule.id)} type="button" aria-label={`发布${rule.title}`}>发布</button>}
            <button aria-label={`查看规则详情 ${rule.title}`} className="sc-rule-detail-button" onClick={() => setSelectedRule(rule)} type="button">查看详情</button>
          </div></td>
        </tr>)}</tbody>
      </table></div>}
      {selectedRule ? <div className="modal-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelectedRule(null)}><section aria-label={`规则详情 ${selectedRule.title}`} aria-modal="true" className="rule-detail-panel" role="dialog"><button aria-label="关闭规则详情" className="modal-close" onClick={() => setSelectedRule(null)} type="button">×</button><p className="text-sm text-[var(--sc-muted)]">规则详情 · {selectedRule.status === 'published' ? '已发布' : '草稿'}</p><h2 className="mt-2 text-xl font-semibold">{selectedRule.title}</h2><p className="mt-3 text-sm text-[var(--sc-muted)]">{selectedRule.description || '暂无规则说明。'}</p><dl className="mt-4 space-y-2 text-sm"><div className="flex justify-between gap-4"><dt className="text-[var(--sc-muted)]">状态</dt><dd>{selectedRule.status === 'published' && enabledRules[selectedRule.id] ? '已启用' : selectedRule.status === 'published' ? '已停用' : '草稿'}</dd></div>{selectedRule.timeframe ? <div className="flex justify-between gap-4"><dt className="text-[var(--sc-muted)]">周期</dt><dd>{selectedRule.timeframe}</dd></div> : null}{selectedRule.mode ? <div className="flex justify-between gap-4"><dt className="text-[var(--sc-muted)]">模式</dt><dd>{selectedRule.mode}</dd></div> : null}</dl><div className="mt-5 flex justify-end"><button className="min-h-12 rounded-xl bg-[var(--sc-primary)] px-4 text-sm font-semibold text-white" onClick={() => setSelectedRule(null)} type="button">返回规则列表</button></div></section></div> : null}
    </section>
  )
}

function initialRulesWithBuiltIns() {
  const stored = loadRecords<RuleRecord>('rules')
  const storedIds = new Set(stored.map((rule) => rule.id))
  return [...builtInRules.filter((rule) => !storedIds.has(rule.id)), ...stored]
}
