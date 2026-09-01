import { getAuthorizationHeader } from '@/features/records/record-sync'

export type KnowledgeSource = { id: string; path: string; title: string; contentHash: string; originalContent: string; importedAt: string }

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
  return request<Array<Record<string, unknown>>>('/api/knowledge/rules', { headers: authorization ? { Authorization: authorization } : undefined })
}
