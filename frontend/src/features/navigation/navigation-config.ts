export type PrimarySection =
  | 'overview'
  | 'analysis'
  | 'chart'
  | 'trading'
  | 'review'
  | 'rules'
  | 'settings'
  | 'knowledge'

export type WorkspaceTone = 'cyber' | 'chart' | 'feed' | 'neutral'

export type AnalysisTab = 'key-levels' | 'patterns' | 'future' | 'ai'
export type TradingTab = 'positions' | 'ledger' | 'predictions' | 'statistics'
export type ReviewTab = 'daily' | 'trade' | 'history' | 'backtest'

export type NavigationItem = {
  section: PrimarySection
  label: string
  href: string
  icon: 'chart' | 'book' | 'target' | 'layers'
}

export const desktopNavigation: NavigationItem[] = [
  { section: 'chart', label: '趋势', href: '/', icon: 'chart' },
  { section: 'knowledge', label: '笔记', href: '/knowledge?view=notes', icon: 'book' },
  { section: 'analysis', label: '分析', href: '/analysis/key-levels', icon: 'target' },
  { section: 'trading', label: '交易', href: '/trading/positions', icon: 'layers' },
]

export const mobileNavigation = desktopNavigation

export const moreNavigation = [
  { label: '学习样本', description: '保存的计算与实际行情核对', href: '/knowledge?view=samples' },
  { label: '回测证据', description: '历史研究与基线方法对照', href: '/knowledge?view=backtest' },
  { label: '规则库', description: '管理规则、导入笔记与审核', href: '/rules' },
  { label: '行情总览', description: '行情摘要与个股入口', href: '/overview' },
  { label: '设置与外观', description: '切换主题、查看同步与数据说明', href: '/settings' },
] as const
