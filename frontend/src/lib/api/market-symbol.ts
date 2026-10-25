import type { Security } from '@/features/workspace/stock-workspace-types'

export const shanghaiComposite: Security = { code: 'sh000001', name: '上证指数', exchange: 'SH', initials: 'szzs' }

export function isShanghaiComposite(symbol: string): boolean {
  return symbol.toLowerCase() === shanghaiComposite.code
}

export function matchesShanghaiComposite(query: string): boolean {
  const term = query.trim().toLowerCase()
  return !!term && !/^\d+$/.test(term) && ['上证指数', '上证综指', '上海综合指数', 'sh000001', 'szzs', 'szzh', 'shangzhengzhishu'].some(alias => alias.includes(term))
}

export const validMarketSymbol = /^(?:\d{6}|sh000001)$/i
