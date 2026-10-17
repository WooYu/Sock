import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test } from 'vitest'
import { ResearchJournal, journalKey, parseJournal } from './research-journal'
import { createPreviewData } from './preview-data'
beforeEach(() => localStorage.clear())
test('saves a judgment with invalidation and immutable prediction/source snapshots, restores by stock', async () => {
  const market = createPreviewData().market
  const user = userEvent.setup()
  const view = render(<ResearchJournal market={market} />)
  await user.click(screen.getByText(/研究记录 ·/))
  await user.selectOptions(screen.getByLabelText('研究状态'), '研究中')
  await user.type(screen.getByLabelText('下一步做什么'), '观察MA20')
  await user.type(screen.getByLabelText('当前判断'), '等待收盘确认')
  await user.type(screen.getByLabelText('判断失效条件'), '跌破昨日低点')
  await user.click(screen.getByText(/引用笔记原文/))
  await user.click((await screen.findAllByRole('checkbox', {}, { timeout: 10000 }))[0])
  await user.click(screen.getByRole('button', { name: '保存判断与日线预测快照' }))
  const saved = parseJournal(localStorage.getItem(journalKey(market.quote.security.code)))
  expect(saved.stage).toBe('待验证')
  expect(saved.records).toHaveLength(1)
  expect(saved.records[0]).toMatchObject({ judgment: '等待收盘确认', invalidation: '跌破昨日低点', next: '观察MA20', anchorPrice: market.quote.price })
  expect(saved.records[0].citations[0].sourceHash).toMatch(/^[a-f0-9]{64}$/)
  expect(saved.records[0].forecast).toHaveLength(4)
  view.unmount()
  render(<ResearchJournal market={{ ...market, quote: { ...market.quote, price: market.quote.price * 1.1 } }} />)
  expect(await screen.findByText('等待收盘确认')).toBeInTheDocument()
  expect(screen.getByText(/10.00%/)).toBeInTheDocument()
  expect(parseJournal(localStorage.getItem(journalKey('000001'))).records).toHaveLength(0)
  expect(parseJournal(localStorage.getItem(journalKey(market.quote.security.code))).records[0].anchorPrice).toBe(market.quote.price)
})
test('does not overwrite a damaged journal', async () => {
  const market = createPreviewData().market, key = journalKey(market.quote.security.code)
  localStorage.setItem(key, '{damaged')
  render(<ResearchJournal market={market} />)
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '保存判断与日线预测快照' })).toBeDisabled()
  expect(localStorage.getItem(key)).toBe('{damaged')
})
