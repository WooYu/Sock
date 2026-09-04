import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { SettingsPage } from './settings-page'

describe('SettingsPage', () => {
  test('shows market-source and local-preference status without pretending to configure the backend', () => {
    render(<SettingsPage />)

    expect(screen.getByRole('heading', { name: '设置' })).toBeVisible()
    expect(screen.getByText('行情与数据')).toBeVisible()
    expect(screen.getByText('本机偏好')).toBeVisible()
  })
})
