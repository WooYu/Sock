import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { ChartMobileSheet } from './chart-mobile-sheet'

function SheetHarness() {
  const [open, setOpen] = useState(false)
  return <><button onClick={() => setOpen(true)}>打开属性</button>{open ? <ChartMobileSheet onClose={() => setOpen(false)} title="对象属性"><input aria-label="备注" /><button>保存设置</button></ChartMobileSheet> : null}<button>外部操作</button></>
}

test('contains forward and reverse keyboard navigation and restores the opener on Escape', async () => {
  const user = userEvent.setup()
  render(<SheetHarness />)
  const opener = screen.getByRole('button', { name: '打开属性' })
  const restoreFocus = vi.spyOn(opener, 'focus')
  await user.click(opener)
  const dialog = screen.getByRole('dialog', { name: '对象属性' })
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect(dialog.contains(document.activeElement)).toBe(true)
  const first = document.activeElement
  await user.tab({ shift: true })
  expect(within(dialog).getByRole('button', { name: '保存设置' })).toHaveFocus()
  await user.tab()
  expect(document.activeElement).toBe(first)
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(opener).toHaveFocus()
  expect(restoreFocus).toHaveBeenLastCalledWith({ preventScroll: true })
  restoreFocus.mockRestore()
})

test('keeps the page locked until the last sheet closes and restores its original styles', () => {
  const root = document.documentElement, body = document.body
  const original = { root: root.style.overflow, body: body.style.overflow, overscroll: root.style.overscrollBehavior }
  root.style.overflow = 'scroll'
  body.style.overflow = 'clip'
  root.style.overscrollBehavior = 'contain'
  const first = render(<ChartMobileSheet onClose={() => {}} title="第一层">内容</ChartMobileSheet>)
  const second = render(<ChartMobileSheet onClose={() => {}} title="第二层">内容</ChartMobileSheet>)
  expect(root.style.overflow).toBe('hidden')
  expect(body.style.overflow).toBe('hidden')
  first.unmount()
  expect(root.style.overflow).toBe('hidden')
  second.unmount()
  expect(root.style.overflow).toBe('scroll')
  expect(body.style.overflow).toBe('clip')
  expect(root.style.overscrollBehavior).toBe('contain')
  root.style.overflow = original.root
  body.style.overflow = original.body
  root.style.overscrollBehavior = original.overscroll
})

test('short drags remain open even when the browser dispatches a following click', () => {
  const onClose = vi.fn()
  render(<ChartMobileSheet onClose={onClose} title="对象属性"><input aria-label="备注" /></ChartMobileSheet>)
  const handle = screen.getByRole('button', { name: '拖动关闭对象属性' })
  fireEvent.pointerDown(handle, { pointerId: 1, clientY: 100 })
  fireEvent.pointerMove(handle, { pointerId: 1, clientY: 125 })
  fireEvent.pointerUp(handle, { pointerId: 1, clientY: 125 })
  fireEvent.click(handle, { detail: 1 })
  expect(onClose).not.toHaveBeenCalled()
})

test('traps focus using tabbable controls rather than inactive date tabs', async () => {
  const user = userEvent.setup()
  render(<><ChartMobileSheet onClose={() => {}} title="预测详情"><div role="tablist" aria-label="预测日期"><button role="tab" aria-selected="true" tabIndex={0}>明日</button><button role="tab" aria-selected="false" tabIndex={-1}>第2日</button><button role="tab" aria-selected="false" tabIndex={-1}>第3日</button></div></ChartMobileSheet><button>外部操作</button></>)
  const handle = screen.getByRole('button', { name: '拖动关闭预测详情' })
  expect(handle).toHaveFocus()
  await user.tab({ shift: true })
  expect(screen.getByRole('tab', { name: '明日' })).toHaveFocus()
  await user.tab()
  expect(handle).toHaveFocus()
})

test('a canceled drag stays open and a completed long drag closes the sheet', () => {
  const onClose = vi.fn()
  render(<ChartMobileSheet onClose={onClose} title="对象属性"><input aria-label="备注" /></ChartMobileSheet>)
  const handle = screen.getByRole('button', { name: '拖动关闭对象属性' })
  fireEvent.pointerDown(handle, { pointerId: 1, clientY: 100 })
  fireEvent.pointerMove(handle, { pointerId: 1, clientY: 220 })
  fireEvent.pointerCancel(handle, { pointerId: 1, clientY: 220 })
  expect(onClose).not.toHaveBeenCalled()
  fireEvent.pointerDown(handle, { pointerId: 2, clientY: 100 })
  fireEvent.pointerMove(handle, { pointerId: 2, clientY: 220 })
  fireEvent.pointerUp(handle, { pointerId: 2, clientY: 220 })
  expect(onClose).toHaveBeenCalledTimes(1)
})
