import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test } from 'vitest'
import { RulesPage } from './rules-page'

describe('RulesPage interactions', () => {
  beforeEach(() => localStorage.clear())

  test('shows built-in rules when no local rules exist', () => {
    render(<RulesPage />)

    expect(screen.getByText('5日线上方优先参与')).toBeInTheDocument()
    expect(screen.getByText('大盘暴跌时优先看海龟')).toBeInTheDocument()
    expect(screen.getByText('破位5日线不做')).toBeInTheDocument()
  })

  test('creates a draft and publishes it from the rule workspace', async () => {
    const user = userEvent.setup()
    render(<RulesPage />)

    await user.click(screen.getByRole('button', { name: '新建规则' }))
    await user.type(screen.getByLabelText('规则名称'), '回踩 MA5 不追高')
    await user.type(screen.getByLabelText('规则说明'), '价格回踩 MA5 后再观察。')
    await user.click(screen.getByRole('button', { name: '保存规则草稿' }))

    expect(screen.getByText('回踩 MA5 不追高')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '发布回踩 MA5 不追高' }))

    expect(screen.getByRole('status')).toHaveTextContent('规则已发布')
  })

  test('toggles a rule and opens its detail panel', async () => {
    const user = userEvent.setup()
    render(<RulesPage />)

    const toggle = screen.getByRole('button', { name: '停用规则 5日线上方优先参与' })
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await user.click(toggle)
    expect(screen.getByRole('button', { name: '启用规则 5日线上方优先参与' })).toHaveAttribute('aria-pressed', 'false')

    await user.click(screen.getByRole('button', { name: '查看规则详情 5日线上方优先参与' }))
    expect(screen.getByRole('dialog', { name: '规则详情 5日线上方优先参与' })).toBeInTheDocument()
  })
})
