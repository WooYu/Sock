import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test } from 'vitest'
import { TradingPage } from './trading-page'

describe('TradingPage interactions', () => {
  beforeEach(() => localStorage.clear())

  test('exposes the shared trading workspace regions', () => {
    const { container } = render(<TradingPage initialTab="positions" symbol="600519" />)

    expect(container.querySelector('.sc-trading-page')).toBeInTheDocument()
    expect(container.querySelector('.sc-trading-header')).toBeInTheDocument()
    expect(container.querySelector('.sc-workspace-tabs')).toBeInTheDocument()
    expect(container.querySelector('.sc-trading-content')).toBeInTheDocument()
    expect(screen.getByRole('table', { name: '持仓列表' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '持仓' })).toHaveAttribute('aria-selected', 'true')
  })

  test('records a trade from the ledger action', async () => {
    const user = userEvent.setup()
    render(<TradingPage initialTab="ledger" symbol="600519" />)

    expect(screen.getByRole('dialog', { name: '新增交易' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '记录交易' }))
    await user.selectOptions(screen.getByLabelText('交易方向'), 'buy')
    await user.type(screen.getByLabelText('交易数量'), '100')
    await user.type(screen.getByLabelText('成交价格'), '1290')
    await user.click(screen.getByRole('button', { name: '保存交易' }))

    expect(screen.getByText('交易已保存')).toBeInTheDocument()
    expect(screen.getByText('买入 100 股')).toBeInTheDocument()
  })
})

test('hydrates saved trades without a server/client mismatch', async () => {
  localStorage.clear()
  const html = renderToString(<TradingPage initialTab="positions" symbol="600519" />)
  localStorage.setItem('stockcal:trades', JSON.stringify([{ id: 'hydration-trade', symbol: '600519', side: 'buy', quantity: 100, price: 1290, fee: 0, tradedAt: '2026-10-23T00:00:00Z', note: '', revision: 1 }]))
  const container = document.createElement('div')
  container.innerHTML = html
  document.body.append(container)
  const errors: unknown[] = []
  let root!: ReturnType<typeof hydrateRoot>
  try {
    await act(async () => {
      root = hydrateRoot(container, <TradingPage initialTab="positions" symbol="600519" />, { onRecoverableError: error => errors.push(error) })
    })
    expect(errors).toEqual([])
    expect(container.textContent).toContain('600519')
    expect(container.querySelector('tbody')?.textContent).toContain('100')
  } finally {
    await act(async () => root?.unmount())
    container.remove()
    localStorage.clear()
  }
})
