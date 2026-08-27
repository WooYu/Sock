import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { ChartWorkspace } from './chart-workspace'

describe('ChartWorkspace', () => {
  test('selecting a drawing tool clears the previous drawing tool', async () => {
    render(<ChartWorkspace />)
    await userEvent.click(screen.getByRole('button', { name: '趋势线' }))
    await userEvent.click(screen.getByRole('button', { name: '矩形' }))
    expect(screen.getByRole('button', { name: '矩形' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '趋势线' })).toHaveAttribute('aria-pressed', 'false')
  })

  test('hiding key levels does not hide trade annotations', async () => {
    render(<ChartWorkspace />)
    await userEvent.click(screen.getByRole('switch', { name: '关键位' }))
    expect(screen.queryByTestId('key-level-layer')).not.toBeInTheDocument()
    expect(screen.getByTestId('trade-layer')).toBeInTheDocument()
  })

  test('creates a rectangle and can undo it', async () => {
    render(<ChartWorkspace />)
    await userEvent.click(screen.getByRole('button', { name: '矩形' }))
    await userEvent.click(screen.getByRole('button', { name: '添加矩形示例' }))
    expect(screen.getByTestId('annotation-rectangle')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '撤销' }))
    expect(screen.queryByTestId('annotation-rectangle')).not.toBeInTheDocument()
  })
})
