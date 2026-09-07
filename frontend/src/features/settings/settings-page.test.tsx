import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

  test('defines the complete settings card layout instead of browser-default text', () => {
    const styles = readFileSync(resolve(process.cwd(), 'app/workspace-polish.css'), 'utf8')

    expect(styles).toContain('.sc-settings-header {')
    expect(styles).toContain('.sc-settings-section {')
    expect(styles).toContain('.sc-settings-row {')
    expect(styles).toContain('.sc-settings-status {')
  })
})
