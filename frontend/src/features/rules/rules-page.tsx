'use client'

import Link from 'next/link'
import { ruleModeLabel } from '../analysis/display-labels'
import { AppDialog } from '../ui/app-dialog'
import { useEffect, useRef, useState, type FormEvent } from 'react'
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
  const [sharedStatus, setSharedStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const mutationVersion = useRef(0)
  const mutationPending = useRef(false)
  const [draftError, setDraftError] = useState('')
  const [sharedRefresh, setSharedRefresh] = useState(0)
  useEffect(() => {
    const reloadShared = () => setSharedRefresh(n => n + 1)
    const localChanged = (event: StorageEvent) => { if (event.key === 'stockcal:rules') setRules(initialRulesWithBuiltIns()) }
    window.addEventListener('storage', localChanged)
    window.addEventListener('focus', reloadShared)
    const timer = setInterval(reloadShared, 10000)
    return () => { clearInterval(timer); window.removeEventListener('focus', reloadShared); window.removeEventListener('storage', localChanged) }
  }, [])
  const visibleRules = rules.filter((rule) => (filter === 'all' || rule.status === filter) && `${rule.title} ${rule.description ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()))

  useEffect(() => {
    if (mutationPending.current) return
    let active = true
    const version = mutationVersion.current
    void client.list().then((remoteRules) => {
      if (!active || version !== mutationVersion.current) return
      const remote = remoteRules.map((rule) => ({
        id: String(rule.id),
        title: String(rule.name ?? '未命名规则'),
        description: String(rule.description ?? ''),
        status: 'published' as const,
        source: String(rule.sourceDocumentId ?? '阿里云知识库'),
        mode: typeof rule.mode === 'string' ? rule.mode : undefined,
        action: typeof rule.action === 'string' ? rule.action : undefined,
        timeframe: typeof rule.timeframe === 'string' ? rule.timeframe : undefined,
        conditions: rule.conditions,
      }))
      setSharedStatus('ready')
      if (remote.length) setRules(current => [...remote, ...current.filter(rule => rule.status === 'draft' && !remote.some(item => item.id === rule.id))])
      setEnabledRules(current => ({ ...current, ...Object.fromEntries(remoteRules.map((rule) => [String(rule.id), rule.enabled !== false])) }))

    }).catch(() => { if (active) setSharedStatus('error') })
    return () => { active = false }
  }, [client, sharedRefresh])

  const toggleRule = async (rule: RuleRecord) => {
    if (mutationPending.current) return
    mutationPending.current = true
    mutationVersion.current++
    setPendingId(rule.id)
    const enabled = !(enabledRules[rule.id] ?? true)
    try {
      const updated = await client.toggle(rule.id, enabled)
      setEnabledRules((current) => ({ ...current, [rule.id]: updated.enabled }))
      setMessage(updated.enabled ? '规则已启用并参与分析' : '规则已停用，不再参与分析')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '规则状态保存失败')
    } finally { mutationPending.current = false; setPendingId(null) }
  }

  const publish = (id: string) => {
    const draft = rules.find((item) => item.id === id)
    if (!draft?.conditions?.length) {
      setMessage('规则缺少可计算条件，请通过知识导入并审核后发布')
      return
    }
    const next = rules.map((item) => item.id === id ? { ...item, status: 'published' as const } : item)
    const published = next.find((item) => item.id === id)
    try { saveRecords('rules', next) } catch { setMessage('本机保存失败，请检查存储权限后重试。'); return }
    setRules(next)
    setEnabledRules((current) => ({ ...current, [id]: true }))
    if (published) void syncRecord('rules', published).catch(() => undefined)
    setMessage('规则已发布')
  }

  const saveDraft = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim()) {
      setDraftError('请填写规则名称')
      return
    }
    const rule: RuleRecord = {
      id: createRecordId('rule'),
      title: title.trim(),
      description: description.trim(),
      status: 'draft',
      createdAt: new Date().toISOString(),
    }
    try { addRecord('rules', rule) } catch { setDraftError('本机保存失败，填写内容已保留，请检查存储权限后重试。'); return }
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
          <p>查看已发布规则，或从笔记导入、审核后再参与分析。</p>
        </div>
        <div className="sc-rules-actions">
          <RecordSyncButton />
          <button onClick={() => { setOpen(true); setMessage(''); setDraftError('') }} type="button">新建规则</button>
          <Link href="/knowledge?view=backtest">查看规则回测</Link>
        </div>
      </header>
      <p className="sc-form-note">当前列表统计{sharedStatus === 'loading' ? ' · 正在更新共享规则' : sharedStatus === 'error' ? ' · 共享服务暂不可用，已保留本机与内置规则' : ''}</p>
      <div className="sc-rules-overview" aria-label="规则统计">
        <div><span>规则总数</span><strong>{rules.length}</strong></div>
        <div><span>已发布</span><strong>{rules.filter(rule => rule.status === 'published').length}</strong></div>
        <div><span>已启用</span><strong>{rules.filter(rule => rule.status === 'published' && (enabledRules[rule.id] ?? true)).length}</strong></div>
        <div><span>待处理草稿</span><strong>{rules.filter(rule => rule.status === 'draft').length}</strong></div>
      </div>
      <div className="sc-rules-filter"><input aria-label="搜索规则" onChange={(event) => setQuery(event.target.value)} placeholder="搜索规则名称或条件" role="searchbox" value={query} /><span>{visibleRules.length} 条结果</span></div>
      {open ? <AppDialog title="新建规则" description="先保存草稿，补齐可计算条件并审核后才能发布。" onClose={() => setOpen(false)} footer={<><button className="sc-button" onClick={() => setOpen(false)} type="button">取消</button><button className="sc-button is-primary" form="new-rule-form" type="submit">保存规则草稿</button></>}><form id="new-rule-form" className="sc-form" onSubmit={saveDraft}>
        <label className="block space-y-1 text-sm"><span>规则名称</span><input aria-label="规则名称" aria-invalid={Boolean(draftError)} className="min-h-12 w-full rounded-xl border border-[var(--sc-border)] bg-transparent px-3" onChange={(event) => { setTitle(event.target.value); setDraftError('') }} value={title} /></label>
        <label className="block space-y-1 text-sm"><span>规则说明</span><textarea aria-label="规则说明" className="min-h-28 w-full rounded-xl border border-[var(--sc-border)] bg-transparent p-3" onChange={(event) => setDescription(event.target.value)} value={description} /></label>
        {draftError ? <p className="sc-field-error" role="alert">{draftError}</p> : null}
      </form></AppDialog> : null}
      <div className="sc-rule-filter-tabs" role="group" aria-label="规则状态筛选">{([['all', '全部'], ['published', '已发布'], ['draft', '草稿']] as const).map(([value, label]) => <button className="sc-button" type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
      {message ? <p className="sc-inline-status" role="status">{message}</p> : null}
      {visibleRules.length === 0 ? <div className="sc-rules-empty">没有匹配的规则。</div> : <div className="sc-rules-table-wrap"><table aria-label="规则表格" className="sc-rules-table">
        <thead><tr><th>规则名称</th><th>周期</th><th>模式</th><th>条件完整性</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>{visibleRules.map((rule) => <tr className="sc-rule-card" key={rule.id}>
          <td className="sc-rule-card-main" data-label="规则名称"><div><h2>{rule.title}</h2>{rule.source ? <span>{rule.source}</span> : null}</div>{rule.description ? <p>{rule.description}</p> : null}</td>
          <td data-label="周期">{rule.timeframe ?? '—'}</td>
          <td data-label="模式">{ruleModeLabel(rule.mode ?? rule.action)}</td>
          <td data-label="条件完整性"><span className={`sc-rule-completeness ${rule.conditions?.length ? 'complete' : 'missing'}`}>{rule.conditions?.length ? '完整' : '缺失'}</span></td>
          <td data-label="状态">{rule.status === 'published' ? <><span className="sc-rule-status published">已发布</span><span className="sc-rule-participation">{(enabledRules[rule.id] ?? true) ? '参与分析' : '不参与分析'}</span></> : <span className="sc-rule-status draft">草稿</span>}</td>
          <td data-label="操作"><div className="sc-rule-card-actions">
            {rule.status === 'published' ? <button aria-label={`${(enabledRules[rule.id] ?? true) ? '停用' : '启用'}规则 ${rule.title}`} aria-pressed={enabledRules[rule.id] ?? true} disabled={pendingId !== null} aria-busy={pendingId === rule.id} className={`sc-rule-toggle ${(enabledRules[rule.id] ?? true) ? 'enabled' : ''}`} onClick={() => void toggleRule(rule)} type="button">{pendingId === rule.id ? '保存中…' : (enabledRules[rule.id] ?? true) ? '已启用' : '已停用'}</button> : <button className="sc-rule-publish" onClick={() => publish(rule.id)} type="button" aria-label={`发布${rule.title}`}>发布</button>}
            <button aria-label={`查看规则详情 ${rule.title}`} className="sc-rule-detail-button" onClick={() => setSelectedRule(rule)} type="button">查看详情</button>
          </div></td>
        </tr>)}</tbody>
      </table></div>}
      <details className="sc-page-disclosure"><summary>导入股票笔记<small>文件、Markdown 或自然语言</small></summary><div><MarkdownImportPanel /></div></details>
      <details className="sc-page-disclosure"><summary>审核知识草稿<small>对照原文后批准与发布</small></summary><div><KnowledgeReviewPanel onPublished={(published) => {
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
          conditions: published.conditions,
        }])
      }} /></div></details>
      {selectedRule ? <AppDialog title={`规则详情 ${selectedRule.title}`} closeLabel="关闭规则详情" onClose={() => setSelectedRule(null)} footer={<button className="sc-button is-primary" onClick={() => setSelectedRule(null)} type="button">返回规则列表</button>}>
        <p>{selectedRule.description || '暂无规则说明。'}</p>
        <dl className="sc-rule-facts"><div><dt>状态</dt><dd>{selectedRule.status === 'published' ? (enabledRules[selectedRule.id] ?? true) ? '已启用' : '已停用' : '草稿'}</dd></div><div><dt>周期</dt><dd>{selectedRule.timeframe || '未定义'}</dd></div><div><dt>模式</dt><dd>{ruleModeLabel(selectedRule.mode ?? selectedRule.action)}</dd></div><div><dt>计算条件</dt><dd>{selectedRule.conditions?.length ? `${selectedRule.conditions.length} 项` : '缺少可计算条件'}</dd></div></dl>
      </AppDialog> : null}
    </section>
  )
}

function initialRulesWithBuiltIns() {
  const stored = loadRecords<RuleRecord>('rules')
  const storedIds = new Set(stored.map((rule) => rule.id))
  return [...builtInRules.filter((rule) => !storedIds.has(rule.id)), ...stored]
}
