'use client'

import { useDeferredValue, useMemo, useRef, useState, useSyncExternalStore, useEffect, type FormEvent } from 'react'
import Link from 'next/link'
import { useDialogFocus } from '../ui/use-dialog-focus'
import { StudioIcon } from '../research/studio-icon'
import dynamic from 'next/dynamic'
import catalogData from './note-tag-catalog.json'
import aiTagResults from './note-tag-ai-results.json'
import { NOTE_TAG_STORAGE_KEY, TAG_DIMENSIONS, LEGACY_TAG_DIMENSIONS, TAG_LABELS, activeTagRecord, currentTagRecords, filterTagRecords, mergeTagVersions,
  applyAIOriginalTags, parseTagLedger, reviseTags, reviewTags, tagVersionKey, type AIOriginalTags, type NoteCatalog, type NoteTagRecord, type TagDimension, type TagRevisionDraft, type TagSuggestion } from './note-tags'
import './note-tag-workbench.css'
import { NoteTagReextract } from './note-tag-reextract'
import { NoteDetailNavigation, NoteExcerpt, type NoteDetailTab } from './note-detail-navigation'
import { classifyNoteForForecast, FORECAST_ROLES, type ForecastRole } from './note-forecast-classification'
import { buildScenarioRuleRegistry } from '../scenario/scenario-rule-registry'
import { ForecastDefinitionCards } from './note-forecast-definition-cards'
import { ForecastDefinitionEditor } from './note-forecast-definition-editor'
import { reviseForecastDefinition, type DefinitionRole, type ForecastDefinition } from './note-forecast-definitions'

const defaultCatalog = applyAIOriginalTags(catalogData as NoteCatalog, aiTagResults.records as AIOriginalTags[])
const PAGE_SIZE = 10
const NoteStudyWorkbench = dynamic(() => import('./note-study-workbench').then(module => module.NoteStudyWorkbench), { ssr: false, loading: () => <p>正在读取逐篇学习…</p> })
const formatTime = (value: string) => new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))

function EvidenceGroups({ items, supplemental = false }: { items: Array<{ tagId: string; quote: string; reason: string; startLine?: number; endLine?: number; method?: string }>; supplemental?: boolean }) {
  const groups = new Map<string, typeof items>()
  for (const item of items) {
    const key = JSON.stringify([item.startLine, item.endLine, item.quote])
    const group = groups.get(key)
    if (group) group.push(item)
    else groups.set(key, [item])
  }
  return <details className="nt-evidence"><summary>{supplemental ? '补充说明依据' : '标签依据'} · {groups.size} 段引用 · {new Set(items.map((item) => item.tagId)).size} 个标签</summary>{[...groups.entries()].map(([key, group]) => {
    const reasons = new Map<string, { method: string; reason: string; tags: Set<string> }>()
    for (const item of group) {
      const method = supplemental ? '用户补充' : item.method === 'ai' ? 'AI 原文提取' : item.method === 'manual' ? '人工引用' : item.method === 'catalog' ? '旧解析／目录候选' : '术语匹配候选'
      const reasonKey = JSON.stringify([method, item.reason])
      const existing = reasons.get(reasonKey)
      if (existing) existing.tags.add(item.tagId)
      else reasons.set(reasonKey, { method, reason: item.reason, tags: new Set([item.tagId]) })
    }
    return <div key={key} className="nt-evidence-group"><div className="nt-chips">{[...new Set(group.map((item) => item.tagId))].map((tag) => <span key={tag}>{TAG_LABELS[tag]}</span>)}</div><small>{supplemental ? '用户补充' : `原文 L${group[0].startLine}–${group[0].endLine}`}</small><blockquote>{group[0].quote}</blockquote><ul className="nt-evidence-reasons">{[...reasons.entries()].map(([reasonKey, item]) => <li key={reasonKey}><span>{[...item.tags].map((tag) => TAG_LABELS[tag]).join('、')} · {item.method}</span><p>{item.reason}</p></li>)}</ul></div>
  })}</details>
}

function createTagStore() {
  const server = { records: [] as NoteTagRecord[], ready: false, error: '' }
  let snapshot = server
  let cached: string | null | undefined
  const listeners = new Set<() => void>()
  const refresh = () => { cached = undefined; listeners.forEach((listener) => listener()) }
  return {
    getServerSnapshot: () => server,
    getSnapshot: () => {
      try {
        const raw = localStorage.getItem(NOTE_TAG_STORAGE_KEY)
        if (raw === cached) return snapshot
        const records = parseTagLedger(raw)
        cached = raw
        snapshot = { records, ready: true, error: '' }
      } catch {
        if (!snapshot.error) snapshot = { ...snapshot, ready: false, error: '本地标签记录读取失败，原有内容未被覆盖。请先恢复导出的备份或修复浏览器存储权限。' }
      }
      return snapshot
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      const onStorage = (event: StorageEvent) => { if (event.key === NOTE_TAG_STORAGE_KEY || event.key === null) refresh() }
      window.addEventListener('storage', onStorage)
      return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage) }
    },
    refresh,
  }
}

