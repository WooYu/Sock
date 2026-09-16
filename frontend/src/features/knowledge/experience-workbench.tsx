'use client'

import Link from 'next/link'
import { useDeferredValue, useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent } from 'react'
import { StudioIcon } from '../research/studio-icon'
import researchPackage from './research-package.json'
import {
  KNOWLEDGE_STORAGE_KEY, TYPE_LABELS, createManualVersion, isExpired, latestEntries,
  mergeVersions, parseLedger, reviewVersion, reviseSourceInterpretation, shanghaiToday, validateManualDraft,
  type ExperienceEntry, type ExperienceType, type KnowledgePackage, type ManualEntryDraft,
} from './knowledge-types'
import './experience-workbench.css'

type WorkbenchTab = 'library' | 'backtest'
const PAGE_SIZE = 12
const dateTime = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
const displayDate = (value: string) => Number.isFinite(Date.parse(value)) ? dateTime.format(new Date(value)) : value
const lines = (value: string) => value.split('\n').map((line) => line.trim()).filter(Boolean)
function externalUrl(value: string): string | undefined {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined } catch { return undefined }
}

function createLedgerStore(initialDay: string) {
  type Snapshot = { records: ExperienceEntry[]; ready: boolean; error: string; today: string }
  const serverSnapshot: Snapshot = { records: [], ready: false, error: '', today: initialDay }
  let snapshot = serverSnapshot
  let cachedRaw: string | null | undefined
  const listeners = new Set<() => void>()
  const getSnapshot = () => {
    const today = shanghaiToday()
    try {
      const raw = window.localStorage.getItem(KNOWLEDGE_STORAGE_KEY)
      if (raw === cachedRaw && today === snapshot.today) return snapshot
      const records = parseLedger(raw)
      cachedRaw = raw
      snapshot = { records, ready: true, error: '', today }
    } catch {
      const error = '本地记录读取失败，现有内容未被覆盖。请检查浏览器存储权限或恢复已导出的备份。'
      if (snapshot.error !== error || snapshot.today !== today) snapshot = { ...snapshot, ready: false, error, today }
    }
    return snapshot
  }
  const refresh = () => {
    cachedRaw = undefined
    getSnapshot()
    listeners.forEach((listener) => listener())
  }
  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    const onStorage = (event: StorageEvent) => { if (event.key === KNOWLEDGE_STORAGE_KEY || event.key === null) refresh() }
    const timer = window.setInterval(refresh, 60000)
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', refresh)
    return () => { listeners.delete(listener); window.clearInterval(timer); window.removeEventListener('storage', onStorage); window.removeEventListener('focus', refresh) }
  }
  return { getSnapshot, getServerSnapshot: () => serverSnapshot, subscribe, refresh }
}

