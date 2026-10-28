import type { Security } from '@/features/workspace/stock-workspace-types'

export const shanghaiComposite: Security = { code: 'sh000001', name: '上证指数', exchange: 'SH', initials: 'szzs' }
export const csi1000: Security = { code: 'sh000852', name: '中证1000', exchange: 'SH', initials: 'zz1000' }
const indices = [
  { security: shanghaiComposite, aliases: ['上证指数', '上证综指', '上海综合指数', 'sh000001', 'szzs', 'szzh', 'shangzhengzhishu'] },
  { security: csi1000, aliases: ['中证1000', '中证一千', 'sh000852', 'zz1000', 'zhongzheng1000'] },
]

export function isMarketIndex(symbol: string): boolean {
  return indices.some(({ security }) => security.code === symbol.toLowerCase())
}

export function matchingMarketIndices(query: string): Security[] {
  const term = query.trim().toLowerCase()
  if (term === '000852') return [{ ...csi1000 }]
  if (!term || /^\d+$/.test(term)) return []
  return indices.filter(({ aliases }) => aliases.some(alias => alias.includes(term))).map(({ security }) => ({ ...security }))
}

export const validMarketSymbol = /^(?:\d{6}|sh000001|sh000852)$/i
