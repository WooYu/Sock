'use client'

import { Fragment, useEffect, useState } from 'react'
import {
  approveKnowledgeDraft,
  getKnowledgeDrafts,
  getKnowledgeSources,
  publishKnowledgeDraft,
  type KnowledgeDraft,
  type KnowledgeSource,
  type PublishedKnowledgeRule,
} from '@/lib/api/knowledge-client'

export type KnowledgeReviewClient = {
  listDrafts: () => Promise<KnowledgeDraft[]>
  listSources: () => Promise<KnowledgeSource[]>
  approveDraft: (id: string) => Promise<KnowledgeDraft>
  publishDraft: (id: string) => Promise<PublishedKnowledgeRule>
}

type ReviewDraft = Omit<KnowledgeDraft, 'status'> & { status: KnowledgeDraft['status'] | 'PUBLISHED' }
type DraftView = 'pending' | 'concept' | 'rejected'
type SourceComparison = { source: KnowledgeSource; draft: ReviewDraft }

const defaultClient: KnowledgeReviewClient = {
  listDrafts: () => getKnowledgeDrafts(),
  listSources: getKnowledgeSources,
  approveDraft: approveKnowledgeDraft,
  publishDraft: publishKnowledgeDraft,
}

export function KnowledgeReviewPanel({ client = defaultClient, onPublished }: { client?: KnowledgeReviewClient; onPublished?: (rule: PublishedKnowledgeRule) => void }) {
  const [drafts, setDrafts] = useState<ReviewDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [view, setView] = useState<DraftView>('pending')
  const [sources, setSources] = useState<KnowledgeSource[]>([])
  const [comparison, setComparison] = useState<SourceComparison | null>(null)
  const draftsFor = (target: DraftView) => drafts.filter((draft) => target === 'pending'
    ? draft.kind === 'RULE' && (draft.status === 'PENDING' || draft.status === 'APPROVED')
    : target === 'concept'
      ? draft.kind !== 'RULE' && draft.status !== 'REJECTED'
      : draft.status === 'REJECTED')
  const visibleDrafts = draftsFor(view)
  const counts: Record<DraftView, number> = { pending: draftsFor('pending').length, concept: draftsFor('concept').length, rejected: draftsFor('rejected').length }

  useEffect(() => {
    let active = true
    void client.listDrafts().then((items) => {
      if (!active) return
      setDrafts(items)
    }).catch((error) => {
      if (active) setErrorMessage(error instanceof Error ? error.message : '知识草稿暂时不可用')
    }).finally(() => {
      if (active) setLoading(false)
    })
    void client.listSources().then((items) => {
      if (active) setSources(items)
    }).catch(() => undefined)
    return () => { active = false }
  }, [client])

  const sourceFor = (draft: ReviewDraft) => sources.find((source) => source.id === draft.sourceDocumentId)
  const groups = Object.values(Object.groupBy(visibleDrafts, (draft) => draft.sourceDocumentId)) as ReviewDraft[][]
  const relatedDrafts = comparison ? drafts.filter((draft) => draft.sourceDocumentId === comparison.source.id) : []

  const approve = async (draft: ReviewDraft) => {
    setBusyId(draft.id)
    setMessage('')
    try {
      const approved = await client.approveDraft(draft.id)
      setDrafts((items) => items.map((item) => item.id === draft.id ? { ...item, ...approved, status: 'APPROVED' } : item))
      setMessage('已批准，等待发布')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '知识草稿批准失败')
    } finally { setBusyId(null) }
  }

  const publish = async (draft: ReviewDraft) => {
    setBusyId(draft.id)
    setMessage('')
    try {
      const published = await client.publishDraft(draft.id)
      setDrafts((items) => items.map((item) => item.id === draft.id ? { ...item, status: 'PUBLISHED' } : item))
      onPublished?.(published)
      setMessage('规则已发布')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '知识规则发布失败')
    } finally { setBusyId(null) }
  }

  return <section className="sc-review-panel" aria-labelledby="knowledge-review-title">
    <div><p className="sc-eyebrow">AI 提取 · 人工确认</p><div className="sc-review-title-row"><h2 id="knowledge-review-title">知识草稿审核</h2><span>共 {drafts.length} 条</span></div><p>对照原始笔记确认 AI 提取结果；只有批准并发布的 RULE 才会参与分析。</p></div>
    <div aria-label="知识草稿视图" className="sc-review-tabs" role="tablist">{([['pending', '待审核'], ['concept', '经验概念'], ['rejected', '已拒绝']] as Array<[DraftView, string]>).map(([key, label]) => <button aria-selected={view === key} key={key} onClick={() => setView(key)} role="tab" type="button">{label} <span>{counts[key]}</span></button>)}</div>
    {loading ? <p className="sc-review-empty" role="status">正在加载知识草稿…</p> : visibleDrafts.length === 0 ? <p className="sc-review-empty">当前视图暂无草稿</p> : <div className="sc-review-list">
      {groups.map((group) => { const source = sourceFor(group[0]); return <section className="sc-review-source-group" key={group[0].sourceDocumentId}><header><div><strong>{source ? `${fileName(source.path)} · 提取 ${group.length} 条` : `来源 ${group[0].sourceDocumentId}`}</strong>{source ? <span>{source.path}</span> : null}</div></header><div className="sc-review-source-drafts">{group.map((draft) => <article className="sc-review-card" key={draft.id}>
        <div className="sc-review-card-heading"><div><span className="sc-review-kind">{draft.kind}</span><h3>{draft.title}</h3></div><span className={`sc-review-status ${draft.status.toLowerCase()}`}>{reviewStatus(draft.status)}</span></div>
        <p className="sc-review-summary">{draft.summary || '暂无摘要'}</p>
        <blockquote>{draft.sourceExcerpt || '暂无原文摘录'}</blockquote>
        <p className="sc-review-source">{lineRange(draft.sourceLineStart, draft.sourceLineEnd)} · {draft.extractionMethod}</p>
        {draft.action || draft.mode || draft.timeframe ? <p className="sc-review-meta">{draft.action ? `动作 ${draft.action}` : ''}{draft.mode ? ` · 模式 ${draft.mode}` : ''}{draft.timeframe ? ` · 周期 ${draft.timeframe}` : ''}</p> : null}
        <div className="sc-review-actions">
          {source ? <button aria-label={`对照原文 ${draft.title}`} className="sc-review-note-button" onClick={() => setComparison({ source, draft })} type="button">对照原文</button> : null}
          {draft.status === 'PENDING' ? <button disabled={busyId === draft.id} onClick={() => void approve(draft)} type="button">{busyId === draft.id ? '处理中…' : `批准${draft.title}`}</button> : null}
          {draft.status === 'APPROVED' ? <button disabled={busyId === draft.id} onClick={() => void publish(draft)} type="button">{busyId === draft.id ? '发布中…' : `发布${draft.title}`}</button> : null}
        </div>
      </article>)}</div></section> })}
    </div>}
    {errorMessage ? <p className="sc-review-error" role="alert">{errorMessage}</p> : null}
    {message ? <p className="sc-review-message" role="status">{message}</p> : null}
    {comparison ? <div className="sc-note-comparison-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setComparison(null)}><aside aria-label={`原文对照 ${comparison.source.title}`} aria-modal="true" className="sc-note-comparison" role="dialog"><header><div><p className="sc-eyebrow">原文对照</p><h2>{comparison.source.title}</h2><p>{comparison.source.path}</p></div><button aria-label="关闭原文对照" onClick={() => setComparison(null)} type="button">×</button></header><section className="sc-note-match"><span>{lineRange(comparison.draft.sourceLineStart, comparison.draft.sourceLineEnd)}</span><p>{highlightExcerpt(comparison.source.originalContent, comparison.draft.sourceExcerpt)}</p></section><div className="sc-note-related"><strong>本笔记提取 {relatedDrafts.length} 条</strong><div>{relatedDrafts.map((draft) => <button aria-current={draft.id === comparison.draft.id} key={draft.id} onClick={() => setComparison({ source: comparison.source, draft })} type="button">{draft.title}</button>)}</div></div><section className="sc-note-full-desktop"><h3>完整笔记</h3><pre>{comparison.source.originalContent}</pre></section><details className="sc-note-full-mobile"><summary>展开完整笔记</summary><pre>{comparison.source.originalContent}</pre></details><footer><a href={githubNoteUrl(comparison.source.path)} rel="noreferrer" target="_blank">在 GitHub 查看原文</a><button onClick={() => setComparison(null)} type="button">返回审核列表</button></footer></aside></div> : null}
  </section>
}

function fileName(path: string) {
  return path.split('/').filter(Boolean).at(-1) ?? path
}

function highlightExcerpt(content: string, excerpt: string) {
  const index = excerpt ? content.indexOf(excerpt) : -1
  if (index < 0) return <mark>{excerpt || '未找到对应原文片段'}</mark>
  return <Fragment>{content.slice(Math.max(0, content.lastIndexOf('\n', index - 1) + 1), index)}<mark>{excerpt}</mark>{content.slice(index + excerpt.length, content.indexOf('\n', index + excerpt.length) < 0 ? content.length : content.indexOf('\n', index + excerpt.length))}</Fragment>
}

function githubNoteUrl(path: string) {
  return `https://github.com/WooYu/ObsidianNote/blob/main/${path.split('/').map(encodeURIComponent).join('/')}`
}

function lineRange(start: number, end: number) {
  return start === end ? `第 ${start} 行` : `第 ${start}-${end} 行`
}

function reviewStatus(status: ReviewDraft['status']) {
  return status === 'PENDING' ? '待审核' : status === 'APPROVED' ? '已批准' : status === 'PUBLISHED' ? '已发布' : '已拒绝'
}