export function ExperienceWorkbench({ data = researchPackage as KnowledgePackage, initialTab = 'library' }: { data?: KnowledgePackage; initialTab?: WorkbenchTab }) {
  const [tab, setTab] = useState<WorkbenchTab>(initialTab)
  const ledger = useMemo(() => createLedgerStore(data.generatedAt.slice(0, 10)), [data.generatedAt])
  const { records: localRecords, ready, error: storageError, today } = useSyncExternalStore(ledger.subscribe, ledger.getSnapshot, ledger.getServerSnapshot)
  const [writeError, setWriteError] = useState('')
  const [message, setMessage] = useState('')
  const [type, setType] = useState<ExperienceType | 'all'>('all')
  const [source, setSource] = useState<'all' | 'github' | 'manual'>('all')
  const [status, setStatus] = useState<'all' | 'unreviewed' | 'reviewed'>('all')
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search.trim().toLocaleLowerCase())
  const [page, setPage] = useState(0)
  const [selectedId, setSelectedId] = useState(data.entries[0]?.id ?? '')
  const [historyVersion, setHistoryVersion] = useState<number | null>(null)
  const [editor, setEditor] = useState<ExperienceEntry | 'new' | null>(null)
  const detailRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const onLocation = () => setTab(new URL(window.location.href).searchParams.get('view') === 'backtest' ? 'backtest' : 'library')
    window.addEventListener('popstate', onLocation)
    return () => window.removeEventListener('popstate', onLocation)
  }, [])

  const allVersions = useMemo(() => mergeVersions(data.entries, localRecords), [data.entries, localRecords])
  const entries = useMemo(() => latestEntries(allVersions).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)), [allVersions])
  const counts = useMemo(() => ({
    experience: entries.filter((entry) => entry.type === 'experience').length,
    principle: entries.filter((entry) => entry.type === 'principle').length,
    hint: entries.filter((entry) => entry.type === 'hint').length,
    manual: entries.filter((entry) => entry.sourceType === 'manual').length,
    pending: entries.filter((entry) => entry.status === 'unreviewed').length,
  }), [entries])
  const filtered = useMemo(() => entries.filter((entry) => (
    (type === 'all' || entry.type === type) && (source === 'all' || entry.sourceType === source)
    && (status === 'all' || entry.status === status)
    && (!deferredSearch || [entry.title, entry.originalText, entry.interpretation, entry.stock ?? '', ...entry.scope, ...entry.references.map((ref) => ref.file)].join(' ').toLocaleLowerCase().includes(deferredSearch))
  )), [entries, type, source, status, deferredSearch])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const selected = filtered.find((entry) => entry.id === selectedId) ?? filtered[0]
  const history = allVersions.filter((entry) => entry.id === selected?.id).sort((a, b) => b.version - a.version)
  const viewed = history.find((entry) => entry.version === historyVersion) ?? selected
  const historical = Boolean(viewed && selected && viewed.version !== selected.version)

  function switchTab(next: WorkbenchTab) {
    setTab(next)
    const url = new URL(window.location.href)
    if (next === 'backtest') url.searchParams.set('view', 'backtest')
    else url.searchParams.delete('view')
    window.history.replaceState(null, '', `${url.pathname}${url.search}`)
  }

  function chooseEntry(entry: ExperienceEntry) {
    setSelectedId(entry.id)
    setHistoryVersion(null)
    if (window.matchMedia?.('(max-width: 760px)').matches) detailRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }

  function persistVersion(next: ExperienceEntry, expectedVersion?: number) {
    if (!ready || storageError) throw new Error('本地记录尚未就绪，请先解决读取问题。')
    const stored = parseLedger(window.localStorage.getItem(KNOWLEDGE_STORAGE_KEY))
    const latest = latestEntries(mergeVersions(data.entries, stored)).find((entry) => entry.id === next.id)
    if (latest?.version !== expectedVersion) throw new Error('该记录已有更新，请关闭后重新选择、编辑。')
    // Store the seed snapshot as well, so later package updates cannot erase the reviewed original.
    const previous = allVersions.filter((entry) => entry.id === next.id)
    const records = mergeVersions(stored, [...previous, next])
    window.localStorage.setItem(KNOWLEDGE_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, records }))
    ledger.refresh()
    setSelectedId(next.id)
    setHistoryVersion(null)
    setWriteError('')
  }

  function saveEntry(draft: ManualEntryDraft) {
    try {
      const previous = editor && editor !== 'new' ? editor : undefined
      const id = previous?.id ?? `manual-${crypto.randomUUID()}`
      const createdAt = new Date().toISOString()
      const next = previous?.sourceType === 'github' ? reviseSourceInterpretation(previous, draft, createdAt) : createManualVersion(draft, id, createdAt, previous)
      persistVersion(next, previous?.version)
      setEditor(null)
      setType('all'); setSource('all'); setStatus('all'); setSearch(''); setPage(0)
      setMessage(`已保存 v${next.version}。${next.interpretation ? '解释仍待确认。' : '原始内容保留为待解释记录。'}`)
    } catch (error) {
      setWriteError(`保存失败：${error instanceof Error ? error.message : '请检查浏览器存储空间与权限。'} 输入已保留。`)
    }
  }

  function confirmInterpretation() {
    if (!selected || !ready) return
    try {
      const next = reviewVersion(selected, new Date().toISOString())
      persistVersion(next, selected.version)
      setMessage(`已确认解释并保存 v${next.version}；缺失定义保持原样，此操作不接入交易或预测。`)
    } catch (error) { setWriteError(`保存失败：${error instanceof Error ? error.message : '请检查本地存储。'}`) }
  }

  function exportRecords() {
    try {
      const blob = new Blob([JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), sourceCommit: data.sourceCommit, records: allVersions }, null, 2)], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url; anchor.download = `stockcal-experiences-${today}.json`; document.body.appendChild(anchor); anchor.click(); anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage('已导出当前可读记录及全部版本。')
    } catch { setWriteError('导出失败，请检查浏览器下载权限。') }
  }

  const resetFilters = () => { setType('all'); setSource('all'); setStatus('all'); setSearch(''); setPage(0) }

  return <div className="kw-workbench">
    <header className="kw-header">
      <Link className="kw-brand" href="/"><span><StudioIcon name="chart" size={20} /></span>StockCal</Link>
      <nav aria-label="研究导航">
        <Link href="/?symbol=300502">K线工作台</Link>
        <a href="/knowledge" aria-current={tab === 'library' ? 'page' : undefined} onClick={(event) => { event.preventDefault(); switchTab('library') }}>经验与原则</a>
        <a href="/knowledge?view=backtest" aria-current={tab === 'backtest' ? 'page' : undefined} onClick={(event) => { event.preventDefault(); switchTab('backtest') }}>回测证据</a>
      </nav>
      <span className="kw-header-note"><i />研究档案 · 本地保存</span>
    </header>

    <main className="kw-main">
      <div className="kw-breadcrumb"><StudioIcon name="book" size={15} /><span>研究工作区</span><span>/</span><strong>{tab === 'library' ? '经验与原则' : '回测证据'}</strong></div>
      <div className="kw-page-heading">
        <div><h1>经验与原则</h1><p>保留原话，核对解释，让每条经验在被使用前先经得起检查。</p></div>
        <div className="kw-actions"><button className="kw-button" onClick={exportRecords} type="button"><StudioIcon name="layers" size={16} />导出记录</button><button className="kw-button kw-primary" disabled={!ready} onClick={() => { setEditor('new'); setWriteError('') }} type="button"><StudioIcon name="plus" size={16} />新增记录</button></div>
      </div>

      {storageError ? <div className="kw-alert" role="alert"><span>{storageError}</span><button type="button" onClick={ledger.refresh}>重新读取</button></div> : null}
      {writeError && !editor ? <div className="kw-alert" role="alert">{writeError}</div> : null}
      {message ? <div className="kw-notice" role="status"><StudioIcon name="book" size={16} /><span>{message}</span><button type="button" aria-label="关闭保存提示" onClick={() => setMessage('')}><StudioIcon name="close" size={14} /></button></div> : null}

      <div className="kw-summary" aria-label="知识库概况">
        <div><span>来源资料</span><strong>{data.docCount}<small>篇</small></strong><p>保留 GitHub 原文与行号</p></div>
        <div><span>经验与原则</span><strong>{entries.length}<small>条</small></strong><p>包括 {counts.manual} 条手工记录</p></div>
        <div><span>待核对解释</span><strong>{counts.pending}<small>条</small></strong><p>确认含义后再开展研究</p></div>
        <div className="kw-summary-note"><StudioIcon name="layers" size={24} /><p><strong>经验 ≠ 可执行规则</strong><span>定义缺失时保持参考；确认解释不代表启用交易。</span></p></div>
      </div>

      <div className="kw-tabs" role="tablist" aria-label="知识工作区视图" onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
          event.preventDefault()
          const next = event.key === 'Home' ? 'library' : event.key === 'End' ? 'backtest' : tab === 'library' ? 'backtest' : 'library'
          switchTab(next)
          document.getElementById(`kw-tab-${next}`)?.focus()
        }
      }}>
        {(['library', 'backtest'] as const).map((key) => <button id={`kw-tab-${key}`} key={key} role="tab" tabIndex={tab === key ? 0 : -1} aria-selected={tab === key} aria-controls={`kw-panel-${key}`} onClick={() => switchTab(key)} type="button"><StudioIcon name={key === 'library' ? 'book' : 'chart'} size={16} />{key === 'library' ? '经验库' : '回测证据'}{key === 'library' ? <span>{entries.length}</span> : null}</button>)}
        <span className="kw-tabs-caption">资料更新 {data.generatedAt.slice(0, 10)}</span>
      </div>

      {tab === 'library' ? <div id="kw-panel-library" role="tabpanel" aria-labelledby="kw-tab-library" className="kw-library">
        <aside className="kw-sidebar" aria-label="记录筛选">
          <h2>我的知识库</h2>
          <div className="kw-type-filters" aria-label="按类型筛选">
            <button type="button" aria-pressed={type === 'all'} onClick={() => { setType('all'); setPage(0) }}><StudioIcon name="layers" size={17} /><span>全部记录</span><small>{entries.length}</small></button>
            {(Object.keys(TYPE_LABELS) as ExperienceType[]).map((key) => <button type="button" key={key} aria-pressed={type === key} onClick={() => { setType(key); setPage(0) }}><StudioIcon name={key === 'experience' ? 'book' : key === 'principle' ? 'target' : 'clock'} size={17} /><span>{TYPE_LABELS[key]}</span><small>{counts[key]}</small></button>)}
          </div>
          <div className="kw-select-filters">
            <label htmlFor="kw-source-filter">记录来源</label><select id="kw-source-filter" value={source} onChange={(event) => { setSource(event.target.value as typeof source); setPage(0) }}><option value="all">全部来源</option><option value="github">GitHub 笔记</option><option value="manual">手工记录</option></select>
            <label htmlFor="kw-status-filter">审阅状态</label><select id="kw-status-filter" value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setPage(0) }}><option value="all">全部状态</option><option value="unreviewed">待确认</option><option value="reviewed">已确认解释</option></select>
          </div>
          <div className="kw-sidebar-note"><span>三种记录，各有用途</span><p><b>经验</b>记录现象与推断。<br /><b>原则</b>描述条件与行动。<br /><b>提示</b>有时效，过期后回看。</p><p>本地编辑会保留每一个版本。</p></div>
        </aside>

        <section className="kw-list-panel" aria-label="经验记录列表">
          <label className="kw-search" htmlFor="kw-search"><StudioIcon name="search" size={17} /><input id="kw-search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} placeholder="搜索标题、原文、股票…" aria-label="搜索经验记录" />{search ? <button type="button" onClick={() => setSearch('')} aria-label="清空搜索"><StudioIcon name="close" size={14} /></button> : null}</label>
          <div className="kw-list-caption"><span>{type === 'all' ? '全部记录' : TYPE_LABELS[type]}</span><span>{filtered.length} 条结果</span></div>
          <div className="kw-entry-list">
            {filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map((entry) => <button className={`kw-entry ${selected?.id === entry.id ? 'is-selected' : ''}`} key={entry.id} type="button" aria-pressed={selected?.id === entry.id} aria-label={`查看记录：${entry.title}`} onClick={() => chooseEntry(entry)}>
              <span className="kw-entry-meta"><span className={`kw-badge kw-type-${entry.type}`}>{TYPE_LABELS[entry.type]}</span><span>{isExpired(entry, today) ? '已到期' : entry.status === 'reviewed' ? '已确认' : '待确认'}</span></span>
              <strong>{entry.title}</strong><p>{entry.interpretation || entry.originalText}</p>
              <span className="kw-entry-footer"><span>{entry.sourceType === 'github' ? 'GitHub 笔记' : '手工记录'}{entry.stock ? ` · ${entry.stock}` : ''}</span><span>v{entry.version}<StudioIcon name="chevron" size={13} /></span></span>
            </button>)}
            {!filtered.length ? <div className="kw-empty"><StudioIcon name="search" size={28} /><h3>没有符合条件的记录</h3><p>试试其他关键词，或放宽筛选条件。</p><button type="button" className="kw-button" onClick={resetFilters}>重置筛选</button></div> : null}
          </div>
          <div className="kw-pagination"><button type="button" aria-label="上一页记录" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>上一页</button><span>{currentPage + 1} / {pageCount}</span><button type="button" aria-label="下一页记录" disabled={currentPage === pageCount - 1} onClick={() => setPage(currentPage + 1)}>下一页</button></div>
        </section>

        <section className="kw-detail" aria-label="记录详情" ref={detailRef}>
          {viewed ? <>
            <div className="kw-detail-meta"><span className={`kw-badge kw-type-${viewed.type}`}>{TYPE_LABELS[viewed.type]}</span><span>{viewed.sourceType === 'github' ? viewed.version === 1 ? 'AI 从原文提取' : '原文提取 · 本地审阅版本' : '手工记录'}</span><span className="kw-version">v{viewed.version}</span></div>
            <h2>{viewed.title}</h2>
            <div className="kw-detail-subtitle"><span>{viewed.stock ?? '通用研究记录'}</span><span>{displayDate(viewed.createdAt)}</span></div>
            {historical ? <div className="kw-history-banner"><span>历史版本，只读</span><button type="button" onClick={() => setHistoryVersion(null)}>回到当前版本</button></div> : null}
            {viewed.type === 'hint' && viewed.expiresOn ? <div className={`kw-expiry ${isExpired(viewed, today) ? 'is-expired' : ''}`}><StudioIcon name="clock" size={15} />{isExpired(viewed, today) ? '提示已到期，仅供回看' : '提示有效期'} · {viewed.expiresOn}（含当日）</div> : null}
            <div className="kw-readiness"><StudioIcon name="stop-loss" size={18} /><div><strong>{isExpired(viewed, today) ? '已到期 · 仅供回看' : viewed.gaps.length ? '仅供参考 · 定义待补充' : viewed.type !== 'principle' ? '研究参考 · 尚非计算规则' : viewed.status !== 'reviewed' ? '待核对 · 尚非计算规则' : '定义已整理 · 待计算验证'}</strong><p>{viewed.gaps.length ? `${viewed.gaps.length} 项定义需要补充，当前不具备计算资格。` : '这里记录理解与证据，尚未连接执行或预测。'}</p></div></div>

            <section className="kw-detail-section"><h3><StudioIcon name="book" size={16} />原始内容</h3><blockquote className="kw-original">{viewed.originalText}</blockquote></section>
            <section className="kw-detail-section"><h3><StudioIcon name="layers" size={16} />{viewed.sourceType === 'github' && viewed.version === 1 ? 'AI 解读' : '当前解释'}<span>{viewed.status === 'reviewed' ? '已确认解释' : viewed.interpretation ? '待确认' : '待解释'}</span></h3><p className="kw-interpretation">{viewed.interpretation || '尚未解释。原始内容已保存，可编辑补充你的理解；保存不会自动调用 AI。'}</p>{viewed.scope.length ? <div className="kw-scope">{viewed.scope.map((scope, index) => <span key={`${scope}-${index}`}>{scope}</span>)}</div> : null}</section>
            {viewed.gaps.length ? <section className="kw-detail-section kw-gap-section"><h3>需要补充的定义<span>{viewed.gaps.length} 项</span></h3><ul>{viewed.gaps.map((gap, index) => <li key={index}>{gap}</li>)}</ul></section> : null}
            {viewed.caveats.length ? <section className="kw-detail-section"><h3>适用边界与例外</h3><ul>{viewed.caveats.map((caveat, index) => <li key={index}>{caveat}</li>)}</ul></section> : null}
            {viewed.researchTest ? <section className="kw-detail-section kw-research-test"><h3>关联研究</h3><p>{viewed.researchTest}</p><button type="button" onClick={() => switchTab('backtest')}>查看回测证据<StudioIcon name="arrow" size={14} /></button></section> : null}
            <section className="kw-detail-section kw-references"><h3>原文出处<span>{viewed.references.length ? `${viewed.references.length} 处` : '手工输入'}</span></h3>{viewed.references.length ? viewed.references.map((reference, index) => <details key={`${reference.file}-${reference.startLine}-${index}`}><summary><StudioIcon name="book" size={14} /><span>{reference.file}<small>第 {reference.startLine}{reference.endLine !== reference.startLine ? `—${reference.endLine}` : ''} 行</small></span></summary><blockquote>{reference.quote}</blockquote>{externalUrl(reference.url) ? <a href={externalUrl(reference.url)} target="_blank" rel="noopener noreferrer">打开原文行号<StudioIcon name="arrow" size={14} /></a> : null}</details>) : <p>这条记录来自手工输入，原话保留在上方。</p>}</section>
            <details className="kw-history"><summary>版本历史 · {history.length} 个版本</summary><ol>{history.map((entry) => <li key={entry.version}><div><strong>v{entry.version}{entry.version === selected?.version ? ' · 当前' : ''}</strong><span>{displayDate(entry.createdAt)}</span><small>{entry.status === 'reviewed' ? '确认解释' : entry.previousVersion ? `修订自 v${entry.previousVersion}` : '首次记录'}</small></div><button type="button" aria-label={`查看 v${entry.version}`} aria-pressed={viewed.version === entry.version} onClick={() => setHistoryVersion(entry.version)}>查看 v{entry.version}</button></li>)}</ol></details>
            {!historical ? <div className="kw-detail-actions"><span>{viewed.status === 'reviewed' ? '解释已核对，边界仍然保留' : '核对原话与解释是否一致'}</span><div><button className="kw-button" type="button" disabled={!ready} onClick={() => { setEditor(viewed); setWriteError('') }}>{viewed.sourceType === 'manual' ? '编辑记录' : '修正解释'}</button><button className="kw-button kw-primary" type="button" disabled={!ready || viewed.status === 'reviewed' || !viewed.interpretation.trim() || isExpired(viewed, today)} onClick={confirmInterpretation}>{viewed.status === 'reviewed' ? '解释已确认' : '确认解释'}</button></div><small>确认仅记录审阅状态，不会启用交易或改变生产预测。</small></div> : null}
          </> : <div className="kw-empty"><StudioIcon name="book" size={28} /><h3>{entries.length ? '等待选择记录' : '从一条经验开始'}</h3><p>{entries.length ? '调整左侧筛选，查看记录详情。' : '新增记录，保留你当时的观察和判断。'}</p></div>}
        </section>
      </div> : <BacktestEvidence data={data} />}
      <footer className="kw-footer"><span>StockCal · 研究、记录、验证</span><span>来源版本 {data.sourceCommit.slice(0, 8)} · 记录保存在当前浏览器</span>{externalUrl(data.sourceRepository) ? <a href={externalUrl(data.sourceRepository)} target="_blank" rel="noopener noreferrer">查看来源仓库<StudioIcon name="arrow" size={13} /></a> : null}</footer>
    </main>
    {editor ? <EntryEditor key={editor === 'new' ? 'new' : `${editor.id}-${editor.version}`} entry={editor === 'new' ? undefined : editor} today={today} error={writeError} onCancel={() => { setEditor(null); setWriteError('') }} onSave={saveEntry} /> : null}
  </div>
}

