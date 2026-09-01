import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { MarketFeedback, MarketLoadingState } from './market-state'

describe('market state presentation', () => {
  test('renders a loading skeleton instead of an empty state', () => {
    render(<MarketLoadingState variant="overview" />)

    expect(screen.getByRole('status')).toHaveTextContent('正在加载真实行情')
    expect(screen.getByTestId('market-loading-skeleton')).toBeInTheDocument()
    expect(screen.queryByText('真实行情暂不可用')).not.toBeInTheDocument()
  })

  test('renders retryable error feedback', async () => {
    const onRetry = vi.fn()
    render(<MarketFeedback status="error" errorMessage="行情请求失败" onRetry={onRetry} />)

    expect(screen.getByRole('alert')).toHaveTextContent('行情请求失败')
    await userEvent.click(screen.getByRole('button', { name: '重新加载行情' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  test('renders a non-blocking refresh message for an existing snapshot', () => {
    render(<MarketFeedback status="refreshing" hasSnapshot />)

    expect(screen.getByRole('status')).toHaveTextContent('正在刷新行情')
  })
})
