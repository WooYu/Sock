import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { OverviewPage } from './overview-page'
import { StockWorkspaceProvider, type MarketClient } from '../workspace/stock-workspace-provider'
import { demoMarketSnapshot } from '../../lib/test/fixtures'

const client: MarketClient = { snapshot: async (symbol) => demoMarketSnapshot(symbol) }

describe('OverviewPage interactions', () => {
  test('changes operation cycle and persists the selected strategy', async () => {
    render(<StockWorkspaceProvider client={client}><OverviewPage /></StockWorkspaceProvider>)
    await userEvent.click(screen.getByRole('button', { name: '短线' }))
    expect(screen.getByRole('button', { name: '短线' })).toHaveClass('active')
    await userEvent.click(screen.getByRole('tab', { name: /攀升/ }))
    await userEvent.click(screen.getByRole('button', { name: '设为主策略' }))
    expect(screen.getByRole('status')).toHaveTextContent('主策略已更新')
  })

  test('toggles company adjustments and expands a price zone', async () => {
    render(<StockWorkspaceProvider client={client}><OverviewPage /></StockWorkspaceProvider>)
    await userEvent.click(screen.getByRole('button', { name: '取消公司行为 2026-07-21' }))
    expect(screen.getByText(/当前启用 1 项公司行为/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /上涨目标区/ }))
    expect(screen.getByText(/展开依据/)).toBeInTheDocument()
    expect(screen.getAllByText(/形成近端共振/)).toHaveLength(2)
  })

  test('switches AI explanation tabs and opens model configuration', async () => {
    render(<StockWorkspaceProvider client={client}><OverviewPage /></StockWorkspaceProvider>)
    await userEvent.click(screen.getByRole('button', { name: '解释依据' }))
    expect(screen.getByText('解释依据已展开')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '查看模型配置' }))
    expect(screen.getByRole('dialog', { name: '模型配置' })).toBeInTheDocument()
  })
})
