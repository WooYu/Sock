'use client'

import { useEffect, useState } from 'react'
import {
  approveKnowledgeDraft,
  getKnowledgeDrafts,
  publishKnowledgeDraft,
  type KnowledgeDraft,
  type PublishedKnowledgeRule,
} from '@/lib/api/knowledge-client'

export type KnowledgeReviewClient = {
  listDrafts: () => Promise<KnowledgeDraft[]>
  approveDraft: (id: string) => Promise<KnowledgeDraft>
  publishDraft: (id: string) => Promise<PublishedKnowledgeRule>
}

type ReviewDraft = Omit<KnowledgeDraft, 'status'> & { status: KnowledgeDraft['status'] | 'PUBLISHED' }

const defaultClient: KnowledgeReviewClient = {
  listDrafts: () => getKnowledgeDrafts(),
  approveDraft: approveKnowledgeDraft,
  publishDraft: publishKnowledgeDraft,
}

export function KnowledgeReviewPanel({ client = defaultClient, onPublished }: { client?: KnowledgeReviewClient; onPublished?: (rule: PublishedKnowledgeRule) => void }) {
  const [drafts, setDrafts] = useState<ReviewDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

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
    return () => { active = false }
  }, [client])

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
    <div><p className="sc-eyebrow">AI 提取 · 人工确认</p><h2 id="knowledge-review-title">待审核知识草稿</h2><p>只有批准并发布的 RULE 才会参与分析；其他经验和概念仅作为解释依据保留。</p></div>
    {loading ? <p className="sc-review-empty" role="status">正在加载知识草稿…</p> : drafts.length === 0 ? <p className="sc-review-empty">暂无待审核草稿</p> : <div className="sc-review-list">
      {drafts.map((draft) => <article className="sc-review-card" key={draft.id}>
        <div className="sc-review-card-heading"><div><span className="sc-review-kind">{draft.kind}</span><h3>{draft.title}</h3></div><span className={`sc-review-status ${draft.status.toLowerCase()}`}>{reviewStatus(draft.status)}</span></div>
        <p className="sc-review-summary">{draft.summary || '暂无摘要'}</p>
        <blockquote>{draft.sourceExcerpt || '暂无原文摘录'}</blockquote>
        <p className="sc-review-source">来源 {draft.sourceDocumentId} · {lineRange(draft.sourceLineStart, draft.sourceLineEnd)} · {draft.extractionMethod}</p>
        {draft.action || draft.mode || draft.timeframe ? <p className="sc-review-meta">{draft.action ? `动作 ${draft.action}` : ''}{draft.mode ? ` · 模式 ${draft.mode}` : ''}{draft.timeframe ? ` · 周期 ${draft.timeframe}` : ''}</p> : null}
        <div className="sc-review-actions">
          {draft.status === 'PENDING' ? <button disabled={busyId === draft.id} onClick={() => void approve(draft)} type="button">{busyId === draft.id ? '处理中…' : `批准${draft.title}`}</button> : null}
          {draft.status === 'APPROVED' ? <button disabled={busyId === draft.id} onClick={() => void publish(draft)} type="button">{busyId === draft.id ? '发布中…' : `发布${draft.title}`}</button> : null}
        </div>
      </article>)}
    </div>}
    {errorMessage ? <p className="sc-review-error" role="alert">{errorMessage}</p> : null}
    {message ? <p className="sc-review-message" role="status">{message}</p> : null}
  </section>
}

function lineRange(start: number, end: number) {
  return start === end ? `第 ${start} 行` : `第 ${start}-${end} 行`
}

function reviewStatus(status: ReviewDraft['status']) {
  return status === 'PENDING' ? '待审核' : status === 'APPROVED' ? '已批准' : status === 'PUBLISHED' ? '已发布' : '已拒绝'
}
