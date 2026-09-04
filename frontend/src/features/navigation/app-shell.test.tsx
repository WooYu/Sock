import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { AppShell } from './app-shell'

describe('AppShell', () => {
  test('renders desktop and mobile navigation landmarks', () => {
    render(<AppShell section="overview" onSectionChange={vi.fn()} />)

    expect(screen.getByTestId('desktop-primary-nav')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-primary-nav')).toBeInTheDocument()
    expect(screen.getByTestId('desktop-primary-nav').querySelector('a[aria-current="page"]')).toHaveTextContent('首页')
  })

  test('applies the requested workspace tone to the shell', () => {
    render(<AppShell section="rules" onSectionChange={vi.fn()} tone="feed" />)

    expect(screen.getByTestId('app-shell')).toHaveClass('sc-tone-feed')
  })

  test('keeps the primary navigation focused on five workspaces', () => {
    render(<AppShell section="overview" onSectionChange={vi.fn()} />)

    expect(screen.getByTestId('desktop-primary-nav').querySelectorAll('a')).toHaveLength(5)
    expect(screen.getByTestId('mobile-primary-nav').querySelectorAll('a')).toHaveLength(5)
    expect(screen.getByTestId('desktop-primary-nav').querySelector('a[href="/analysis/key-levels"]')).toBeInTheDocument()
  })

  test('selecting a mobile destination reports the primary section', async () => {
    const onSectionChange = vi.fn()
    render(<AppShell section="overview" onSectionChange={onSectionChange} />)

    await userEvent.click(screen.getByTestId('mobile-primary-nav').querySelector('a[href="/rules"]')!)

    expect(onSectionChange).toHaveBeenCalledWith('rules')
  })

  test('highlights the concrete workspace destination', () => {
    render(<AppShell activeHref="/analysis/key-levels" section="analysis" onSectionChange={vi.fn()} />)

    expect(screen.getByTestId('desktop-primary-nav').querySelector('a[href="/analysis/key-levels"]')).toHaveAttribute('aria-current', 'page')
  })

  test('keeps the primary workspace active on nested destinations', () => {
    render(<AppShell activeHref="/analysis/future" section="analysis" onSectionChange={vi.fn()} />)

    expect(screen.getByTestId('desktop-primary-nav').querySelector('a[href="/analysis/key-levels"]')).toHaveAttribute('aria-current', 'page')
  })

  test('maps chart and ledger routes back to their primary workspaces', () => {
    const { rerender } = render(<AppShell activeHref="/chart" section="chart" onSectionChange={vi.fn()} />)

    expect(screen.getByTestId('desktop-primary-nav').querySelector('a[href="/analysis/key-levels"]')).toHaveAttribute('aria-current', 'page')

    rerender(<AppShell activeHref="/trading/ledger" section="trading" onSectionChange={vi.fn()} />)

    expect(screen.getByTestId('desktop-primary-nav').querySelector('a[href="/review/daily"]')).toHaveAttribute('aria-current', 'page')
  })

  test('all mobile destinations meet the 48px touch target', () => {
    render(<AppShell section="overview" onSectionChange={vi.fn()} />)

    const links = screen.getByTestId('mobile-primary-nav').querySelectorAll('a')
    expect(links).toHaveLength(5)
    for (const link of links) {
      expect(link.className).toContain('min-h-12')
    }
  })

  test('reference shell renders the stock search field', async () => {
    render(<AppShell section="overview" onSectionChange={vi.fn()} />)
    expect(screen.getByRole('textbox', { name: '搜索股票' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '搜索股票（移动端）' }))
    expect(screen.getByRole('textbox', { name: '股票代码或名称' })).toBeInTheDocument()
  })

  test('matches the sample feedback interactions and supports the search shortcut', async () => {
    render(<AppShell section="overview" onSectionChange={vi.fn()} />)
    const search = screen.getByRole('textbox', { name: '搜索股票' })

    await userEvent.click(screen.getByRole('button', { name: '提醒' }))
    expect(screen.getByRole('status')).toHaveTextContent('当前没有新增提醒')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    expect(search).toHaveFocus()
  })

  test('keeps the shared shell class names backed by global styles', () => {
    const styles = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8')

    expect(styles).toContain('.sc-shell-header')
    expect(styles).toContain('.sc-shell-main')
    expect(styles).toContain('.sc-live-empty')
    expect(styles).toContain('.sc-tone-cyber')
    expect(styles).toContain('.sc-tone-chart')
    expect(styles).toContain('.sc-tone-feed')
  })
})
