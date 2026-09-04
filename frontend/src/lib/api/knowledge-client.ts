import { getAuthorizationHeader } from '@/features/records/record-sync'
import type { RuleCondition } from '@/features/workspace/stock-workspace-types'

export type KnowledgeSource = { id: string; path: string; title: string; contentHash: string; originalContent: string; importedAt: string }
export type KnowledgeDraft = {
  id: string
  sourceDocumentId: string
  kind: string
  title: string
  summary: string
  sourceExcerpt: string
  sourceLineStart: number
  sourceLineEnd: number
  extractionMethod: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  action?: string
  mode?: string
  timeframe?: string
  priority?: number
}
export type PublishedKnowledgeRule = { id: string; name: string; description?: string; sourceDocumentId?: string; enabled: boolean; conditions?: RuleCondition[]; action?: string; mode?: string; timeframe?: string; priority?: number }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, cache: 'no-store', headers: { Accept: 'application/json', ...init?.headers } })
  if (!response.ok) throw new Error(`知识库请求失败：${response.status}`)
  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}

export function importKnowledgeSource(path: string, content: string) {
  const authorization = typeof window === 'undefined' ? undefined : getAuthorizationHeader()
  return request<KnowledgeSource>('/api/knowledge/sources', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) }, body: JSON.stringify({ path, content }) })
}

export function extractKnowledgeSource(id: string) {
  const authorization = typeof window === 'undefined' ? undefined : getAuthorizationHeader()
  return request<unknown[]>(`/api/knowledge/sources/${encodeURIComponent(id)}/extract`, { method: 'POST', headers: authorization ? { Authorization: authorization } : undefined })
}

export function getPublishedKnowledgeRules() {
  const authorization = typeof window === 'undefined' ? undefined : getAuthorizationHeader()
  return request<PublishedKnowledgeRule[]>('/api/knowledge/rules', { headers: authorization ? { Authorization: authorization } : undefined })
}

export function togglePublishedKnowledgeRule(id: string, enabled: boolean) {
  const authorization = typeof window === 'undefined' ? undefined : getAuthorizationHeader()
  return request<PublishedKnowledgeRule>(`/api/knowledge/rules/${encodeURIComponent(id)}/enabled`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) },
    body: JSON.stringify({ enabled }),
  })
}

export function getKnowledgeDrafts(status?: KnowledgeDraft['status']) {
  const authorization = typeof window === 'undefined' ? undefined : getAuthorizationHeader()
  const query = status ? `?status=${status}` : ''
  return request<KnowledgeDraft[]>(`/api/knowledge/drafts${query}`, { headers: authorization ? { Authorization: authorization } : undefined })
}

export function approveKnowledgeDraft(id: string) {
  const authorization = typeof window === 'undefined' ? undefined : getAuthorizationHeader()
  return request<KnowledgeDraft>(`/api/knowledge/drafts/${encodeURIComponent(id)}/approve`, { method: 'POST', headers: authorization ? { Authorization: authorization } : undefined })
}

export function publishKnowledgeDraft(id: string) {
  const authorization = typeof window === 'undefined' ? undefined : getAuthorizationHeader()
  return request<PublishedKnowledgeRule>(`/api/knowledge/drafts/${encodeURIComponent(id)}/publish`, { method: 'POST', headers: authorization ? { Authorization: authorization } : undefined })
}
