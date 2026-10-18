'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { importStudy, listStudyVersions } from '../scenario/scenario-api'
import { getResearchIdentity, RESEARCH_IDENTITY_EVENT, type ResearchIdentity } from '../scenario/research-identity'
import type { NoteStudyRevision } from '../scenario/scenario-record-types'
import type { NoteStudyIndex, NoteStudyProposal } from './note-study-types'
import { saveStudySelection } from './note-study-selections'
import { TAG_LABELS, type NoteTagRecord } from './note-tags'

const ROLES: Record<string, string> = { trend: '趋势', granville_stage: '葛阶段', parameter_formula: '参数公式', method_selection: '方法选择', support_resistance: '支撑压力', mode: '盈利模式', risk: '交易风险', validation: '验证', context: '背景' }
const COMPUTABILITY: Record<string, string> = { direct: '可直接表达的计算', needs_definition: '缺定义，暂不能直接计算', needs_data: '缺数据', reference: '解释与参考' }
async function proposalRequest<T>(file: string | null, signal: AbortSignal): Promise<T> {
  const response = await fetch('/api/note-study-proposals' + (file ? '?file=' + encodeURIComponent(file) : ''), { signal, cache: 'no-store' })
  if (!response.ok) throw new Error('逐篇学习资料读取失败，请重试')
  return response.json()
}
export function NoteStudyWorkbench({ currentTags = [] }: { currentTags?: NoteTagRecord[] }) {
  const [index, setIndex] = useState<NoteStudyIndex | null>(null), [query, setQuery] = useState(''), [file, setFile] = useState('')
  const [error, setError] = useState(''), [reload, setReload] = useState(0)
  const detailRef = useRef<HTMLDivElement>(null)
  function choose(file: string) {
    setFile(file)
    if (window.matchMedia?.('(max-width: 760px)').matches) {
      detailRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
      detailRef.current?.focus({ preventScroll: true })
    }
  }
  useEffect(() => {
    const controller = new AbortController()
    void proposalRequest<NoteStudyIndex>(null, controller.signal).then(value => { if (!controller.signal.aborted) { setIndex(value); setError('') } }).catch(cause => { if (!controller.signal.aborted) setError(cause.message) })
    return () => controller.abort()
  }, [reload])
  const entries = useMemo(() => index?.entries.filter(e => [e.file, e.title, e.summary, ...e.tags.map(t => TAG_LABELS[t] ?? t), ...e.roles.map(r => ROLES[r] ?? r)].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) ?? [], [index, query])
  const selected = entries.find(e => e.file === file) ?? entries[0]
  return <section className="nt-study" aria-label="逐篇学习建议">
    <div className="nt-heading"><div><h2>逐篇学习建议</h2>{index ? <p>{index.documentCount}篇完成文字阅读 · {index.claimCount}条计算主张 · {index.uninspectedAttachmentCount}篇附件待核对</p> : <p>正在读取逐篇学习索引…</p>}</div></div>
    <p className="nt-disclaimer">AI候选与人工标签分开保存；解释被选用、定义可计算和预测效果已验证分别记录。</p>
    {error ? <p role="alert">{error} <button type="button" onClick={() => setReload(n => n + 1)}>重试学习资料</button></p> : null}
    <label className="nt-study-search">搜索逐篇学习<input value={query} onChange={e => setQuery(e.target.value)} placeholder="笔记名、趋势、方法、MA5…" /></label>
    <div className="nt-columns"><section className="nt-list nt-study-list" aria-label="逐篇学习目录">
      <div className="nt-list-heading"><strong>研究笔记</strong><span role="status">{entries.length} 条结果</span></div>
      {entries.map(entry => <button className="nt-record nt-study-record" type="button" key={entry.file} aria-label={`查看学习建议：${entry.title}`} aria-pressed={entry.file === selected?.file} onClick={() => choose(entry.file)}><strong>{entry.title}</strong><small>{entry.file}</small><span>{entry.claimCount}条主张 · {entry.roles.map(r => ROLES[r] ?? r).join('、')}</span><small>{entry.attachmentStatus === 'not_inspected' ? '文字已读，附件未核对' : '文字已读'}</small></button>)}
      {index && !entries.length ? <p>没有匹配的研究笔记。</p> : null}
    </section>{selected ? <div ref={detailRef} tabIndex={-1} className="nt-study-detail"><StudyDetail key={selected.file} file={selected.file} currentTags={currentTags} /></div> : null}</div>
  </section>
}
function StudyDetail({ file, currentTags }: { file: string; currentTags: NoteTagRecord[] }) {
  const [proposal, setProposal] = useState<NoteStudyProposal | null>(null), [versions, setVersions] = useState<NoteStudyRevision[]>([]), [cursor, setCursor] = useState<string | null>(null)
  const [stored, setStored] = useState<NoteStudyRevision | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState(''), [historyError, setHistoryError] = useState('')
  const [reload, setReload] = useState(0), alive = useRef(true)
  useEffect(() => {
    alive.current = true
    const changed = () => { setStored(null); setVersions([]); setMessage(''); setBusy(false); setReload(n => n + 1) }
    window.addEventListener(RESEARCH_IDENTITY_EVENT, changed)
    const storageChanged = (event: StorageEvent) => { if (event.key === null || event.key === 'stockcal.accessToken' || event.key === 'stockcal:sync-client-id') changed() }
    window.addEventListener('storage', storageChanged)
    return () => { alive.current = false; window.removeEventListener(RESEARCH_IDENTITY_EVENT, changed); window.removeEventListener('storage', storageChanged) }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    void proposalRequest<NoteStudyProposal>(file, controller.signal).then(value => { if (!controller.signal.aborted) { setProposal(value); setError('') } }).catch(cause => { if (!controller.signal.aborted) setError(cause.message) })
    void listStudyVersions(file, undefined, controller.signal).then(page => {
      if (controller.signal.aborted) return
      setVersions(page.items); setCursor(page.nextCursor); setHistoryError('')
      const existing = page.items.find(v => v.channel === 'ai_semantic' && v.payload.file === file)
      if (existing) setStored(existing)
    }).catch(() => { if (!controller.signal.aborted) setHistoryError('研究版本库暂未连接，仍可阅读文字建议。') })
    return () => controller.abort()
  }, [file, reload])
  useEffect(() => {
    const controller = new AbortController()
    const reloadShared = () => {
      if (busy) return
      void listStudyVersions(file, undefined, controller.signal).then(page => {
        if (controller.signal.aborted) return
        setVersions(old => [...page.items, ...old.filter(v => !page.items.some(next => next.id === v.id))])
      }).catch(() => undefined)
    }
    const timer = setInterval(reloadShared, 10000)
    window.addEventListener('focus', reloadShared)
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener('focus', reloadShared) }
  }, [file, busy])
  const study = proposal?.study, current = currentTags.find(r => r.level === 'document' && r.file === file)
  const added = study?.tags.filter(t => !current?.tags.includes(t)) ?? [], removed = current?.tags.filter(t => !study?.tags.includes(t)) ?? []
  const exactStored = [stored, ...versions].find(v => v?.channel === 'ai_semantic' && v.sourceHash === study?.sourceHash && v.payload.studyRevisionId === study?.studyRevisionId) ?? null
  async function save() {
    if (!proposal) return
    setBusy(true); setError(''); setMessage('')
    let owner: ResearchIdentity | null = null
    try {
      owner = await getResearchIdentity()
      if (!owner.isCurrent()) return
      const revision = await importStudy({ sourceFile: file, sourceHash: proposal.study.sourceHash, sourceText: proposal.sourceText, sourceUrl: proposal.study.sourceUrl,
        channel: 'ai_semantic', parentRevisionId: null, legacyKey: null, payload: { ...proposal.study } })
      if (!alive.current || !owner.isCurrent()) return
      if (!/^[a-f0-9-]{36}$/i.test(revision.id) || revision.sourceHash !== proposal.study.sourceHash || revision.sourceFile !== file) throw new Error('研究入库回执不一致，请重试核实')
      setStored(revision); setVersions(old => [revision, ...old.filter(v => v.id !== revision.id)]); setMessage('研究建议已入库；效果仍为未测试。')
    } catch (cause) { if (alive.current && (!owner || owner.isCurrent())) setError(cause instanceof Error ? cause.message : '研究入库失败') }
    finally { if (alive.current && (!owner || owner.isCurrent())) setBusy(false) }
  }
  async function select(revision: NoteStudyRevision) {
    try {
      const owner = await getResearchIdentity(); if (!owner.isCurrent() || !alive.current) return
      saveStudySelection(owner.scope, revision); setMessage('已选用该研究版本作为后续分析依据，仍未启用新公式。')
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : '选择未保存') }
  }
  async function moreVersions() {
    if (!cursor) return
    const owner = await getResearchIdentity()
    try { const page = await listStudyVersions(file, cursor); if (alive.current && owner.isCurrent()) { setVersions(old => [...old, ...page.items.filter(v => !old.some(o => o.id === v.id))]); setCursor(page.nextCursor) } }
    catch { if (alive.current && owner.isCurrent()) setHistoryError('历史版本读取失败，请重试') }
  }
  return <section className="nt-detail" aria-label="逐篇学习详情">
    {error ? <p role="alert">{error}<button type="button" onClick={() => setReload(n => n + 1)}>重新读取</button></p> : null}
    {message ? <p className="kw-notice" role="status">{message}</p> : null}
    {study ? <>
      <div className="nt-detail-heading"><span>AI语义候选 · 效果未测试</span><h3>{file}</h3><p>{study.summary}</p></div>
      <p>文字覆盖 L{study.readCoverage.fromLine}–{study.readCoverage.throughLine} · {study.attachments.status === 'not_inspected' ? '附件未检查' : '无待检附件'}</p>
      <p>{study.roles.map(r => ROLES[r] ?? r).join(' · ')}</p>
      <p className="nt-disclaimer">BOLL期别与葛阶段分别核对；笔记中的阶段标签不能确定股票当前处于葛几。</p>
      <section><h4>与当前标签对照{current ? ` · 人工／原始版本 v${current.version}` : ''}</h4>
        {current && current.sourceHash !== study.sourceHash ? <p>原文版本不同，标签仅作对照，未合并。</p> : null}
        <p>建议新增：{added.map(t => TAG_LABELS[t] ?? t).join('、') || '无'}</p><p>建议移出：{removed.map(t => TAG_LABELS[t] ?? t).join('、') || '无'}</p>
        <p className="nt-chips">{study.tags.map(t => <span key={t}>{TAG_LABELS[t] ?? t}</span>)}</p>
      </section>
      <div className="nt-detail-actions"><button className="kw-button" type="button" disabled={busy} onClick={() => { void save() }}>{busy ? '正在入库…' : '保存研究建议'}</button>
        <button className="kw-button kw-primary" type="button" disabled={!exactStored || busy} onClick={() => { if (exactStored) void select(exactStored) }}>选为后续分析依据</button></div>
      <section><h4>计算主张 · {study.claims.length}条</h4>{study.claims.map(claim => <article className="nt-study-claim" key={claim.claimId}>
        <h5>{claim.name}</h5><p>{COMPUTABILITY[claim.computability]} · 效果未测试</p><p>{claim.formula ? <code>{claim.formula}</code> : '数值公式尚未定义'}</p>
        <p>输入：{claim.inputs.join('、')} · 原文周期：{claim.periods.join('、') || '未明确'}</p>
        <p>适用条件：{claim.applicability.join('；') || '原文未明确'}</p><p>失效条件：{claim.invalidation.join('；') || '原文未明确'}</p>
        {claim.gaps.length ? <ul>{claim.gaps.map((gap, i) => <li key={i}>{gap}</li>)}</ul> : null}
        {claim.evidence.map((e, i) => <blockquote key={i}><small>L{e.startLine}–{e.endLine}</small>{e.quote}</blockquote>)}
      </article>)}</section>
      {study.gaps.length ? <section><h4>定义与资料缺口</h4><ul>{study.gaps.map((gap, i) => <li key={i}>{gap}</li>)}</ul></section> : null}
      {study.userRuleConflicts.length ? <section><h4>与当前使用原则的差异</h4><ul>{study.userRuleConflicts.map((conflict, i) => <li key={i}>{conflict}</li>)}</ul></section> : null}
      <p>{study.attachments.note}</p>
      <details className="nt-evidence"><summary>逐标签原文依据 · {study.evidence.length}条</summary>{study.evidence.map((e, i) => <div key={i}><strong>{TAG_LABELS[e.tagId] ?? e.tagId} · L{e.startLine}–{e.endLine}</strong><blockquote>{e.quote}</blockquote><p>{e.reason}</p></div>)}</details>
      <details><summary>冻结原文与研究版本</summary><p className="nt-source-hash">原文SHA-256：{study.sourceHash}<br />研究版本：{study.studyRevisionId}</p><pre className="nt-study-source">{proposal?.sourceText}</pre><a href={study.sourceUrl} target="_blank" rel="noopener noreferrer">查看来源笔记</a></details>
    </> : <p>正在读取该篇原文与研究…</p>}
    <details><summary>已载入的研究历史 · {versions.length}个版本</summary>{historyError ? <p>{historyError}</p> : null}
      {versions.map(version => <div className="nt-study-version" key={version.id}><span>{version.channel === 'ai_semantic' ? 'AI语义候选' : version.channel === 'legacy' ? '原标签版本' : '人工解释'} · {version.createdAt} · 效果未测试</span><button type="button" onClick={() => { void select(version) }}>选用此研究版本</button></div>)}
      {cursor ? <button type="button" onClick={() => { void moreVersions() }}>继续载入研究历史</button> : null}
    </details>
  </section>
}
