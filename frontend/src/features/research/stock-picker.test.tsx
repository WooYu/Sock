import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { browserMarketClient } from '@/lib/api/browser-client'
import { StockPicker } from './stock-picker'

vi.mock('@/lib/api/browser-client', () => ({ browserMarketClient: { search: vi.fn() } }))

beforeEach(() => {
  localStorage.clear()
  vi.mocked(browserMarketClient.search).mockReset()
})

test('clears a pending search and ignores its late response while preserving focus', async () => {
  const user = userEvent.setup()
  let resolveSearch!: (items: { code: string; name: string }[]) => void
  vi.mocked(browserMarketClient.search).mockImplementation(() => new Promise((resolve) => { resolveSearch = resolve }))
  render(<StockPicker selectedSymbol={null} onSelect={vi.fn()} onClose={vi.fn()} />)
  const input = screen.getByRole('combobox', { name: '搜索 A 股' })
  await user.type(input, '立讯')
  await vi.waitFor(() => expect(browserMarketClient.search).toHaveBeenCalled())
  await user.click(screen.getByRole('button', { name: '清空搜索' }))
  resolveSearch([{ code: '002475', name: '立讯精密' }])
  expect(input).toHaveValue('')
  expect(input).toHaveFocus()
  expect(screen.queryByRole('option')).not.toBeInTheDocument()
  await user.type(input, '平安')
  await user.keyboard('{Escape}')
  expect(input).toHaveValue('')
  expect(input).toHaveFocus()
})

test('selects the next result with arrow keys and Enter', async () => {
  const user = userEvent.setup()
  const onSelect = vi.fn()
  const securities = [{ code: '000001', name: '平安银行' }, { code: '601318', name: '中国平安' }]
  vi.mocked(browserMarketClient.search).mockResolvedValue(securities)
  render(<StockPicker selectedSymbol={null} onSelect={onSelect} onClose={vi.fn()} />)
  await user.type(screen.getByRole('combobox', { name: '搜索 A 股' }), '平安')
  await screen.findByRole('option', { name: /中国平安/ })
  await user.keyboard('{ArrowDown}{Enter}')
  expect(onSelect).toHaveBeenCalledWith(securities[1])
})

test('restores a saved index and selects it with its qualified symbol', async () => {
  const index = { code: 'sh000001', name: '上证指数', exchange: 'SH' }
  localStorage.setItem('stockcal:research-list:v1', JSON.stringify({ recent: [index], favorites: [index] }))
  const onSelect = vi.fn()
  render(<StockPicker selectedSymbol={null} onSelect={onSelect} onClose={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: /上证指数.*SH sh000001/ }))
  expect(onSelect).toHaveBeenCalledWith(index)
})
