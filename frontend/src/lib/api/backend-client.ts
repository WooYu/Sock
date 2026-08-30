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
