export type PrimarySection =
  | 'overview'
  | 'analysis'
  | 'chart'
  | 'trading'
  | 'review'
  | 'rules'
  | 'settings'

export type WorkspaceTone = 'cyber' | 'chart' | 'feed' | 'neutral'

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
  { section: 'overview', label: '首页', href: '/overview', icon: '◈' },
  { section: 'analysis', label: '分析', href: '/analysis/key-levels', icon: '↗' },
  { section: 'rules', label: '规则', href: '/rules', icon: '◇' },
  { section: 'review', label: '复盘', href: '/review/daily', icon: '✓' },
  { section: 'settings', label: '设置', href: '/settings', icon: '⚙' },
]

export const mobileNavigation: NavigationItem[] = [
  { section: 'overview', label: '首页', href: '/overview', icon: '◈' },
  { section: 'analysis', label: '分析', href: '/analysis/key-levels', icon: '↗' },
  { section: 'rules', label: '规则', href: '/rules', icon: '◇' },
  { section: 'review', label: '复盘', href: '/review/daily', icon: '↺' },
  { section: 'settings', label: '设置', href: '/settings', icon: '⚙' },
]
