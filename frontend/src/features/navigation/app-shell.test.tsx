import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { AppShell } from './app-shell'

describe('AppShell', () => {
  test('renders desktop and mobile navigation landmarks', () => {
    render(<AppShell section="overview" onSectionChange={vi.fn()} />)

    expect(screen.getByTestId('desktop-primary-nav')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-primary-nav')).toBeInTheDocument()
    expect(screen.getByTestId('desktop-primary-nav').querySelector('a[aria-current="page"]')).toHaveTextContent('关键位分析')
  })

  test('selecting a mobile destination reports the primary section', async () => {
    const onSectionChange = vi.fn()
    render(<AppShell section="overview" onSectionChange={onSectionChange} />)

    await userEvent.click(screen.getByTestId('mobile-primary-nav').querySelector('a[href="/chart"]')!)

    expect(onSectionChange).toHaveBeenCalledWith('chart')
  })

  test('highlights the concrete destination when a section has multiple entries', () => {
    render(<AppShell activeHref="/analysis/future" section="analysis" onSectionChange={vi.fn()} />)

    expect(screen.getByRole('link', { name: '未来指标' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: '盈利模式' })).not.toHaveAttribute('aria-current', 'page')
  })

  test('all mobile destinations meet the 48px touch target', () => {
    render(<AppShell section="overview" onSectionChange={vi.fn()} />)

    const links = screen.getByTestId('mobile-primary-nav').querySelectorAll('a')
    expect(links).toHaveLength(9)
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
    expect(screen.getByRole('status')).toHaveTextContent('演示版暂无新增提醒')

    await userEvent.click(screen.getByRole('button', { name: /数据说明/ }))
    expect(screen.getByRole('status')).toHaveTextContent('真实行情接口将在下一开发阶段接入')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    expect(search).toHaveFocus()
  })
})
