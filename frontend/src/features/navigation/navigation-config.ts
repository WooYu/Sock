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
  icon: 'home' | 'analysis' | 'rules' | 'review' | 'settings'
}

export const desktopNavigation: NavigationItem[] = [
  { section: 'overview', label: '首页', href: '/overview', icon: 'home' },
  { section: 'analysis', label: '分析', href: '/analysis/key-levels', icon: 'analysis' },
  { section: 'rules', label: '规则', href: '/rules', icon: 'rules' },
  { section: 'review', label: '复盘', href: '/review/daily', icon: 'review' },
  { section: 'settings', label: '设置', href: '/settings', icon: 'settings' },
]

export const mobileNavigation: NavigationItem[] = [
  { section: 'overview', label: '首页', href: '/overview', icon: 'home' },
  { section: 'analysis', label: '分析', href: '/analysis/key-levels', icon: 'analysis' },
  { section: 'rules', label: '规则', href: '/rules', icon: 'rules' },
  { section: 'review', label: '复盘', href: '/review/daily', icon: 'review' },
  { section: 'settings', label: '设置', href: '/settings', icon: 'settings' },
]
