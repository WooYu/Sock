import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { WebAccountButton } from './web-account-button'

describe('WebAccountButton', () => {
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
