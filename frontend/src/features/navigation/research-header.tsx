'use client'

import Link from 'next/link'
import { WebAccountButton } from '../account/web-account-button'
import { StudioIcon } from '../research/studio-icon'
import './research-header.css'

export type KnowledgeView = 'library' | 'notes' | 'samples' | 'backtest'

const destinations = [
  { key: 'chart', label: 'K 线工作台', href: '/' },
  { key: 'notes', label: '笔记标签', href: '/knowledge?view=notes' },
  { key: 'samples', label: '学习样本', href: '/knowledge?view=samples' },
  { key: 'backtest', label: '回测证据', href: '/knowledge?view=backtest' },
] as const

export function ResearchHeader({ active, onKnowledgeNavigate }: {
  active: 'chart' | 'review' | KnowledgeView
  onKnowledgeNavigate?: (view: KnowledgeView) => void
}) {
  return <header className="sc-research-header">
    <Link className="sc-research-brand" href="/"><span><StudioIcon name="chart" size={20} /></span>StockCal</Link>
    <nav className="sc-research-nav" aria-label="研究工作台导航">
      {destinations.map(item => <Link key={item.key} id={`research-nav-${item.key}`} href={item.href}
        aria-current={active === item.key ? 'page' : undefined}
        onClick={event => {
          if (onKnowledgeNavigate && item.key !== 'chart'
            && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) {
            event.preventDefault()
            onKnowledgeNavigate(item.key)
          }
        }}>{item.label}</Link>)}
    </nav>
    <div className="sc-research-actions"><span>让每一次判断，都有依据</span><WebAccountButton /></div>
  </header>
}
