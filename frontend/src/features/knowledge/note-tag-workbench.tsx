'use client'

import { useDeferredValue, useMemo, useRef, useState, useSyncExternalStore, useEffect, type FormEvent, type KeyboardEvent } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import catalogData from './note-tag-catalog.json'
import aiTagResults from './note-tag-ai-results.json'
import { NOTE_TAG_STORAGE_KEY, TAG_DIMENSIONS, LEGACY_TAG_DIMENSIONS, TAG_LABELS, activeTagRecord, currentTagRecords, filterTagRecords, mergeTagVersions,
  applyAIOriginalTags, parseTagLedger, reviseTags, reviewTags, tagVersionKey, type AIOriginalTags, type NoteCatalog, type NoteTagRecord, type TagDimension, type TagRevisionDraft, type TagSuggestion } from './note-tags'
import './note-tag-workbench.css'
import { NoteTagReextract } from './note-tag-reextract'

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
      const method = supplemental ? '用户补充' : item.method === 'ai' ? '双模型原文提取' : item.method === 'manual' ? '人工引用' : item.method === 'catalog' ? '旧解析／目录候选' : '术语匹配候选'
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
  const allVersions = useMemo(() => mergeTagVersions(base, local), [base, local])
  const [level, setLevel] = useState<'document' | 'fragment'>('document')
  const [view, setView] = useState<'tags' | 'study'>('tags')
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [facets, setFacets] = useState<Partial<Record<TagDimension, string>>>({})
  const [status, setStatus] = useState('all')
  const [selectedId, setSelectedId] = useState(catalog.documents[0]?.id ?? '')
  const [viewedKey, setViewedKey] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [editor, setEditor] = useState<NoteTagRecord | null>(null)
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
  const filtered = useMemo(() => filterTagRecords(current.filter((record) => record.level === level && (status === 'all' || record.status === status)), { query: deferredQuery, facets }), [current, level, status, deferredQuery, facets])
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages - 1)
  const selected = filtered.find((record) => record.id === selectedId) ?? filtered[0]
  const history = allVersions.filter((record) => record.id === selected?.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.version - a.version)
  const viewed = (viewedKey ? history.find((record) => tagVersionKey(record) === viewedKey && viewedKey !== (selected && tagVersionKey(selected))) : null) ?? selected
  const historical = Boolean(viewed && selected && tagVersionKey(viewed) !== tagVersionKey(selected))
  const aiOriginal = base.find(record => record.id === viewed?.id && record.sourceHash === viewed.sourceHash && record.extraction)
  const aiCandidate = aiOriginal ? activeTagRecord(aiOriginal) : undefined
  const modelDisagreements = viewed?.extraction?.disagreements.filter(item => !viewed.tags.includes(item.tagId)) ?? []

  function persist(next: NoteTagRecord, previous: NoteTagRecord) {
    if (!ready || error) throw new Error('标签存储尚未就绪。')
    const stored = parseTagLedger(localStorage.getItem(NOTE_TAG_STORAGE_KEY))
    const seed = base.find((record) => record.id === previous.id && record.sourceHash === previous.sourceHash)
    if (!seed || currentTagRecords([seed], stored)[0].version !== previous.version) throw new Error('标签已有更新，请关闭编辑器后重新读取。')
    const records = mergeTagVersions(stored, [seed, ...allVersions.filter((record) => record.id === previous.id), next])
    localStorage.setItem(NOTE_TAG_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, records }))
    store.refresh()
    setSelectedId(next.id); setViewedKey(null); setWriteError('')
    setMessage(`已保存标签 v${next.version}，原文与历史版本保持完整。`)
  }

  function save(draft: TagRevisionDraft) {
    if (!editor) return
    try {
      persist(reviseTags(editor, draft, new Date().toISOString()), editor)
      closeEditor()
      setFacets({}); setQuery(''); setStatus('all'); setPage(0)
    } catch (cause) { setWriteError(`保存失败：${cause instanceof Error ? cause.message : '请检查存储权限。'} 输入已保留。`) }
  }

  function confirmTags() {
    if (!selected) return
    try { persist(reviewTags(selected, new Date().toISOString()), selected) }
    catch (cause) { setWriteError(cause instanceof Error ? cause.message : '标签确认失败。') }
  }

  function exportTags() {
    try {
      if (!ready || error) throw new Error('请先解决本地标签读取问题。')
      const blob = new Blob([JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), sourceCommit: catalog.sourceCommit,
        sourceRepository: catalog.sourceRepository, taxonomy: TAG_DIMENSIONS, legacyTaxonomy: LEGACY_TAG_DIMENSIONS, records: allVersions }, null, 2)], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url; anchor.download = 'stockcal-note-tags.json'; document.body.appendChild(anchor); anchor.click(); anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage('已导出标签词典、全部笔记与片段、原文证据和修订历史。')
    } catch (cause) { setWriteError(cause instanceof Error ? cause.message : '标签导出失败。') }
  }

  function choose(record: NoteTagRecord) {
    setSelectedId(record.id); setViewedKey(null)
    if (window.matchMedia?.('(max-width: 760px)').matches) detailRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }

  function reset() { setQuery(''); setFacets({}); setStatus('all'); setPage(0); setViewedKey(null) }

  if (view === 'study') return <section className="nt-workbench" aria-label="笔记标签工作台"><nav className="nt-study-tabs" aria-label="笔记工作视图"><button type="button" onClick={() => setView('tags')}>标签与版本</button><button type="button" aria-pressed="true">逐篇学习建议</button></nav><NoteStudyWorkbench currentTags={current} /></section>

  return <section className="nt-workbench" aria-label="笔记标签工作台">
    <nav className="nt-study-tabs" aria-label="笔记工作视图"><button type="button" aria-pressed="true">标签与版本</button><button type="button" onClick={() => setView('study')}>逐篇学习建议</button></nav>
    <div className="nt-heading"><div><h2>笔记标签目录</h2><p>{catalog.documents.length} 篇笔记 · {catalog.fragments.length} 个原文片段 · {catalog.audit.addedFiles.length} 篇补充资料</p></div><button type="button" className="kw-button" disabled={!ready || Boolean(error)} onClick={exportTags}>导出标签与历史</button></div>
    <p className="nt-context">后续研究对象：<Link href="/?symbol=603533">掌阅科技 · 603533</Link>。通用笔记保留通用范围，股票案例按原文处理。</p>
    <p className="nt-disclaimer">自动标签为待核对候选；标签核对不代表计算定义或预测效果已验证。</p>
    {error ? <div className="kw-alert" role="alert">{error}<button type="button" onClick={store.refresh}>重新读取标签</button></div> : null}
    {writeError && !editor ? <div className="kw-alert" role="alert">{writeError}</div> : null}
    {message ? <div className="kw-notice" role="status">{message}</div> : null}
    <div className="nt-filters" aria-label="标签筛选">
      <label>搜索笔记与标签<input aria-label="搜索笔记与标签" value={query} placeholder="标题、原文片段、MA均线…" onChange={(event) => { setQuery(event.target.value); setPage(0); setViewedKey(null) }} /></label>
      <label>标注层级<select value={level} onChange={(event) => { setLevel(event.target.value as typeof level); setPage(0); setViewedKey(null) }}><option value="document">整篇笔记</option><option value="fragment">规则片段</option></select></label>
      {TAG_DIMENSIONS.map((dimension) => <label key={dimension.id}>{dimension.label}<select value={facets[dimension.id] ?? ''} onChange={(event) => { setFacets((previous) => ({ ...previous, [dimension.id]: event.target.value })); setPage(0); setViewedKey(null) }}><option value="">全部</option>{dimension.options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>)}
      <label>标签核对状态<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); setViewedKey(null) }}><option value="all">全部</option><option value="candidate">待核对</option><option value="reviewed">已核对标签</option></select></label>
      <button type="button" className="kw-button" onClick={reset}>重置标签筛选</button>
    </div>
    <div className="nt-columns">
      <section className="nt-list" aria-label="笔记目录">
        <div className="nt-list-heading"><strong>{level === 'document' ? '整篇笔记' : '规则片段'}</strong><span>{filtered.length} 条结果</span></div>
        {filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map((record) => <div key={record.id} className="nt-record-row"><button type="button" className="nt-record" aria-label={`查看标签：${record.title}`} aria-pressed={record.id === selected?.id} onClick={() => choose(record)}><strong>{record.title}</strong><small>{record.file}</small><span className="nt-chips">{(record.extraction ? record.tags.slice(0, 5) : record.tags.filter((tag) => tag.startsWith('topic.')).slice(0, 4)).map((tag) => <span key={tag}>{TAG_LABELS[tag]}</span>)}</span><span className="nt-record-status">{record.status === 'reviewed' ? '标签已核对' : '候选 · 待核对'} · v{record.version}</span></button><a className="nt-source-link" href={record.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`查看原文：${record.title}`}>查看原文 ↗</a></div>)}
        {!filtered.length ? <div className="kw-empty"><h3>没有符合条件的笔记</h3><p>调整内容分类、分析主题或关键词后再试。</p></div> : null}
        <div className="nt-pagination"><button type="button" className="kw-button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>上一页</button><span>{currentPage + 1} / {pages}</span><button type="button" className="kw-button" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>下一页</button></div>
      </section>
      <section className="nt-detail" aria-label="标签详情" ref={detailRef}>
        {viewed ? <>
          <div className="nt-detail-heading"><span>{viewed.level === 'document' ? '整篇笔记' : '规则片段'} · v{viewed.version}</span><h3>{viewed.title}</h3><p>{viewed.summary}</p><a className="nt-source-link" href={viewed.sourceUrl} target="_blank" rel="noopener noreferrer">查看原文 ↗</a></div>
          {historical ? <div className="kw-history-banner"><span>历史标签版本，只读{viewed.sourceHash !== selected?.sourceHash ? ' · 原文版本已更新' : ''}</span><button type="button" onClick={() => setViewedKey(null)}>返回当前标签</button></div> : null}
          <p className="nt-revision">{viewed.version === 1 ? '自动候选' : '人工修订'} · {formatTime(viewed.createdAt)}<br />{viewed.revisionReason}</p>
          <section className="nt-supplement-summary"><h4>补充说明</h4>{viewed.supplement ? <p>{viewed.supplement}</p> : <p>补充用途或背景，帮助重新提取标签。</p>}{!historical ? <button type="button" className="kw-button" disabled={!ready || Boolean(error)} onClick={() => openEditor(viewed, true)}>{viewed.supplement ? '修改补充说明' : '补充说明'}</button> : null}</section>
          {viewed.supplementEvidence?.length ? <EvidenceGroups items={viewed.supplementEvidence} supplemental /> : null}
          {!historical && viewed.level === 'document' ? <NoteTagReextract key={tagVersionKey(viewed)} record={viewed} disabled={!ready || Boolean(error)} onAdopt={candidate => openEditor({ ...viewed, tags: [...candidate.tags], evidence: candidate.evidence, sourceReferences: [...(viewed.sourceReferences ?? []), ...viewed.evidence], extraction: candidate.extraction }, false, true)} /> : null}
          {viewed.extraction ? <section className="nt-extraction"><p>原始标签由 {viewed.extraction.models.join('、')} 提取；人工调整按当前版本记录。</p>{!viewed.tags.length ? <p>暂无可确认的核心标签，请核对原文或补充说明。</p> : null}{modelDisagreements.length ? <details><summary>模型分歧 · {modelDisagreements.length} 个候选</summary><p>以下仅供核对，尚未作为标签采用。</p><ul>{modelDisagreements.map(item => <li key={`${item.model}-${item.tagId}`}>{TAG_LABELS[item.tagId]} · {item.model}</li>)}</ul></details> : null}<details><summary>查看提取说明</summary><p>{viewed.extraction.note}</p></details></section> : null}
          <div className="nt-facets">{(historical ? [...TAG_DIMENSIONS, ...LEGACY_TAG_DIMENSIONS.filter(dimension => !TAG_DIMENSIONS.some(active => active.id === dimension.id))] : TAG_DIMENSIONS).filter(dimension => viewed.tags.some(tag => tag.startsWith(`${dimension.id}.`))).map((dimension) => <div key={dimension.id}><strong>{dimension.label}</strong><span className="nt-chips">{viewed.tags.filter((tag) => tag.startsWith(`${dimension.id}.`)).map((tag) => <span key={tag}>{TAG_LABELS[tag]}</span>)}</span></div>)}</div>
          <section className="kw-detail-section"><h4>原文片段</h4><blockquote className="nt-source">{viewed.sourceExcerpt}</blockquote><a className="nt-source-link" href={viewed.sourceUrl} target="_blank" rel="noopener noreferrer">查看 {viewed.file} 原文</a></section>
          {viewed.gaps.length ? <section className="kw-detail-section"><h4>待补定义与边界</h4><ul>{viewed.gaps.map((gap, index) => <li key={index}>{gap}</li>)}</ul></section> : null}
          <EvidenceGroups items={viewed.evidence} />
          <details className="kw-history"><summary>标签历史 · {history.length} 个版本</summary><ol>{history.map((record) => <li key={tagVersionKey(record)}><div><strong>v{record.version}{record.sourceHash !== selected?.sourceHash ? ' · 旧原文' : ''}</strong><span>{formatTime(record.createdAt)}</span><small>{record.revisionReason}</small></div><button type="button" aria-label={`查看标签 v${record.version}`} aria-pressed={tagVersionKey(record) === tagVersionKey(viewed)} onClick={() => setViewedKey(tagVersionKey(record))}>查看 v{record.version}</button></li>)}</ol></details>
          {!historical ? <div className="nt-detail-actions"><button type="button" className="kw-button" disabled={!ready || Boolean(error)} onClick={() => openEditor(viewed)}>编辑标签</button>{aiCandidate && viewed.version > 1 ? <button type="button" className="kw-button" disabled={!ready || Boolean(error)} onClick={() => openEditor({ ...viewed, tags: [...aiCandidate.tags], evidence: aiCandidate.evidence.map(item => ({ ...item })), sourceReferences: [...(aiCandidate.sourceReferences ?? []), ...viewed.evidence], extraction: aiCandidate.extraction }, false, true)}>采用 AI 精简标签</button> : null}<button type="button" className="kw-button kw-primary" disabled={!ready || Boolean(error) || !viewed.tags.length || viewed.status === 'reviewed'} onClick={confirmTags}>{viewed.status === 'reviewed' ? '标签已核对' : '确认标签'}</button></div> : null}
          <p className="nt-source-hash">原文 SHA-256：{viewed.sourceHash}<br />标签保存在当前浏览器；导出可保留修订历史。</p>
        </> : <div className="kw-empty"><h3>选择一篇笔记查看标签依据</h3></div>}
      </section>
    </div>
    {editor ? <TagEditor key={tagVersionKey(editor)} record={editor} supplementEntry={supplementEntry} aiEntry={aiEntry} error={writeError} onSave={save} onCancel={closeEditor} /> : null}
  </section>
}

function TagEditor({ record, supplementEntry, aiEntry, error, onSave, onCancel }: { record: NoteTagRecord; supplementEntry: boolean; aiEntry: boolean; error: string; onSave: (draft: TagRevisionDraft) => void; onCancel: () => void }) {
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
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    if (supplementEntry) supplementInput.current?.focus()
    else panel.current?.querySelector<HTMLElement>('input, select, button')?.focus()
    return () => { requestController.current?.abort(); if (previous?.isConnected) previous.focus() }
  }, [supplementEntry])
  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') { event.preventDefault(); onCancel() }
    if (event.key !== 'Tab') return
    const nodes = Array.from(panel.current?.querySelectorAll<HTMLElement>('input, select, textarea, button:not(:disabled)') ?? [])
    const first = nodes[0], last = nodes.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
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
  return <div className="nt-modal-backdrop"><div className="nt-editor" role="dialog" aria-modal="true" aria-labelledby="nt-editor-title" ref={panel} onKeyDown={keyDown}>
    <div className="nt-editor-heading"><h2 id="nt-editor-title">修订笔记标签</h2></div>
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
