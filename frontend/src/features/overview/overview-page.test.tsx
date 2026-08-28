import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { OverviewPage } from './overview-page'
import {
  StockWorkspaceProvider,
  type MarketClient,
} from '../workspace/stock-workspace-provider'
import { demoMarketSnapshot } from '../../lib/test/fixtures'

const client: MarketClient = {
  snapshot: async (symbol) => demoMarketSnapshot(symbol),
}

describe('OverviewPage', () => {
  test('renders the prototype dashboard sections with demo portfolio data', () => {
    render(
      <StockWorkspaceProvider client={client}>
        <OverviewPage />
      </StockWorkspaceProvider>,
    )

    expect(screen.getByRole('heading', { name: '组合总览' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '当前更适合哪种盈利方式？' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '关键区域与目标位' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'AI策略分析中心' })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: '持仓股票盈亏' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '华芯动力' })).toBeInTheDocument()
  })

  test('holding selection updates the shared analysis context', async () => {
    render(
      <StockWorkspaceProvider client={client}>
        <OverviewPage holdings={[{ symbol: '600519', name: '贵州茅台' }]} />
      </StockWorkspaceProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: /贵州茅台/ }))
    expect(await screen.findByText('当前股票：600519')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '查看个股分析' })).toHaveAttribute(
      'href',
      '/analysis/key-levels?symbol=600519',
    )
  })
})
