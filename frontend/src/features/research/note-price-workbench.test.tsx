import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { forecastFixture } from '../scenario/scenario-test-fixtures'
import { NotePriceWorkbench } from './note-price-workbench'
import { NOTE_PRICE_STORAGE_KEY, parseNotePriceSnapshots } from './note-price-ledger'

beforeEach(() => localStorage.clear())
test('freezes values and definitions, changes current mapping without overwriting history, and restores after reload', async () => {
  const { snapshot } = forecastFixture()
  const refresh = vi.fn()
  const view = render(<NotePriceWorkbench analysis={snapshot} onRefresh={refresh} />)
  const save = screen.getByRole('button', { name: '冻结本次笔记计算' })
  await waitFor(() => expect(save).toBeEnabled())
  fireEvent.click(save)
  await screen.findByText('已追加冻结记录；刷新后按原定义核对，修改参数不会改写此记录。')
  const initial = localStorage.getItem(NOTE_PRICE_STORAGE_KEY)!
  const first = parseNotePriceSnapshots(initial)[0]
  expect(first.run.config.upperMapping).toBe(2)
  fireEvent.click(screen.getByText('研究定义与人工调整'))
  fireEvent.change(screen.getByRole('combobox', { name: '攀升指标目标' }), { target: { value: '1' } })
  expect(localStorage.getItem(NOTE_PRICE_STORAGE_KEY)).toBe(initial)
  fireEvent.click(save)
  const stored = parseNotePriceSnapshots(localStorage.getItem(NOTE_PRICE_STORAGE_KEY))
  expect(stored).toHaveLength(2)
  expect(stored[0]).toEqual(first)
  expect(stored[1].run.config.upperMapping).toBe(1)
  fireEvent.click(screen.getByRole('button', { name: '刷新行情并核对记录' }))
  expect(refresh).toHaveBeenCalledTimes(1)
  view.unmount()
  render(<NotePriceWorkbench analysis={snapshot} onRefresh={refresh} />)
  await waitFor(() => expect(screen.getByText('本地冻结记录 · 2 条')).toBeInTheDocument())
})
test('corrupt history disables freezing and export without deleting raw data', async () => {
  localStorage.setItem(NOTE_PRICE_STORAGE_KEY, '{broken')
  render(<NotePriceWorkbench analysis={forecastFixture().snapshot} onRefresh={vi.fn()} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('原有内容未被覆盖')
  expect(screen.getByRole('button', { name: '冻结本次笔记计算' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '导出笔记影子记录' })).toBeDisabled()
  expect(localStorage.getItem(NOTE_PRICE_STORAGE_KEY)).toBe('{broken')
})
