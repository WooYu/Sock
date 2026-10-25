'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { PrimarySection, WorkspaceTone } from './navigation-config'
import { WorkspaceNavigation } from './workspace-navigation'
import { StockSearchDialog } from './stock-search-dialog'
import { StudioIcon } from '../research/studio-icon'
import { WebAccountButton } from '../account/web-account-button'

type AppShellProps = {
  section: PrimarySection
  onSectionChange: (section: PrimarySection) => void
  activeHref?: string
  currentStockLabel?: string
  tone?: WorkspaceTone
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
  const [searchFromKeyboard, setSearchFromKeyboard] = useState(false)

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if (document.querySelector('[aria-modal="true"]')) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchFromKeyboard(true)
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [])

  return (
    <div className="sc-shell sc-shell-unified" data-testid="app-shell">
      <a className="sc-skip-link" href="#product-main">跳到主要内容</a>
      <header className="sc-shell-header">
        <div className="sc-shell-header-inner">
          <Link className="sc-brand" href="/" aria-label="回到趋势工作台">
            <span className="sc-brand-mark"><StudioIcon name="chart" size={20} /></span>
            <span>StockCal</span>
          </Link>
          <div className="sc-desktop-nav">
            <WorkspaceNavigation activeHref={activeHref} section={section} onSectionChange={onSectionChange} />
          </div>
          <div className="sc-shell-actions">
            {currentStockLabel ? (
              <span className="sc-current-stock">
                {currentStockLabel}
              </span>
            ) : null}
            <button type="button" className="sc-search-box sc-stock-search-trigger" aria-label="搜索股票" aria-haspopup="dialog" aria-expanded={searchOpen} onClick={() => { setSearchFromKeyboard(false); setSearchOpen(true) }}><StudioIcon name="search" size={18} /><span>代码 / 名称</span><kbd>Ctrl K</kbd></button>
            <button aria-haspopup="dialog" aria-expanded={searchOpen} aria-label="搜索股票（移动端）" className="sc-mobile-search-trigger" onClick={() => { setSearchFromKeyboard(false); setSearchOpen(true) }} type="button"><StudioIcon name="search" size={20} /></button>

            <WebAccountButton />
          </div>
        </div>

      </header>

      <main className="sc-shell-main" id="product-main" tabIndex={-1}>
        {children}
      </main>

      <div className="sc-mobile-nav-wrap">
        <WorkspaceNavigation mobile activeHref={activeHref} section={section} onSectionChange={onSectionChange} />
      </div>
      {searchOpen ? <StockSearchDialog onClose={() => setSearchOpen(false)} focusInput={searchFromKeyboard} /> : null}
    </div>
  )
}
