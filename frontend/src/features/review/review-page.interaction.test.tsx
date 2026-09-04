import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test } from 'vitest'
import { ReviewPage } from './review-page'

describe('ReviewPage interactions', () => {
  beforeEach(() => localStorage.clear())

  test('exposes the shared review workspace regions', () => {
    const { container } = render(<ReviewPage initialTab="daily" />)

    expect(container.querySelector('.sc-review-workspace')).toBeInTheDocument()
    expect(container.querySelector('.sc-review-header')).toBeInTheDocument()
    expect(container.querySelector('.sc-workspace-tabs')).toBeInTheDocument()
    expect(container.querySelector('.sc-review-content')).toBeInTheDocument()
    expect(container.querySelector('.sc-daily-review-form')).toBeInTheDocument()
    expect(container.querySelector('.sc-review-primary-action')).toBeInTheDocument()
  })

  test('saves the daily review and restores it on a later render', async () => {
    const user = userEvent.setup()
    const first = render(<ReviewPage initialTab="daily" />)
    expect(screen.getByLabelText('市场判断')).toBeInTheDocument()
    expect(screen.getByLabelText('执行情况')).toBeInTheDocument()
    expect(screen.getByLabelText('改进点')).toBeInTheDocument()
    await user.type(screen.getByLabelText('市场判断'), '今天等待回踩，没有追高。')
    await user.click(screen.getByRole('button', { name: '保存当日总结' }))

    expect(screen.getByText('当日总结已保存')).toBeInTheDocument()
    first.unmount()
    render(<ReviewPage initialTab="daily" />)

    expect(screen.getByDisplayValue('今天等待回踩，没有追高。')).toBeInTheDocument()
  })
})