export function NoteTagWorkbench({ catalog = defaultCatalog }: { catalog?: NoteCatalog }) {
  const store = useMemo(() => createTagStore(), [])
  const { records: local, ready, error } = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
  const base = useMemo(() => [...catalog.documents, ...catalog.fragments], [catalog])
  const current = useMemo(() => currentTagRecords(base, local).map(activeTagRecord), [base, local])
  const forecastRegistry = useMemo(() => buildScenarioRuleRegistry(catalog.fragments), [catalog])
  const canonicalRecords = useMemo(() => new Map(base.map(record => [record.id, record])), [base])
  const forecastClasses = useMemo(() => new Map(current.map(record => [record.id, classifyNoteForForecast(record, forecastRegistry, canonicalRecords.get(record.id))])), [current, forecastRegistry, canonicalRecords])
  const [forecastRole, setForecastRole] = useState<ForecastRole | ''>('')
  const allVersions = useMemo(() => mergeTagVersions(base, local), [base, local])
  const [level, setLevel] = useState<'document' | 'fragment'>('document')
  const [view, setView] = useState<'tags' | 'study'>('tags')
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [facets, setFacets] = useState<Partial<Record<TagDimension, string>>>({})
  const [status, setStatus] = useState('all')
  const [selectedId, setSelectedId] = useState(catalog.documents[0]?.id ?? '')
  const [viewedKey, setViewedKey] = useState<string | null>(null)
  const [detailNavigation, setDetailNavigation] = useState<{ id: string; tab: NoteDetailTab }>({ id: '', tab: 'overview' })
  const [page, setPage] = useState(0)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editor, setEditor] = useState<NoteTagRecord | null>(null)
  const [definitionEditor, setDefinitionEditor] = useState<{ record: NoteTagRecord; role: DefinitionRole } | null>(null)
  const [advancedFilters, setAdvancedFilters] = useState(false)
  const [definitionState, setDefinitionState] = useState('all')
  const [supplementEntry, setSupplementEntry] = useState(false)
  const [aiEntry, setAIEntry] = useState(false)
  const [writeError, setWriteError] = useState('')
  const [message, setMessage] = useState('')
  const detailRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const onBack = () => { setEditor(null); setWriteError('') }
    window.addEventListener('popstate', onBack)
    return () => window.removeEventListener('popstate', onBack)
  }, [])

  function openEditor(record: NoteTagRecord, supplement = false, ai = false) {
    window.history.pushState({ ...window.history.state, stockcalTagEditor: true }, '', window.location.href)
    setAIEntry(ai); setSupplementEntry(supplement); setEditor(record); setWriteError('')
  }

  function closeEditor() {
    setEditor(null); setWriteError('')
    if (window.history.state?.stockcalTagEditor) window.history.back()
  }
  const filtered = useMemo(() => filterTagRecords(current.filter((record) => record.level === level && (status === 'all' || record.status === status)
    && (!forecastRole || forecastClasses.get(record.id)?.some(item => item.role === forecastRole) || record.forecastDefinitions?.some(item => item.role === forecastRole))
    && (definitionState === 'all' || (definitionState === 'missing' ? !record.forecastDefinitions?.length : record.forecastDefinitions?.some(item => item.state === definitionState)))), { query: deferredQuery, facets }), [current, level, status, deferredQuery, facets, forecastRole, forecastClasses, definitionState])
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages - 1)
  const visibleRecords = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
  const selected = visibleRecords.find((record) => record.id === selectedId) ?? visibleRecords[0]
  const detailTab = detailNavigation.id === selected?.id ? detailNavigation.tab : 'overview'
  const changeDetailTab = (tab: NoteDetailTab) => setDetailNavigation({ id: selected?.id ?? '', tab })
  const history = allVersions.filter((record) => record.id === selected?.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.version - a.version)
  const viewed = (viewedKey ? history.find((record) => tagVersionKey(record) === viewedKey && viewedKey !== (selected && tagVersionKey(selected))) : null) ?? selected
  const historical = Boolean(viewed && selected && tagVersionKey(viewed) !== tagVersionKey(selected))
  const aiOriginal = base.find(record => record.id === viewed?.id && record.sourceHash === viewed.sourceHash && record.extraction)
  const aiCandidate = aiOriginal ? activeTagRecord(aiOriginal) : undefined
  const extraction = viewed?.extraction ?? aiCandidate?.extraction
  const modelDisagreements = extraction?.disagreements.filter(item => !viewed?.tags.includes(item.tagId)) ?? []

  function persist(next: NoteTagRecord, previous: NoteTagRecord) {
    if (!ready || error) throw new Error('标签存储尚未就绪。')
    const stored = parseTagLedger(localStorage.getItem(NOTE_TAG_STORAGE_KEY))
    const seed = base.find((record) => record.id === previous.id && record.sourceHash === previous.sourceHash)
    if (!seed || currentTagRecords([seed], stored)[0].version !== previous.version) throw new Error('标签已有更新，请关闭编辑器后重新读取。')
    const records = mergeTagVersions(stored, [seed, ...allVersions.filter((record) => record.id === previous.id), next])
    localStorage.setItem(NOTE_TAG_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, records }))
    store.refresh()
    setSelectedId(next.id); setViewedKey(null); setWriteError(''); setDetailNavigation({ id: next.id, tab: 'overview' })
    setMessage(`已保存标签 v${next.version}，原文与历史版本保持完整。`)
  }

  function save(draft: TagRevisionDraft) {
    if (!editor) return
    try {
      persist(reviseTags(editor, draft, new Date().toISOString()), editor)
      closeEditor()
    } catch (cause) { setWriteError(`保存失败：${cause instanceof Error ? cause.message : '请检查存储权限。'} 输入已保留。`) }
  }

  function saveDefinition(definition: ForecastDefinition, reason: string) {
    if (!definitionEditor) return
    try {
      const next = reviseForecastDefinition(definitionEditor.record, definition, reason, new Date().toISOString())
      persist(next, definitionEditor.record)
      closeDefinitionEditor()
      setMessage(`已保存定义 v${next.version}。${definition.state === 'draft' ? '草稿仍需补齐条件；可继续编辑。' : '定义已整理，下一步通过研究验证；尚未启用预测。'} 当前筛选已保留。`)
    } catch (cause) { setWriteError(`保存失败：${cause instanceof Error ? cause.message : '请检查存储权限。'} 输入已保留。`) }
  }

  function openDefinitionEditor(record: NoteTagRecord, role: DefinitionRole) {
    window.history.pushState({ ...window.history.state, stockcalDefinitionEditor: true }, '', window.location.href)
    setDefinitionEditor({ record, role }); setWriteError('')
  }

  function closeDefinitionEditor() {
    setDefinitionEditor(null); setWriteError('')
    if (window.history.state?.stockcalDefinitionEditor) window.history.back()
  }

  function confirmTags() {
    if (!selected) return
    try {
      const next = reviewTags(selected, new Date().toISOString())
      persist(next, selected)
      setMessage(`已核对标签 v${next.version}。定义与验证状态不变。`)
    }
    catch (cause) { setWriteError(cause instanceof Error ? cause.message : '标签确认失败。') }
  }

  function exportTags() {
    try {
      if (!ready || error) throw new Error('请先解决本地标签读取问题。')
      const blob = new Blob([JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), sourceCommit: catalog.sourceCommit,
        sourceRepository: catalog.sourceRepository, taxonomy: TAG_DIMENSIONS, legacyTaxonomy: LEGACY_TAG_DIMENSIONS, records: allVersions,
        forecastRoles: { definitionVersion: 'forecast-roles-v1', vocabulary: FORECAST_ROLES, derived: true,
          records: current.map(record => ({ id: record.id, sourceHash: record.sourceHash, tagVersion: record.version, roles: forecastClasses.get(record.id) })) } }, null, 2)], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url; anchor.download = 'stockcal-note-tags.json'; document.body.appendChild(anchor); anchor.click(); anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage('已导出标签词典、全部笔记与片段、原文证据和修订历史。')
    } catch (cause) { setWriteError(cause instanceof Error ? cause.message : '标签导出失败。') }
  }

  function choose(record: NoteTagRecord) {
    setEditingNoteId(null)
    setSelectedId(record.id); setViewedKey(null); setDetailNavigation({ id: record.id, tab: 'overview' })
    if (window.matchMedia?.('(max-width: 760px)').matches) detailRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }

  function reset() { setQuery(''); setFacets({}); setForecastRole(''); setStatus('all'); setDefinitionState('all'); setPage(0); setViewedKey(null) }

  const activeFilters = [
    ...(query.trim() ? [{ id: 'query', label: query.trim(), remove: () => setQuery('') }] : []),
    ...Object.entries(facets).filter(([, value]) => value).map(([id, value]) => ({ id, label: TAG_LABELS[value!], remove: () => setFacets(previous => ({ ...previous, [id]: '' })) })),
    ...(forecastRole ? [{ id: 'role', label: FORECAST_ROLES[forecastRole], remove: () => setForecastRole('') }] : []),
    ...(status !== 'all' ? [{ id: 'status', label: status === 'reviewed' ? '已核对标签' : '待核对标签', remove: () => setStatus('all') }] : []),
    ...(definitionState !== 'all' ? [{ id: 'definition', label: definitionState === 'ready' ? '已定义、待验证' : definitionState === 'draft' ? '定义草稿' : '尚未补充定义', remove: () => setDefinitionState('all') }] : []),
  ]

  if (view === 'study') return <section className="nt-workbench" aria-label="笔记标签工作台"><nav className="nt-study-tabs" aria-label="笔记工作视图"><button type="button" onClick={() => setView('tags')}>标签与版本</button><button type="button" aria-pressed="true">逐篇学习建议</button></nav><NoteStudyWorkbench currentTags={current} /></section>

  return <section className="nt-workbench" aria-label="笔记标签工作台">
    <div className="nt-top-toolbar"><nav className="nt-study-tabs" aria-label="笔记工作视图"><button type="button" aria-pressed="true">标签与版本</button><button type="button" onClick={() => setView('study')}>逐篇学习建议</button></nav><button type="button" className="kw-button" disabled={!ready || Boolean(error)} onClick={exportTags}>导出标签与历史</button></div>
    <div className="nt-catalog-overview"><h2>笔记标签目录</h2><div className="nt-catalog-stats" aria-label="目录概况"><span><strong>{catalog.documents.length}</strong> 篇笔记</span><span><strong>{catalog.fragments.length}</strong> 个原文片段</span><span><strong>{catalog.audit.addedFiles.length}</strong> 篇补充资料</span></div><details className="nt-catalog-help"><summary>研究范围与标签说明</summary><p className="nt-context">后续研究对象：<Link href="/?symbol=603533">掌阅科技 · 603533</Link>。通用笔记保留通用范围，股票案例按原文处理。</p><p className="nt-disclaimer">自动标签为待核对候选；标签核对不代表计算定义或预测效果已验证。</p></details></div>
    {error ? <div className="kw-alert" role="alert">{error}<button type="button" onClick={store.refresh}>重新读取标签</button></div> : null}
    {writeError && !editor && !definitionEditor ? <div className="kw-alert" role="alert">{writeError}</div> : null}
    {message ? <div className="kw-notice nt-save-feedback" role="status"><span>{message}</span><button type="button" aria-label="关闭保存提示" onClick={() => setMessage('')}>×</button></div> : null}
    <div className="nt-filters" aria-label="标签筛选">
      <label>搜索笔记与标签<input aria-label="搜索笔记与标签" value={query} placeholder="标题、原文片段、MA均线…" onChange={(event) => { setQuery(event.target.value); setPage(0); setViewedKey(null) }} /></label>
      <label>标注层级<select value={level} onChange={(event) => { setLevel(event.target.value as typeof level); setPage(0); setViewedKey(null) }}><option value="document">整篇笔记</option><option value="fragment">规则片段</option></select></label>
      <label>标签核对状态<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); setViewedKey(null) }}><option value="all">全部</option><option value="candidate">待核对</option><option value="reviewed">已核对标签</option></select></label>
      <label>预估作用<select value={forecastRole} onChange={event => { setForecastRole(event.target.value as ForecastRole | ''); setPage(0); setViewedKey(null) }}><option value="">全部</option>{Object.entries(FORECAST_ROLES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <button type="button" className="kw-button" aria-expanded={advancedFilters} aria-controls="nt-advanced-filters" onClick={() => setAdvancedFilters(value => !value)}>{advancedFilters ? '收起更多筛选' : '更多筛选'}</button>
      <div id="nt-advanced-filters" className="nt-advanced-filters" hidden={!advancedFilters}>
        {TAG_DIMENSIONS.map(dimension => <label key={dimension.id}>{dimension.label}<select value={facets[dimension.id] ?? ''} onChange={event => { setFacets(previous => ({ ...previous, [dimension.id]: event.target.value })); setPage(0); setViewedKey(null) }}><option value="">全部</option>{dimension.options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>)}
        <label>定义进度<select value={definitionState} onChange={event => { setDefinitionState(event.target.value); setPage(0); setViewedKey(null) }}><option value="all">全部</option><option value="missing">尚未补充定义</option><option value="draft">定义草稿</option><option value="ready">已定义、待验证</option></select></label>
      </div>
      {activeFilters.length ? <button type="button" className="kw-button" onClick={reset}>重置标签筛选</button> : null}
    </div>
    {activeFilters.length ? <div className="nt-active-filters" aria-label="已选筛选条件"><span>已选条件</span>{activeFilters.map(filter => <button type="button" key={filter.id} aria-label={`移除筛选：${filter.label}`} onClick={() => { filter.remove(); setPage(0); setViewedKey(null) }}>{filter.label}<span aria-hidden="true">×</span></button>)}</div> : null}
    <div className="nt-columns">
      <section className="nt-list" aria-label="笔记目录">
        <div className="nt-list-heading"><strong>{level === 'document' ? '整篇笔记' : '规则片段'}</strong><span>{filtered.length} 条结果</span></div>
        {visibleRecords.map((record) => <div key={record.id} className="nt-record-row"><button type="button" className="nt-record" aria-label={`查看标签：${record.title}`} aria-pressed={record.id === selected?.id} onClick={() => choose(record)}><strong>{record.title}</strong><small>{record.file}</small><span className="nt-chips">{(record.extraction ? record.tags.slice(0, 5) : record.tags.filter((tag) => tag.startsWith('topic.')).slice(0, 4)).map((tag) => <span key={tag}>{TAG_LABELS[tag]}</span>)}</span><span className="nt-record-status">{record.status === 'reviewed' ? '标签已核对' : '候选 · 待核对'} · v{record.version}</span>{record.forecastDefinitions?.length ? <span className="nt-record-status">{record.forecastDefinitions.some(item => item.state === 'draft') ? '有定义草稿' : '定义待验证'}</span> : null}</button></div>)}
        {!filtered.length ? <div className="kw-empty"><h3>没有符合条件的笔记</h3><p>调整内容分类、分析主题或关键词后再试。</p><button className="kw-button" type="button" onClick={reset}>清空条件并查看全部</button></div> : null}
        <div className="nt-pagination"><button type="button" className="kw-button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>上一页</button><span>{currentPage + 1} / {pages}</span><button type="button" className="kw-button" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>下一页</button></div>
      </section>
      <section className="nt-detail nt-reading-detail" aria-label="标签详情" ref={detailRef}>
        {viewed ? <>
          <header className="nt-note-header">
            <div className="nt-note-kicker"><span>{viewed.level === 'document' ? '整篇笔记' : '规则片段'}</span><span>v{viewed.version}</span><span className={`nt-review-badge${viewed.status === 'reviewed' ? ' is-reviewed' : ''}`}>{viewed.status === 'reviewed' ? '标签已核对' : '标签待核对'}</span></div>
            <div className="nt-note-title"><h3>{viewed.title}</h3><a className="nt-source-link" href={viewed.sourceUrl} target="_blank" rel="noopener noreferrer">查看原文 ↗</a></div>
            <p className="nt-note-file">{viewed.file}</p>
          </header>
          {historical ? <div className="kw-history-banner"><span>历史标签版本，只读{viewed.sourceHash !== selected?.sourceHash ? ' · 原文版本已更新' : ''}</span><button type="button" onClick={() => { setViewedKey(null); changeDetailTab('overview') }}>返回当前标签</button></div> : <div className="nt-detail-actions" aria-label="笔记操作">
            <button type="button" className="kw-button" disabled={!ready || Boolean(error)} aria-expanded={editingNoteId === viewed.id} aria-controls="nt-edit-controls" onClick={() => setEditingNoteId(id => id === viewed.id ? null : viewed.id)}>{editingNoteId === viewed.id ? '完成编辑' : '编辑笔记'}</button>
            <span className="nt-reading-hint">标签核对不代表预测效果已验证</span>
          </div>}
          {!historical && editingNoteId === viewed.id ? <section className="nt-edit-controls" id="nt-edit-controls" aria-label="笔记编辑选项">
            <div className="nt-edit-basics"><button type="button" className="kw-button kw-primary" disabled={!ready || Boolean(error)} onClick={() => openEditor(viewed, true)}>标签与补充说明</button>
            {viewed.status !== 'reviewed' ? <button type="button" className="kw-button" disabled={!ready || Boolean(error) || !viewed.tags.length} onClick={confirmTags}>确认标签</button> : null}</div>
            <p className="nt-muted">在下方“编辑用途与定义”中统一补充用途和判断条件。</p>
            {viewed.level === 'document' ? <details className="nt-secondary-actions"><summary>AI 重新提取</summary><NoteTagReextract key={tagVersionKey(viewed)} record={viewed} disabled={!ready || Boolean(error)} onAdopt={candidate => openEditor({ ...viewed, tags: [...candidate.tags], evidence: candidate.evidence, sourceReferences: [...(viewed.sourceReferences ?? []), ...viewed.evidence], extraction: candidate.extraction }, false, true)} /></details> : null}
          </section> : null}
          <section className="nt-current-tags" aria-label="当前标签">
            <div className="nt-facets">{(historical ? [...TAG_DIMENSIONS, ...LEGACY_TAG_DIMENSIONS.filter(dimension => !TAG_DIMENSIONS.some(active => active.id === dimension.id))] : TAG_DIMENSIONS).map((dimension) => <div key={dimension.id}><strong>{dimension.label}</strong><span className="nt-chips">{viewed.tags.filter(tag => tag.startsWith(`${dimension.id}.`)).map(tag => <span key={tag}>{TAG_LABELS[tag]}</span>)}{!viewed.tags.some(tag => tag.startsWith(`${dimension.id}.`)) ? <small className="nt-muted">待补充</small> : null}</span></div>)}</div>
          </section>
          <NoteDetailNavigation active={detailTab} onChange={changeDetailTab} />
          <div role="tabpanel" id="nt-panel-overview" aria-labelledby="nt-tab-overview" hidden={detailTab !== 'overview'} tabIndex={0} className="nt-detail-panel">
            <ForecastDefinitionCards key={`roles:${viewed.id}:${historical ? tagVersionKey(viewed) : 'current'}`} record={viewed} classifications={classifyNoteForForecast(viewed, forecastRegistry, canonicalRecords.get(viewed.id))} registry={forecastRegistry} readOnly={historical} editing={!historical && editingNoteId === viewed.id} disabled={!ready || Boolean(error)} onEdit={role => openDefinitionEditor(viewed, role)} />
            <section className="nt-detail-card nt-note-summary"><h4>笔记摘要</h4><NoteExcerpt text={viewed.summary} /></section>
            {viewed.supplement ? <section className="nt-detail-card nt-supplement-summary"><h4>补充说明</h4><NoteExcerpt text={viewed.supplement} /></section> : null}
            <details className="nt-detail-card nt-version-note"><summary>本次修订信息 <span>{formatTime(viewed.createdAt)}</span></summary><p className="nt-revision">{viewed.version === 1 ? '自动候选' : '人工修订'} · {viewed.revisionReason}</p></details>
          </div>
          <div role="tabpanel" id="nt-panel-source" aria-labelledby="nt-tab-source" hidden={detailTab !== 'source'} tabIndex={0} className="nt-detail-panel">
            <section className="nt-detail-card"><div className="nt-card-heading"><h4>原文片段</h4><span className="nt-muted">完整内容可从顶部查看原文</span></div><NoteExcerpt text={viewed.sourceExcerpt} /></section>
            <EvidenceGroups items={viewed.evidence} />
            {viewed.supplementEvidence?.length ? <EvidenceGroups items={viewed.supplementEvidence} supplemental /> : null}
            {extraction ? <details className="nt-detail-card nt-extraction"><summary>AI 提取说明{modelDisagreements.length ? ` · ${modelDisagreements.length} 个分歧待核对` : ''}</summary><p>原始标签由 {extraction.models.join('、')} 提取；人工调整按当前版本记录。</p><p>{extraction.note}</p>{modelDisagreements.length ? <div><strong>模型分歧（未采用）</strong><ul>{modelDisagreements.map(item => <li key={`${item.model}-${item.tagId}`}>{TAG_LABELS[item.tagId]} · {item.model}</li>)}</ul></div> : null}{aiCandidate && viewed.version > 1 && !historical ? <button type="button" className="kw-button" disabled={!ready || Boolean(error)} onClick={() => openEditor({ ...viewed, tags: [...aiCandidate.tags], evidence: aiCandidate.evidence.map(item => ({ ...item })), sourceReferences: [...(aiCandidate.sourceReferences ?? []), ...viewed.evidence], extraction: aiCandidate.extraction }, false, true)}>采用 AI 精简标签</button> : null}</details> : null}
            {viewed.gaps.length ? <details className="nt-detail-card nt-boundaries"><summary>待补定义与边界 · {viewed.gaps.length} 项</summary><ul>{viewed.gaps.map((gap, index) => <li key={index}>{gap}</li>)}</ul></details> : null}
          </div>
          <div role="tabpanel" id="nt-panel-history" aria-labelledby="nt-tab-history" hidden={detailTab !== 'history'} tabIndex={0} className="nt-detail-panel">
            <section className="nt-detail-card nt-history-card"><div className="nt-card-heading"><h4>标签与定义历史 · {history.length} 个版本</h4></div><p className="nt-muted">查看旧版本不会覆盖当前记录。</p><ol className="nt-version-list">{history.map(record => <li key={tagVersionKey(record)}><div><div className="nt-version-heading"><strong>v{record.version}{record.sourceHash !== selected?.sourceHash ? ' · 旧原文' : ''}</strong>{tagVersionKey(record) === tagVersionKey(selected) ? <span>当前版本</span> : null}</div><time dateTime={record.createdAt}>{formatTime(record.createdAt)}</time><p>{record.revisionReason}</p></div><button type="button" className="kw-button" aria-label={`查看标签 v${record.version}`} onClick={() => { setViewedKey(tagVersionKey(record)); changeDetailTab('overview') }}>查看 v{record.version}</button></li>)}</ol></section>
            <details className="nt-detail-card"><summary>来源与保存信息</summary><p className="nt-source-hash">原文 SHA-256：{viewed.sourceHash}</p><p className="nt-muted">标签保存在当前浏览器，可通过“导出标签与历史”备份。</p></details>
          </div>
        </> : <div className="kw-empty"><h3>选择一篇笔记查看标签依据</h3></div>}
      </section>
    </div>
    {editor ? <TagEditor key={tagVersionKey(editor)} record={editor} supplementEntry={supplementEntry} aiEntry={aiEntry} error={writeError} onSave={save} onCancel={closeEditor} /> : null}
    {definitionEditor ? <ForecastDefinitionEditor key={`${tagVersionKey(definitionEditor.record)}:${definitionEditor.role}`} role={definitionEditor.role} title={definitionEditor.record.title} initial={definitionEditor.record.forecastDefinitions?.find(item => item.role === definitionEditor.role)} error={writeError} onRoleChange={role => setDefinitionEditor(current => current ? { ...current, role } : null)} onSave={saveDefinition} onCancel={closeDefinitionEditor} /> : null}
  </section>
}

function TagEditor({ record, aiEntry, error, onSave, onCancel }: { record: NoteTagRecord; supplementEntry: boolean; aiEntry: boolean; error: string; onSave: (draft: TagRevisionDraft) => void; onCancel: () => void }) {
  const [tags, setTags] = useState(record.tags)
  const [reason, setReason] = useState(aiEntry ? `采用 ${record.extraction?.models.join(' 与 ') || 'AI'} 从完整原文重新提取的核心标签。` : '')
  const [supplement, setSupplement] = useState(record.supplement ?? '')
  const [suggestions, setSuggestions] = useState<TagSuggestion[] | null>(null)
  const [accepted, setAccepted] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [suggestionError, setSuggestionError] = useState('')
  const [appliedEvidence, setAppliedEvidence] = useState(record.supplementEvidence ?? [])
  const supplementInput = useRef<HTMLTextAreaElement>(null)
  const requestController = useRef<AbortController | null>(null)
  const evidence = useMemo(() => [...new Map([...record.evidence, ...(record.sourceReferences ?? [])].map((item) => [`${item.startLine}:${item.endLine}:${item.quote}`, item])).values()], [record])
  const [sourceIndex, setSourceIndex] = useState(0)
  const panel = useRef<HTMLDivElement>(null)
  useDialogFocus(panel, true, onCancel)
  useEffect(() => () => { requestController.current?.abort() }, [])
  async function suggest() {
    const controller = new AbortController()
    requestController.current = controller
    setBusy(true); setSuggestionError(''); setSuggestions(null); setAccepted([])
    try {
      const response = await fetch('/api/note-tag-suggestions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ source: record.sourceExcerpt, tags, supplement }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || '生成失败，请重试。')
      setSuggestions(result.suggestions)
    } catch (cause) { if (!controller.signal.aborted) setSuggestionError(cause instanceof Error ? cause.message : '生成失败，请重试。') }
    finally { if (!controller.signal.aborted) setBusy(false) }
  }
  function applySuggestions() {
    const selected = (suggestions ?? []).filter((item) => accepted.includes(item.tagId))
    setTags((previous) => selected.reduce((next, item) => item.action === 'add' ? [...new Set([...next, item.tagId])] : next.filter((tag) => tag !== item.tagId), previous))
    setAppliedEvidence((previous) => [...previous.filter((item) => !selected.some((s) => s.tagId === item.tagId)), ...selected.filter((item) => item.action === 'add').map(({ tagId, quote, reason, conflict }) => ({ tagId, quote, reason: reason + (conflict ? `；已确认原文冲突：${conflict}` : '') }))])
    if (!reason.trim()) setReason('根据补充说明调整标签：' + selected.map((item) => `${item.action === 'add' ? '新增' : '移除'}${TAG_LABELS[item.tagId]}（${item.reason}）`).join('；'))
    setSuggestions(null); setAccepted([])
  }
  function submit(event: FormEvent) { event.preventDefault(); onSave({ tags, reason, evidence: evidence[sourceIndex], supplement, supplementEvidence: appliedEvidence }) }
  return <div className="nt-modal-backdrop"><div className="nt-editor" role="dialog" aria-modal="true" aria-labelledby="nt-editor-title" ref={panel} tabIndex={-1}>
    <div className="nt-editor-heading"><h2 id="nt-editor-title">修订笔记标签</h2><button className="sc-icon-button" type="button" aria-label="关闭标签编辑" onClick={onCancel}><StudioIcon name="close" size={20} /></button></div>
    <p>{record.title} · 保存将追加 v{record.version + 1}，原文与旧标签保留。</p>
    <form onSubmit={submit}>
      <div className="nt-editor-body">
      <section className="nt-supplement" aria-label="补充说明与标签建议">
        <label className="nt-editor-field">补充说明<textarea ref={supplementInput} value={supplement} maxLength={5000} rows={3} disabled={busy} onChange={(event) => { setSupplement(event.target.value); setSuggestions(null); setAccepted([]); setSuggestionError('') }} placeholder="例如：主要用于日线趋势判断，死叉只是减仓提醒，不是直接卖出规则。" /></label>
        <p>补充笔记用途、背景或需要纠正的标签。说明将与新版本一起保存，建议需确认后才会应用。已有补充依据的引用原句请保留，可追加说明。</p>
        <button type="button" className="kw-button" disabled={busy || !supplement.trim()} onClick={suggest}>{busy ? '正在生成标签建议…' : '根据说明建议标签'}</button>
        {suggestionError ? <p role="alert">{suggestionError}</p> : null}
        {suggestions !== null ? <div className="nt-suggestions" aria-live="polite"><h3>待确认的标签变化</h3>{!suggestions.length ? <p>没有需要调整的标签，可继续手动编辑或直接保存说明。</p> : <>{suggestions.map((item) => <label key={item.tagId}><input type="checkbox" checked={accepted.includes(item.tagId)} onChange={() => setAccepted((previous) => previous.includes(item.tagId) ? previous.filter((id) => id !== item.tagId) : [...previous, item.tagId])} /><span><strong>{item.action === 'add' ? '新增' : '移除'} · {TAG_LABELS[item.tagId]}</strong><span>{item.reason}</span><q>{item.quote}</q>{item.conflict ? <span className="nt-suggestion-conflict">与原文有冲突：{item.conflict}。勾选表示确认此调整。</span> : null}</span></label>)}<button type="button" className="kw-button" disabled={!accepted.length} onClick={applySuggestions}>应用所选建议到勾选标签</button></>}</div> : null}
      </section>
      {TAG_DIMENSIONS.map((dimension) => <fieldset key={dimension.id} disabled={busy}><legend>{dimension.label}</legend><div>{dimension.options.map((option) => <label key={option.id}><input type="checkbox" checked={tags.includes(option.id)} onChange={() => { setTags((previous) => previous.includes(option.id) ? previous.filter((tag) => tag !== option.id) : [...previous, option.id]); setSuggestions(null); setAccepted([]) }} />{option.label}</label>)}</div></fieldset>)}
      <label className="nt-editor-field">新增标签引用原文<select value={sourceIndex} onChange={(event) => setSourceIndex(Number(event.target.value))}>{evidence.map((item, index) => <option key={index} value={index}>L{item.startLine}–{item.endLine} · {item.quote.slice(0, 48)}</option>)}</select></label>
      <blockquote className="nt-source">{evidence[sourceIndex]?.quote}</blockquote>
      <label className="nt-editor-field">修订原因<textarea value={reason} onChange={(event) => setReason(event.target.value)} required rows={3} placeholder="说明分类调整或新增标签与原文的关系" /></label>
      {error ? <div className="kw-alert" role="alert">{error}</div> : null}
      <p className="nt-disclaimer">修改标签后需重新核对，计算定义与历史研究结果不会随之升级。</p>
      </div>
      <footer className="nt-editor-actions"><button type="button" className="kw-button" onClick={onCancel}>取消标签编辑</button><button type="submit" disabled={busy} className="kw-button kw-primary">保存标签新版本</button></footer>
    </form>
  </div></div>
}
