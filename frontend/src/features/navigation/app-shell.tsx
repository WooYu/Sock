'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { PrimarySection } from './navigation-config'
import { desktopNavigation, mobileNavigation } from './navigation-config'
import { WebAccountButton } from '../account/web-account-button'

type AppShellProps = {
  section: PrimarySection
  onSectionChange: (section: PrimarySection) => void
  activeHref?: string
  currentStockLabel?: string
  children?: React.ReactNode
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
  const renderNavigation = (items: typeof desktopNavigation, testId: string) => {
    const activeIndex = items.findIndex((item) => item.section === section)
    const isMobile = testId === 'mobile-primary-nav'
    return (
      <nav aria-label="主导航" className={isMobile ? 'sc-main-nav sc-main-nav-mobile' : 'sc-main-nav sc-main-nav-desktop'} data-testid={testId}>
        {items.map((item, index) => {
          const itemPath = item.href.split('#')[0]
          const isActive = activeHref ? itemPath === activeHref : activeIndex === index
          return (
          <Link
            aria-current={isActive ? 'page' : undefined}
            className={`${isMobile ? 'min-h-12' : ''} sc-nav-link ${isActive ? 'active' : ''}`}
            href={item.href}
            key={`${item.section}-${item.label}`}
            onClick={() => onSectionChange(item.section)}
          >
            <span aria-hidden="true" className="sc-nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
          )
        })}
      </nav>
    )
  }

  return (
    <div className="sc-shell">
      <header className="sc-shell-header">
        <div className="sc-shell-header-inner">
          <Link className="sc-brand" href="/overview" aria-label="回到总览">
            <span className="sc-brand-mark"><i /><i /><i /></span>
            <span>位界 <em>KEYLINE</em></span>
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