function EntryEditor({ entry, today, error, onCancel, onSave }: { entry?: ExperienceEntry; today: string; error: string; onCancel: () => void; onSave: (draft: ManualEntryDraft) => void }) {
  const sourceLocked = entry?.sourceType === 'github'
  const [draft, setDraft] = useState<ManualEntryDraft>(() => entry ? { type: entry.type, title: entry.title, originalText: entry.originalText, interpretation: entry.interpretation, stock: entry.stock ?? '', expiresOn: entry.expiresOn ?? '', gaps: entry.gaps, caveats: entry.caveats, scope: entry.scope } : { type: 'experience', title: '', originalText: '', interpretation: '', stock: '', expiresOn: '', gaps: [] })
  const [gaps, setGaps] = useState(entry?.gaps.join('\n') ?? '')
  const [errors, setErrors] = useState<ReturnType<typeof validateManualDraft>>({})
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const originalFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    panel.current?.querySelector<HTMLElement>(sourceLocked ? '#kw-entry-interpretation' : '#kw-entry-title')?.focus()
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCancel() }
      if (event.key === 'Tab') {
        const targets = Array.from(panel.current?.querySelectorAll<HTMLElement>('input, select, textarea, button:not(:disabled), [href]') ?? [])
        const first = targets[0], last = targets.at(-1)
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKeyDown); originalFocus?.focus() }
    // The dialog owns focus for its lifetime; the parent callback always closes this instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  function submit(event: FormEvent) {
    event.preventDefault()
    const next = { ...draft, gaps: lines(gaps) }
    const validation = validateManualDraft(next, today)
    setErrors(validation)
    if (Object.keys(validation).length) {
      const field = Object.keys(validation)[0]
      panel.current?.querySelector<HTMLElement>(`[name="${field}"]`)?.focus()
      return
    }
    onSave(next)
  }
  const update = <K extends keyof ManualEntryDraft>(key: K, value: ManualEntryDraft[K]) => setDraft((current) => ({ ...current, [key]: value }))
  return <div className="kw-modal-backdrop"><div className="kw-editor" role="dialog" aria-modal="true" aria-labelledby="kw-editor-title" ref={panel}>
    <header><div><h2 id="kw-editor-title">{sourceLocked ? '修正 AI 解释' : entry ? '编辑为新版本' : '新增记录'}</h2><p>{entry ? `保存为 v${entry.version + 1}，v${entry.version} 仍可在历史中查看。` : '先记下原话，解释和定义可以稍后补充。'}</p></div><button type="button" aria-label="关闭编辑表单" onClick={onCancel}><StudioIcon name="close" size={20} /></button></header>
    <form onSubmit={submit} noValidate>
      <div className="kw-editor-body">
        {error ? <p className="kw-alert" role="alert">{error}</p> : null}
        <div className="kw-form-row"><div><label htmlFor="kw-entry-type">记录类型</label><select id="kw-entry-type" name="type" disabled={sourceLocked} value={draft.type} onChange={(event) => update('type', event.target.value as ExperienceType)}>{(Object.keys(TYPE_LABELS) as ExperienceType[]).map((key) => <option value={key} key={key}>{TYPE_LABELS[key]}</option>)}</select></div><div><label htmlFor="kw-entry-stock">股票（可选）</label><input id="kw-entry-stock" name="stock" readOnly={sourceLocked} value={draft.stock ?? ''} onChange={(event) => update('stock', event.target.value)} placeholder="如：新易盛 300502" aria-invalid={Boolean(errors.stock)} aria-describedby={errors.stock ? 'kw-stock-error' : undefined} />{errors.stock ? <small className="kw-field-error" id="kw-stock-error">{errors.stock}</small> : null}</div></div>
        <label htmlFor="kw-entry-title">标题</label><input id="kw-entry-title" name="title" readOnly={sourceLocked} value={draft.title} onChange={(event) => update('title', event.target.value)} placeholder="用一句话概括这条记录" aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? 'kw-title-error' : undefined} maxLength={120} />{errors.title ? <small className="kw-field-error" id="kw-title-error">{errors.title}</small> : null}
        <label htmlFor="kw-entry-text">原始内容</label><textarea id="kw-entry-text" name="originalText" readOnly={sourceLocked} rows={4} value={draft.originalText} onChange={(event) => update('originalText', event.target.value)} placeholder="保留原话，也可以记录发生的场景和你的疑问。" aria-invalid={Boolean(errors.originalText)} aria-describedby={errors.originalText ? 'kw-text-error' : undefined} />{errors.originalText ? <small className="kw-field-error" id="kw-text-error">{errors.originalText}</small> : null}
        {draft.type === 'hint' ? <><label htmlFor="kw-entry-expiry">提示有效期（可选）</label><input id="kw-entry-expiry" name="expiresOn" type="date" min={today} value={draft.expiresOn ?? ''} onChange={(event) => update('expiresOn', event.target.value)} aria-invalid={Boolean(errors.expiresOn)} aria-describedby={errors.expiresOn ? 'kw-expiry-error' : 'kw-expiry-help'} /><small id="kw-expiry-help">到期后保留历史，标记为仅供回看。</small>{errors.expiresOn ? <small className="kw-field-error" id="kw-expiry-error">{errors.expiresOn}</small> : null}</> : null}
        <details className="kw-form-extras" open={sourceLocked || Boolean(entry?.interpretation)}><summary>补充你的解释与缺失定义（可选）</summary><label htmlFor="kw-entry-interpretation">{sourceLocked ? '修正后的解释' : '你的解释'}</label><textarea id="kw-entry-interpretation" name="interpretation" rows={3} value={draft.interpretation} onChange={(event) => update('interpretation', event.target.value)} placeholder="适用于什么场景？条件、行动和失效情况分别是什么？" /><label htmlFor="kw-entry-gaps">仍需补充的定义</label><textarea id="kw-entry-gaps" rows={3} value={gaps} onChange={(event) => setGaps(event.target.value)} placeholder="每行一项，例如：大涨的幅度尚未明确。" /></details>
        <p className="kw-form-note">{sourceLocked ? '原文、类型和来源保持只读；修正解释会生成待确认的新版本，旧版研究结果需要重新检验。' : '经验、原则和临时提示会分别保存。没有解释时保留为待整理原文；这里不会自动生成 AI 分析。'}</p>
      </div><footer><button className="kw-button" type="button" onClick={onCancel}>取消</button><button className="kw-button kw-primary" type="submit">{entry ? '保存新版本' : '保存记录'}</button></footer>
    </form>
  </div></div>
}

