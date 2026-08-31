import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test } from 'vitest'
import { TradingPage } from './trading-page'

describe('TradingPage interactions', () => {
  beforeEach(() => localStorage.clear())

  test('records a trade from the ledger action', async () => {
    const user = userEvent.setup()
    render(<TradingPage initialTab="ledger" symbol="600519" />)

    await user.click(screen.getByRole('button', { name: '记录第一笔交易' }))
    await user.selectOptions(screen.getByLabelText('交易方向'), 'buy')
    await user.type(screen.getByLabelText('交易数量'), '100')
    await user.type(screen.getByLabelText('成交价格'), '1290')
    await user.click(screen.getByRole('button', { name: '保存交易' }))

    expect(screen.getByText('交易已保存')).toBeInTheDocument()
    expect(screen.getByText('买入 100 股')).toBeInTheDocument()
  })
})
