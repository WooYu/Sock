import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import {
  StockWorkspaceProvider,
  useStockWorkspace,
  type MarketClient,
} from './stock-workspace-provider'
import { demoMarketSnapshot } from '../../lib/test/fixtures'

class DeferredMarketClient implements MarketClient {
  private pending = new Map<string, (value: ReturnType<typeof demoMarketSnapshot>) => void>()

  async snapshot(symbol: string) {
    return new Promise<ReturnType<typeof demoMarketSnapshot>>((resolve) => {
      this.pending.set(symbol, resolve)
    })
  }

  resolve(symbol: string) {
    act(() => this.pending.get(symbol)?.(demoMarketSnapshot(symbol)))
  }
}

function Probe() {
  const workspace = useStockWorkspace()
  return (
    <div>
      <p>当前股票：{workspace.selectedSymbol ?? '未选择'}</p>
      <p>状态：{workspace.status}</p>
      <button type="button" onClick={() => workspace.selectStock('600519')}>
        选择 600519
      </button>
      <button type="button" onClick={() => workspace.selectStock('000001')}>
        选择 000001
      </button>
      <button type="button" onClick={() => workspace.refresh()}>
        刷新
      </button>
    </div>
  )
}

describe('StockWorkspaceProvider', () => {
  test('a newer stock selection wins when requests resolve out of order', async () => {
    const market = new DeferredMarketClient()
    render(
      <StockWorkspaceProvider client={market}>
        <Probe />
      </StockWorkspaceProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: '选择 600519' }))
    await userEvent.click(screen.getByRole('button', { name: '选择 000001' }))
    market.resolve('000001')
    await screen.findByText('状态：ready')
    market.resolve('600519')

    expect(screen.getByText('当前股票：000001')).toBeInTheDocument()
  })

  test('refresh failure retains the last successful snapshot', async () => {
    let calls = 0
    const market: MarketClient = {
      async snapshot(symbol) {
        calls += 1
        if (calls > 1) throw new Error('行情服务暂时不可用')
        return demoMarketSnapshot(symbol)
      },
    }
    render(
      <StockWorkspaceProvider client={market}>
        <Probe />
      </StockWorkspaceProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: '选择 600519' }))
    await screen.findByText('状态：ready')
    await userEvent.click(screen.getByRole('button', { name: '刷新' }))

    expect(await screen.findByText('状态：stale')).toBeInTheDocument()
    expect(screen.getByText('当前股票：600519')).toBeInTheDocument()
  })

  test('retrying an initial load stays in loading state until it succeeds', async () => {
    let calls = 0
    const market: MarketClient = {
      async snapshot() {
        calls += 1
        if (calls === 1) throw new Error('行情服务暂时不可用')
        return new Promise(() => undefined)
      },
    }
    render(
      <StockWorkspaceProvider client={market}>
        <Probe />
      </StockWorkspaceProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: '选择 600519' }))
    await screen.findByText('状态：error')
    await userEvent.click(screen.getByRole('button', { name: '刷新' }))

    expect(screen.getByText('状态：loading')).toBeInTheDocument()
  })

  test('deep link initialSymbol loads the shared workspace', async () => {
    const market: MarketClient = { snapshot: async (symbol) => demoMarketSnapshot(symbol) }
    render(
      <StockWorkspaceProvider client={market} initialSymbol="600519">
        <Probe />
      </StockWorkspaceProvider>,
    )

    expect(screen.getByText('当前股票：600519')).toBeInTheDocument()
    expect(await screen.findByText('状态：ready')).toBeInTheDocument()
  })
})
