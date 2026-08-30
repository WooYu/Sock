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

  test('switches the active K-line period', async () => {
    render(<ChartWorkspace />)
    await userEvent.click(screen.getByRole('tab', { name: '周线' }))
    expect(screen.getByRole('tab', { name: '周线' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '日线' })).toHaveAttribute('aria-selected', 'false')
  })

  test('toggles indicators independently', async () => {
    render(<ChartWorkspace />)
    await userEvent.click(screen.getByRole('switch', { name: 'MA5' }))
    expect(screen.getByRole('switch', { name: 'MA5' })).not.toBeChecked()
    expect(screen.getByRole('switch', { name: 'BOLL' })).toBeChecked()
  })

  test('changes chart zoom without changing the selected period', async () => {
    render(<ChartWorkspace />)
    expect(screen.getByText('100%')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '放大' }))
    expect(screen.getByText('110%')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '日线' })).toHaveAttribute('aria-selected', 'true')
  })

  test('renders the prototype chart structure and future indicator extension', () => {
    render(<ChartWorkspace />)
    expect(screen.getByRole('img', { name: 'K线主图' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '日线与未来指标延伸' })).toBeInTheDocument()
    expect(screen.getByText('D+1')).toBeInTheDocument()
    expect(screen.getAllByText('BOLL上轨').length).toBeGreaterThan(0)
  })
})
