'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { PrimarySection } from './navigation-config'
import { desktopNavigation, mobileNavigation } from './navigation-config'

type AppShellProps = {
  section: PrimarySection
  onSectionChange: (section: PrimarySection) => void
  currentStockLabel?: string
  children?: React.ReactNode
}

export function AppShell({
  section,
  onSectionChange,
  currentStockLabel,
  children,
}: AppShellProps) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const renderNavigation = (items: typeof desktopNavigation, testId: string) => (
    <nav aria-label="主导航" data-testid={testId}>
      {items.map((item) => (
        <Link
          aria-current={section === item.section ? 'page' : undefined}
          className={`flex min-h-12 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition ${
            section === item.section
              ? 'bg-[var(--sc-primary-soft)] text-[var(--sc-primary)]'
              : 'text-[var(--sc-muted)] hover:bg-[var(--sc-surface-muted)] hover:text-[var(--sc-foreground)]'
          }`}
          href={item.href}
          key={item.section}
          onClick={() => onSectionChange(item.section)}
        >
          <span aria-hidden="true" className="text-base">
            {item.icon}
          </span>
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  )

  return (
    <div className="min-h-screen bg-[var(--sc-background)] text-[var(--sc-foreground)]">
      <header className="sticky top-0 z-30 border-b border-[var(--sc-border)] bg-[var(--sc-surface)]/95 backdrop-blur">
        <div className="mx-auto flex min-h-[68px] max-w-[1392px] items-center gap-6 px-4 sm:px-6">
          <Link className="shrink-0 text-lg font-bold tracking-tight" href="/overview">
            StockCal
          </Link>
          <div className="hidden min-w-0 flex-1 items-center justify-center lg:flex">
            {renderNavigation(desktopNavigation, 'desktop-primary-nav')}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {currentStockLabel ? (
              <span className="hidden rounded-lg bg-[var(--sc-surface-muted)] px-3 py-2 text-sm font-medium text-[var(--sc-muted)] sm:inline-flex">
                {currentStockLabel}
              </span>
            ) : null}
            <button aria-expanded={searchOpen} aria-label="搜索股票" className="min-h-12 rounded-xl px-3 text-sm text-[var(--sc-muted)]" onClick={() => setSearchOpen((open) => !open)} type="button">搜索</button>
            <Link className="flex min-h-12 items-center rounded-xl px-3 text-lg" aria-label="账户菜单" href="/rules">◯</Link>
          </div>
        </div>
        {searchOpen ? <div className="mx-auto flex max-w-[1392px] gap-2 px-4 pb-3 sm:px-6"><input autoFocus className="min-h-12 min-w-0 flex-1 rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] px-4 text-sm outline-none focus:border-[var(--sc-primary)]" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入股票代码或名称" aria-label="股票代码或名称" /><Link className="flex min-h-12 items-center rounded-xl bg-[var(--sc-primary)] px-4 text-sm font-semibold text-white" href={query.trim() ? `/analysis/key-levels?symbol=${encodeURIComponent(query.trim())}` : '/analysis/key-levels'}>进入分析</Link></div> : null}
      </header>

      <main className="mx-auto w-full max-w-[1392px] px-4 pb-24 pt-5 sm:px-6 lg:pb-8">
        {children}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--sc-border)] bg-[var(--sc-surface)]/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto max-w-lg">
          {renderNavigation(mobileNavigation, 'mobile-primary-nav')}
        </div>
      </div>
    </div>
  )
}
