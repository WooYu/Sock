import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { AppDialog } from './app-dialog'

afterEach(() => vi.unstubAllGlobals())

function DialogWorkflow() {
  const [open, setOpen] = useState(false), [nested, setNested] = useState(false)
  return <><button onClick={() => setOpen(true)}>开始编辑</button>{open ? <AppDialog title="编辑记录" onClose={() => setOpen(false)}><label>内容<input /></label><button onClick={() => setNested(true)}>查看依据</button>{nested ? <AppDialog title="原文依据" onClose={() => setNested(false)}><p>原文</p></AppDialog> : null}</AppDialog> : null}</>
}

test('nested dialogs keep the page locked until the last closes and restore their triggers', async () => {
  const user = userEvent.setup()
  render(<DialogWorkflow />)
  const trigger = screen.getByRole('button', { name: '开始编辑' })
  await user.click(trigger)
  expect(document.documentElement.style.overflow).toBe('hidden')
  expect(document.body.style.overflow).toBe('hidden')
  const inspect = screen.getByRole('button', { name: '查看依据' })
  await user.click(inspect)
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog', { name: '原文依据' })).not.toBeInTheDocument()
  expect(screen.getByRole('dialog', { name: '编辑记录' })).toBeInTheDocument()
  expect(inspect).toHaveFocus()
  expect(document.documentElement.style.overflow).toBe('hidden')
  await user.keyboard('{Escape}')
  expect(document.documentElement.style.overflow).not.toBe('hidden')
  expect(document.body.style.overflow).not.toBe('hidden')
  expect(trigger).toHaveFocus()
})

test('opening a phone dialog focuses its close control without raising the keyboard', async () => {
  vi.stubGlobal('innerWidth', 390)
  const user = userEvent.setup()
  render(<DialogWorkflow />)
  await user.click(screen.getByRole('button', { name: '开始编辑' }))
  expect(screen.getByRole('button', { name: '关闭编辑记录' })).toHaveFocus()
  screen.getByRole('button', { name: '查看依据' }).focus()
  await user.tab()
  expect(screen.getByRole('button', { name: '关闭编辑记录' })).toHaveFocus()
})
