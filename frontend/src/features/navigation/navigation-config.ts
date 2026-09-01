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
  { section: 'overview', label: '关键位分析', href: '/overview', icon: '◈' },
  { section: 'analysis', label: '盈利模式', href: '/analysis/patterns', icon: '↗' },
  { section: 'analysis', label: '未来指标', href: '/analysis/future', icon: '⌁' },
  { section: 'trading', label: '预测记录', href: '/trading/predictions', icon: '▤' },
  { section: 'trading', label: '交易与盈亏', href: '/trading/positions', icon: '￥' },
  { section: 'trading', label: '统计图表', href: '/trading/statistics', icon: '▥' },
  { section: 'review', label: '当日复盘', href: '/review/daily', icon: '✓' },
  { section: 'analysis', label: 'AI策略', href: '/analysis/ai', icon: '✦' },
  { section: 'rules', label: '经验规则', href: '/rules', icon: '◇' },
]

export const mobileNavigation: NavigationItem[] = [
  { section: 'overview', label: '关键位', href: '/overview', icon: '◈' },
  { section: 'analysis', label: '模式', href: '/analysis/patterns', icon: '↗' },
  { section: 'analysis', label: '指标', href: '/analysis/future', icon: '⌁' },
  { section: 'trading', label: '记录', href: '/trading/predictions', icon: '▤' },
  { section: 'chart', label: 'K线', href: '/chart', icon: '▥' },
  { section: 'trading', label: '交易', href: '/trading/positions', icon: '￥' },
  { section: 'trading', label: '统计', href: '/trading/statistics', icon: '▥' },
  { section: 'review', label: '复盘', href: '/review/daily', icon: '↺' },
  { section: 'rules', label: '规则', href: '/rules', icon: '◇' },
]
