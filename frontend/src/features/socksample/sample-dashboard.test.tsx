import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { SampleDashboard } from './sample-dashboard'

describe('SampleDashboard', () => {
  test('renders the exported sample workbench landmarks', () => {
    render(<SampleDashboard />)

    expect(screen.getByRole('heading', { name: '组合总览' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'AI策略分析中心' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '你的经验优先于默认模型' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '移动端导航' })).toBeInTheDocument()
  })

  test('changes the operating cycle and exposes the selected profile', async () => {
    const user = userEvent.setup()
    render(<SampleDashboard />)

    await user.click(screen.getByRole('tab', { name: '波段' }))

    expect(screen.getByRole('tab', { name: '波段' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('震荡偏多')).toBeInTheDocument()
  })
})
