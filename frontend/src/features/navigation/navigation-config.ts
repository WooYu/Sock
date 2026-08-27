export type PrimarySection =
  | 'overview'
  | 'analysis'
  | 'chart'
  | 'trading'
  | 'review'
  | 'rules'

export type AnalysisTab = 'key-levels' | 'patterns' | 'future' | 'ai'
export type TradingTab = 'positions' | 'ledger' | 'predictions' | 'statistics'
export type ReviewTab = 'daily' | 'trade' | 'history' | 'backtest'

export type NavigationItem = {
  section: PrimarySection
  label: string
  href: string
  icon: string
}

export const desktopNavigation: NavigationItem[] = [
  { section: 'overview', label: '总览', href: '/overview', icon: '⌂' },
  { section: 'analysis', label: '个股分析', href: '/analysis/key-levels', icon: '◈' },
  { section: 'chart', label: '专业 K 线', href: '/chart', icon: '▥' },
  { section: 'trading', label: '交易', href: '/trading/positions', icon: '▣' },
  { section: 'review', label: '复盘', href: '/review/daily', icon: '↺' },
  { section: 'rules', label: '规则库', href: '/rules', icon: '☷' },
]

export const mobileNavigation: NavigationItem[] = [
  { section: 'overview', label: '总览', href: '/overview', icon: '⌂' },
  { section: 'analysis', label: '分析', href: '/analysis/key-levels', icon: '◈' },
  { section: 'chart', label: 'K线', href: '/chart', icon: '▥' },
  { section: 'trading', label: '交易', href: '/trading/positions', icon: '▣' },
  { section: 'review', label: '复盘', href: '/review/daily', icon: '↺' },
]
