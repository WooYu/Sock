import type { Security } from '@/features/workspace/stock-workspace-types'

export const shanghaiComposite: Security = { code: 'sh000001', name: '上证指数', exchange: 'SH', initials: 'szzs' }
export const csi1000: Security = { code: 'sh000852', name: '中证1000', exchange: 'SH', initials: 'zz1000' }
export const a50Futures: Security = { code: 'cn00y', name: 'A50期指当月连续', exchange: 'SGX', initials: 'a50' }
export function isA50Futures(symbol: string): boolean { return symbol.toLowerCase() === a50Futures.code }
const indices = [
  { security: shanghaiComposite, aliases: ['上证指数', '上证综指', '上海综合指数', 'sh000001', 'szzs', 'szzh', 'shangzhengzhishu'] },
  { security: csi1000, aliases: ['中证1000', '中证一千', 'sh000852', 'zz1000', 'zhongzheng1000'] },
  { security: { code: 'sz399006', name: '创业板指', exchange: 'SZ', initials: 'cybz' }, aliases: ['创业板指', '创业板指数', 'sz399006', 'cybz', 'chuangyebanzhi'] },
  { security: { code: 'sz399903', name: '中证100', exchange: 'SZ', initials: 'zz100' }, aliases: ['中证100', '中证一百', 'sz399903', 'zz100', 'zhongzheng100'] },
  { security: { code: 'sz399310', name: '国证A50', exchange: 'SZ', initials: 'gza50' }, aliases: ['国证a50', 'sz399310', 'gza50'] },
]

export function isMarketIndex(symbol: string): boolean {
  return indices.some(({ security }) => security.code === symbol.toLowerCase())
}

export function matchingMarketIndices(query: string): Security[] {
  const term = query.trim().toLowerCase()
  if (['a50', 'cn00y', 'a50期货', 'a50期货主连', 'a50指数期货', 'a50期指', 'a50期指当月连续', '富时a50期货'].includes(term)) return [{ ...a50Futures }]
  if (term === '000852' || ['399006', '399903', '399310'].includes(term)) return indices.filter(({ security }) => security.code.slice(2) === term).map(({ security }) => ({ ...security }))
  if (!term || /^\d+$/.test(term)) return []
  return indices.filter(({ aliases }) => aliases.some(alias => {
    const position = alias.indexOf(term)
    return position >= 0 && (!/\d$/.test(term) || !/\d/.test(alias[position + term.length] ?? ''))
  })).map(({ security }) => ({ ...security }))
}

export const validMarketSymbol = /^(?:\d{6}|sh000001|sh000852|sz399006|sz399903|sz399310|cn00y)$/i
