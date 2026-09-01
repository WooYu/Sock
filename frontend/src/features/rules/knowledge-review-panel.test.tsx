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

function createClient(): KnowledgeReviewClient {
  return {
    listDrafts: async () => [draft],
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
    expect(screen.getByText('已发布')).toBeInTheDocument()
  })
})
