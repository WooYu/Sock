import type { MarketSnapshot, Security } from '@/features/workspace/stock-workspace-types'

function backendUrl(path: string) {
  const baseUrl = process.env.STOCKCAL_API_BASE_URL
  if (!baseUrl) throw new Error('STOCKCAL_API_BASE_URL 未配置')
  return new URL(path, baseUrl).toString()
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(backendUrl(path), {
    ...init,
    cache: 'no-store',
    headers: { Accept: 'application/json', ...init?.headers },
  })
  if (!response.ok) throw new Error(`后端请求失败：${response.status}`)
  return response.json() as Promise<T>
}

export function searchSecurities(query: string) {
  return request<Security[]>(`/api/v1/market/search?q=${encodeURIComponent(query)}`)
}

export function getMarketSnapshot(symbol: string) {
  return request<MarketSnapshot>(`/api/v1/market/stocks/${encodeURIComponent(symbol)}/snapshot`)
}

export type SyncMutation = {
  idempotencyKey: string
  entityType: string
  entityId: string
  operation: 'UPSERT' | 'DELETE'
  revision: number
  payload?: Record<string, unknown>
}

export type SyncResponse = { applied: boolean; cursor: number }
export type SyncChange = SyncMutation & { cursor: number; changedAt: string }

export function applySyncMutation(mutation: SyncMutation, clientId?: string, authorization?: string) {
  return request<SyncResponse>('/api/v1/sync/mutations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(clientId ? { 'X-Client-Id': clientId } : {}),
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: JSON.stringify(mutation),
  })
}

export function pullSyncChanges(cursor: number, clientId?: string, authorization?: string) {
  return request<{ nextCursor: number; changes: SyncChange[] }>(`/api/v1/sync/changes?cursor=${cursor}`, {
    headers: {
      ...(clientId ? { 'X-Client-Id': clientId } : {}),
      ...(authorization ? { Authorization: authorization } : {}),
    },
  })
}

export type PortfolioTrade = {
  id: string
  symbol: string
  side: 'buy' | 'sell'
  quantity: number
  price: number
  fee: number
  tradedAt: string
  note: string
  revision: number
}

export type PortfolioResponse = {
  trades: PortfolioTrade[]
  holdings: Array<{ symbol: string; quantity: number; averageCost: number }>
}

export function getPortfolio(clientId?: string, authorization?: string) {
  return request<PortfolioResponse>('/api/v1/account/portfolio', {
    headers: {
      ...(clientId ? { 'X-Client-Id': clientId } : {}),
      ...(authorization ? { Authorization: authorization } : {}),
    },
  })
}

export function saveAccountTrade(trade: PortfolioTrade, clientId?: string, authorization?: string) {
  return request<PortfolioTrade>('/api/v1/account/trades', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(clientId ? { 'X-Client-Id': clientId } : {}),
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: JSON.stringify(trade),
  })
}

export function explainStrategy(
  payload: Record<string, unknown>,
  authorization?: string,
) {
  return request<Record<string, unknown>>('/api/v1/analysis/strategy-explanation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: JSON.stringify(payload),
  })
}
