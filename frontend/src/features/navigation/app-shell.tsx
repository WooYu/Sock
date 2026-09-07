'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { PrimarySection, WorkspaceTone } from './navigation-config'
import { desktopNavigation, mobileNavigation } from './navigation-config'
import { WebAccountButton } from '../account/web-account-button'

type AppShellProps = {
  section: PrimarySection
  onSectionChange: (section: PrimarySection) => void
  activeHref?: string
  currentStockLabel?: string
  tone?: WorkspaceTone
  children?: React.ReactNode
}

const navIconPaths = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9.5V21h13V9.5M9 21v-7h6v7" /></>,
  analysis: <><path d="M4 19V9m6 10V5m6 14v-7m4 7H2" /><path d="m3 7 6-4 6 6 6-5" /></>,
  rules: <><path d="M6 3h12v18H6z" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
  review: <><path d="M4 5h16v16H4z" /><path d="M8 3v4m8-4v4M7 11h10M8 15l2 2 5-5" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
} satisfies Record<string, React.ReactNode>

function NavigationIcon({ name }: { name: keyof typeof navIconPaths }) {
  return <svg aria-hidden="true" className="sc-nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">{navIconPaths[name]}</svg>
}

export function AppShell({
  section,
  onSectionChange,
  activeHref,
  currentStockLabel,
  children,
}: AppShellProps) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const notify = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(null), 2600)
  }

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [])
  const primarySection = section === 'chart' ? 'analysis' : section === 'trading' ? 'review' : section
  const renderNavigation = (items: typeof desktopNavigation, testId: string) => {
    const activeIndex = items.findIndex((item) => item.section === primarySection)
    const hasConcreteActiveDestination = activeHref ? items.some((item) => {
      const itemPath = item.href.split('#')[0]
      const itemRoot = itemPath.split('/').slice(0, 2).join('/') || itemPath
      return itemPath === activeHref || activeHref.startsWith(`${itemRoot}/`)
    }) : false
    const isMobile = testId === 'mobile-primary-nav'
    return (
      <nav aria-label="主导航" className={isMobile ? 'sc-main-nav sc-main-nav-mobile' : 'sc-main-nav sc-main-nav-desktop'} data-testid={testId}>
        {items.map((item, index) => {
          const itemPath = item.href.split('#')[0]
          const itemRoot = itemPath.split('/').slice(0, 2).join('/') || itemPath
          const isActive = activeHref ? itemPath === activeHref || activeHref.startsWith(`${itemRoot}/`) || (!hasConcreteActiveDestination && item.section === primarySection) : activeIndex === index
          return (
          <Link
            aria-current={isActive ? 'page' : undefined}
            className={`${isMobile ? 'min-h-12' : ''} sc-nav-link ${isActive ? 'active' : ''}`}
            href={item.href}
            key={`${item.section}-${item.label}`}
            onClick={() => onSectionChange(item.section)}
          >
            <NavigationIcon name={item.icon} />
            <span>{item.label}</span>
          </Link>
          )
        })}
      </nav>
    )
  }

  return (
    <div className="sc-shell sc-shell-unified" data-testid="app-shell">
      <header className="sc-shell-header">
        <div className="sc-shell-header-inner">
          <Link className="sc-brand" href="/overview" aria-label="回到总览">
            <span className="sc-brand-mark"><i /><i /><i /></span>
            <span>StockCal</span>
          </Link>
          <div className="sc-desktop-nav">
            {renderNavigation(desktopNavigation, 'desktop-primary-nav')}
          </div>
          <div className="sc-shell-actions">
            {currentStockLabel ? (
              <span className="sc-current-stock">
                {currentStockLabel}
              </span>
            ) : null}
            <form className="sc-search-box" action="/analysis/key-levels" method="get" onSubmit={(event) => { if (!query.trim()) { event.preventDefault(); notify('请输入股票代码或名称') } }}>
              <span aria-hidden="true">⌕</span>
              <input aria-label="搜索股票" name="symbol" placeholder="输入代码 / 名称" ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} />
              <kbd>⌘ K</kbd>
            </form>
            <button aria-expanded={searchOpen} aria-label="搜索股票（移动端）" className="sc-mobile-search-trigger" onClick={() => setSearchOpen((open) => !open)} type="button">⌕</button>
            <button className="sc-alert-button" aria-label="提醒" onClick={() => notify('当前没有新增提醒')} type="button">●</button>
            <WebAccountButton />
          </div>
        </div>
        {searchOpen ? <form className="sc-mobile-search-row" action="/analysis/key-levels" method="get"><input autoFocus name="symbol" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入股票代码或名称" aria-label="股票代码或名称" /><button type="submit">进入分析</button></form> : null}
      </header>

      <main className="sc-shell-main">
        {children}
      </main>

      <div className="sc-mobile-nav-wrap">
        {renderNavigation(mobileNavigation, 'mobile-primary-nav')}
      </div>
      {notice ? <p className="sc-shell-notice" role="status">{notice}</p> : null}
    </div>
  )
}
