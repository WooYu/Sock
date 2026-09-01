import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test } from 'vitest'
import { demoMarketSnapshot } from '../../lib/test/fixtures'
import { AnalysisPage } from './analysis-page'
import { StockWorkspaceProvider, type MarketClient } from '../workspace/stock-workspace-provider'
import type { MarketSnapshot } from '../workspace/stock-workspace-types'

class PendingMarketClient implements MarketClient {
  async snapshot() {
    return new Promise<MarketSnapshot>(() => undefined)
  }
}

function snapshotWithCandles() {
  const snapshot = demoMarketSnapshot('600519') as MarketSnapshot
  snapshot.dailyCandles = Array.from({ length: 20 }, (_, index) => ({
    day: `2026-01-${String(index + 1).padStart(2, '0')}`,
    open: 100 + index,
    high: 103 + index,
    low: 99 + index,
    close: 101 + index,
    volume: 1000 + index,
  }))
  return snapshot
}

describe('AnalysisPage interactions', () => {
  beforeEach(() => localStorage.clear())

  test('keeps analysis tabs horizontal without a vertical scrollbar', () => {
    const styles = readFileSync(resolve(process.cwd(), 'app/workspace-polish.css'), 'utf8')

    expect(styles).toContain('.sc-analysis-tabs { display: flex; align-items: center; gap: 4px; overflow-x: auto; overflow-y: hidden;')
  })

  test('exposes the redesigned analysis workspace regions', () => {
    const { container } = render(
      <StockWorkspaceProvider client={{ snapshot: async () => snapshotWithCandles() }} initialSymbol="600519">
        <AnalysisPage tab="key-levels" />
      </StockWorkspaceProvider>,
    )

    expect(container.querySelector('.sc-analysis-page')).toBeInTheDocument()
    expect(container.querySelector('.sc-analysis-tabs')).toBeInTheDocument()
    expect(container.querySelector('.sc-analysis-actions')).toBeInTheDocument()
  })

  test('shows loading feedback while analysis data is pending', () => {
    render(
      <StockWorkspaceProvider client={new PendingMarketClient()} initialSymbol="600519">
        <AnalysisPage tab="key-levels" />
      </StockWorkspaceProvider>,
    )

    expect(screen.getByRole('status')).toHaveTextContent('正在加载真实行情')
  })

  test('saves a prediction snapshot from a ready analysis', async () => {
    const user = userEvent.setup()
    const client: MarketClient = { snapshot: async () => snapshotWithCandles() }
    render(
      <StockWorkspaceProvider client={client} initialSymbol="600519">
        <AnalysisPage tab="key-levels" />
      </StockWorkspaceProvider>,
    )

    await screen.findByText('关键位分析')
    await user.click(screen.getByRole('button', { name: '保存预测快照' }))

    expect(screen.getByText('预测快照已保存')).toBeInTheDocument()
  })
})