function BacktestEvidence({ data }: { data: KnowledgePackage }) {
  const [horizon, setHorizon] = useState(3)
  const result = data.backtest
  const models = result.models.filter((model) => model.horizon === horizon)
  const maxMape = Math.max(...models.map((model) => model.mape), 0.01)
  return <section className="kw-backtest" id="kw-panel-backtest" role="tabpanel" aria-labelledby="kw-tab-backtest">
    <div className="kw-backtest-heading"><div><span className="kw-eyebrow">历史回溯验证</span><h2>新易盛 <span>300502</span></h2><p>用真实历史日 K，检验经验能否改善未来 {horizon} 日推演。</p></div><div className="kw-horizon" role="group" aria-label="预测时间范围">{[3, 4].map((day) => <button type="button" key={day} aria-pressed={horizon === day} onClick={() => setHorizon(day)}>未来 {day} 日</button>)}</div></div>
    <div className="kw-evidence-verdict"><StudioIcon name="target" size={25} /><div><span>本次研究结论</span><h3>尚未证实经验规则带来稳定优势</h3><p>价格预测误差与方向判断需要对照基线评估；这些结果不构成交易收益证明。</p></div></div>
    <dl className="kw-backtest-facts"><div><dt>行情区间</dt><dd>{result.start} — {result.end}</dd></div><div><dt>日 K 样本</dt><dd>{result.sessions} <small>个交易日</small></dd></div><div><dt>留出测试起点</dt><dd>{result.holdoutStart}</dd></div><div><dt>资料生成日期</dt><dd>{data.generatedAt.slice(0, 10)}</dd></div></dl>
    <div className="kw-comparison-heading"><h3>模型对照</h3><p>MAPE 越低，价格的平均相对误差越小</p></div>
    <div className="kw-table-scroll" tabIndex={0} role="region" aria-label="模型误差对照表"><table><thead><tr><th scope="col">预测方法</th><th scope="col">价格误差 MAPE</th><th scope="col">方向一致率</th><th scope="col">测试样本</th></tr></thead><tbody>{models.map((model) => <tr key={`${model.horizon}-${model.id}`}><th scope="row">{model.label}<small>{model.id}</small></th><td><strong>{model.mape.toFixed(2)}%</strong><div className="kw-metric-track" aria-hidden="true"><i style={{ width: `${Math.max(2, model.mape / maxMape * 100)}%` }} /></div></td><td>{model.direction === null ? <span className="kw-muted">不适用</span> : `${model.direction.toFixed(2)}%`}</td><td>{model.samples}</td></tr>)}</tbody></table>{!models.length ? <p className="kw-empty">当前资料没有这个期限的结果。</p> : null}</div>
    <div className="kw-evidence-grid"><section><h3>结果如何理解</h3><ul>{result.findings.map((finding, index) => <li key={index}>{finding}</li>)}</ul></section><section><h3>验证方法</h3><ol>{result.methodology.map((method, index) => <li key={index}>{method}</li>)}</ol></section></div>
    <details className="kw-source-quality"><summary>数据口径与局限</summary><ul>{result.sourceQuality.map((quality, index) => <li key={index}>{quality}</li>)}</ul><p>来源文档 {data.docCount} 份 · 知识版本 <code>{data.sourceCommit}</code></p></details>
  </section>
}
