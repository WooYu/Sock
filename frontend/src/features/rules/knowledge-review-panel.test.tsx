import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { KnowledgeReviewPanel, type KnowledgeReviewClient } from './knowledge-review-panel'
import type { KnowledgeDraft } from '@/lib/api/knowledge-client'

const draft: KnowledgeDraft = {
  id: 'draft-1',
  sourceDocumentId: 'source-1',
  kind: 'RULE',
  title: '回踩 MA5 后再参与',
  summary: '价格站上 MA5，回踩不破后再观察。',
  sourceExcerpt: '价格站上 MA5，回踩不破后再参与。',
  sourceLineStart: 18,
  sourceLineEnd: 18,
  extractionMethod: 'AI',
  status: 'PENDING',
  action: 'ENTER',
  mode: 'BASE_GRANVILLE',
  timeframe: '日线',
  priority: 40,
}

const conceptDraft: KnowledgeDraft = {
  ...draft,
  id: 'draft-2',
  kind: 'CONCEPT',
  title: '趋势优先',
}

function createClient(): KnowledgeReviewClient {
  return {
    listDrafts: async () => [draft],
    listSources: async () => [{
      id: 'source-1',
      path: '印象笔记/股票/买股原则2.md',
      title: '买股原则2',
      contentHash: 'hash-1',
      originalContent: '# 买股原则2\n\n价格站上 MA5，回踩不破后再参与。',
      importedAt: '2026-08-31T00:00:00Z',
    }],
    approveDraft: async (id) => ({ ...draft, id, status: 'APPROVED' }),
    publishDraft: async (id) => ({ id: 'published-1', name: draft.title, description: draft.summary, sourceDocumentId: id, enabled: true }),
  }
}

describe('KnowledgeReviewPanel', () => {
  test('shows source evidence and approves a pending draft', async () => {
    const user = userEvent.setup()
    render(<KnowledgeReviewPanel client={createClient()} />)

    expect(await screen.findByText('回踩 MA5 后再参与')).toBeInTheDocument()
    expect(screen.getByText(/第\s*18\s*行/)).toBeInTheDocument()
    expect(screen.getByText('价格站上 MA5，回踩不破后再参与。')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '批准回踩 MA5 后再参与' }))
    expect(await screen.findByText('已批准，等待发布')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '发布回踩 MA5 后再参与' })).toBeInTheDocument()
  })

  test('publishes only an approved draft and reports completion', async () => {
    const user = userEvent.setup()
    render(<KnowledgeReviewPanel client={{ ...createClient(), listDrafts: async () => [{ ...draft, status: 'APPROVED' }] }} />)

    await user.click(await screen.findByRole('button', { name: '发布回踩 MA5 后再参与' }))
    expect(await screen.findByText('规则已发布')).toBeInTheDocument()
    expect(screen.getByText('当前视图暂无草稿')).toBeInTheDocument()
  })

  test('filters rejected drafts without mixing them into pending review', async () => {
    const user = userEvent.setup()
    render(<KnowledgeReviewPanel client={{ ...createClient(), listDrafts: async () => [draft, { ...draft, id: 'draft-2', title: '已拒绝概念', kind: 'CONCEPT', status: 'REJECTED' }] }} />)

    await screen.findByText('回踩 MA5 后再参与')
    await user.click(screen.getByRole('tab', { name: '已拒绝 1' }))
    expect(screen.getByText('已拒绝概念')).toBeVisible()
    expect(screen.queryByText('回踩 MA5 后再参与')).not.toBeInTheDocument()
  })

  test('shows the current draft count and opens the complete source note', async () => {
    const user = userEvent.setup()
    render(<KnowledgeReviewPanel client={createClient()} />)

    expect(await screen.findByText('共 1 条')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '对照原文 回踩 MA5 后再参与' }))

    const dialog = await screen.findByRole('dialog', { name: '原文对照 买股原则2' })
    expect(dialog).toBeVisible()
    expect(dialog).toHaveTextContent('印象笔记/股票/买股原则2.md')
    expect(dialog).toHaveTextContent('价格站上 MA5，回踩不破后再参与。')
  })

  test('shows counts on tabs and groups drafts from the same note', async () => {
    render(<KnowledgeReviewPanel client={{ ...createClient(), listDrafts: async () => [draft, { ...draft, id: 'draft-3', title: '二次确认' }, conceptDraft] }} />)

    expect(await screen.findByRole('tab', { name: '待审核 2' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '经验概念 1' })).toBeInTheDocument()
    expect(screen.getAllByText('买股原则2.md · 提取 2 条')).toHaveLength(1)
  })

  test('opens source comparison with the matched line highlighted', async () => {
    const user = userEvent.setup()
    render(<KnowledgeReviewPanel client={createClient()} />)

    await user.click(await screen.findByRole('button', { name: '对照原文 回踩 MA5 后再参与' }))
    const dialog = await screen.findByRole('dialog', { name: '原文对照 买股原则2' })
    expect(dialog.querySelector('mark')).toHaveTextContent('价格站上 MA5，回踩不破后再参与。')
    expect(screen.getByText('本笔记提取 1 条')).toBeInTheDocument()
    expect(screen.getByText('展开完整笔记')).toBeInTheDocument()
  })

  test('keeps drafts available when source-note loading fails', async () => {
    render(<KnowledgeReviewPanel client={{ ...createClient(), listSources: async () => { throw new Error('offline') } }} />)

    expect(await screen.findByText('回踩 MA5 后再参与')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /对照原文/ })).not.toBeInTheDocument()
  })
})
