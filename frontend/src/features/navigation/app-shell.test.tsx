import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { AppShell } from './app-shell'

describe('AppShell', () => {
  test('renders desktop and mobile navigation landmarks', () => {
    render(<AppShell section="overview" onSectionChange={vi.fn()} />)

    expect(screen.getByTestId('desktop-primary-nav')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-primary-nav')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-primary-nav').querySelector('a[aria-current="page"]')).toHaveTextContent('总览')
  })

  test('selecting a mobile destination reports the primary section', async () => {
    const onSectionChange = vi.fn()
    render(<AppShell section="overview" onSectionChange={onSectionChange} />)

    await userEvent.click(screen.getByTestId('mobile-primary-nav').querySelector('a[href="/chart"]')!)

    expect(onSectionChange).toHaveBeenCalledWith('chart')
  })

  test('all mobile destinations meet the 48px touch target', () => {
    render(<AppShell section="overview" onSectionChange={vi.fn()} />)

    const links = screen.getByTestId('mobile-primary-nav').querySelectorAll('a')
    expect(links).toHaveLength(5)
    for (const link of links) {
      expect(link.className).toContain('min-h-12')
    }
  })

  test('search control opens a stock symbol field', async () => {
    render(<AppShell section="overview" onSectionChange={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: '搜索股票' }))
    expect(screen.getByRole('textbox', { name: '股票代码或名称' })).toBeInTheDocument()
  })
})
