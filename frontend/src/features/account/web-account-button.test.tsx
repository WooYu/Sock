import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { WebAccountButton } from './web-account-button'

describe('WebAccountButton', () => {
  beforeEach(() => localStorage.clear())
  test('requests a code and signs in for cross-device sync', async () => {
    const user = userEvent.setup()
    const requestCode = vi.fn(async () => undefined)
    const verify = vi.fn(async () => ({ accessToken: 'token', refreshToken: 'refresh', expiresAt: '2026-09-02T00:00:00Z' }))
    render(<WebAccountButton requestCode={requestCode} verify={verify} />)
    await user.click(screen.getByRole('button', { name: '登录同步' }))
    await user.type(screen.getByLabelText('手机号'), '13800138000')
    await user.click(screen.getByRole('button', { name: '获取验证码' }))
    await user.type(screen.getByLabelText('验证码'), '000000')
    await user.click(screen.getByRole('button', { name: '确认登录' }))
    expect(await screen.findByText('已登录 · 跨设备同步')).toBeInTheDocument()
  })
})

test('login traps focus, dismisses with Escape and restores the trigger', async () => {
  localStorage.clear()
  const user = userEvent.setup()
  render(<WebAccountButton />)
  const trigger = screen.getByRole('button', { name: '登录同步' })
  await user.click(trigger)
  expect(screen.getByRole('dialog', { name: '登录 StockCal' })).toBeInTheDocument()
  expect(screen.getByLabelText('手机号')).toHaveFocus()
  expect(document.body.style.overflow).toBe('hidden')
  screen.getByRole('button', { name: '确认登录' }).focus()
  await user.tab()
  expect(screen.getByRole('button', { name: '关闭登录' })).toHaveFocus()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
  expect(document.body.style.overflow).not.toBe('hidden')
})

test('validates phone input and blocks duplicate requests while sending a code', async () => {
  localStorage.clear()
  let finish!: () => void
  const requestCode = vi.fn(() => new Promise<void>(resolve => { finish = resolve }))
  const user = userEvent.setup()
  render(<WebAccountButton requestCode={requestCode} />)
  await user.click(screen.getByRole('button', { name: '登录同步' }))
  await user.click(screen.getByRole('button', { name: '获取验证码' }))
  expect(screen.getByRole('alert')).toHaveTextContent('11 位手机号')
  expect(requestCode).not.toHaveBeenCalled()
  await user.type(screen.getByLabelText('手机号'), '13800138000')
  await user.click(screen.getByRole('button', { name: '获取验证码' }))
  expect(screen.getByRole('button', { name: '发送中…' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '确认登录' })).toBeDisabled()
  finish()
  expect(await screen.findByRole('status')).toHaveTextContent('验证码已发送')
  expect(requestCode).toHaveBeenCalledTimes(1)
})
