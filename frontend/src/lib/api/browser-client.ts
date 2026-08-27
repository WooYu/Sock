import type { MarketSnapshot, Security } from '@/features/workspace/stock-workspace-types'

export type BrowserMarketClient = {
  search(query: string, signal?: AbortSignal): Promise<Security[]>
  snapshot(symbol: string, signal?: AbortSignal): Promise<MarketSnapshot>
}

async function browserRequest<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`行情请求失败：${response.status}`)
  return response.json() as Promise<T>
}

export const browserMarketClient: BrowserMarketClient = {
  search: (query, signal) => browserRequest(`/api/market/search?q=${encodeURIComponent(query)}`, signal),
  snapshot: (symbol, signal) => browserRequest(`/api/market/stocks/${encodeURIComponent(symbol)}/snapshot`, signal),
}
