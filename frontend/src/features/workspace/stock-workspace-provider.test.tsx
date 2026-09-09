import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import {
  StockWorkspaceProvider,
  useStockWorkspace,
  type MarketClient,
} from './stock-workspace-provider'
import { demoMarketSnapshot } from '../../lib/test/fixtures'
import type { PredictionSnapshot } from '../chart/chart-types'

function predictionSnapshot(symbol: string, modelVersion = 'baseline-v1'): PredictionSnapshot {
  return {
    symbol,
    period: 'day',
    generatedAt: '2026-09-09T08:00:00.000Z',
    modelVersion,
    days: [
      { day: '2026-09-09', open: 100, high: 105, low: 99, close: 104, rangeLow: 98, rangeHigh: 106, confidence: 0.7, ma5: 101, ma10: 100, ma20: 99, bollUpper: 108, bollMiddle: 101, bollLower: 94 },
      { day: '2026-09-10', open: 104, high: 107, low: 102, close: 106, rangeLow: 101, rangeHigh: 108, confidence: 0.65, ma5: 102, ma10: 101, ma20: 100, bollUpper: 109, bollMiddle: 102, bollLower: 95 },
      { day: '2026-09-11', open: 106, high: 109, low: 104, close: 108, rangeLow: 103, rangeHigh: 110, confidence: 0.6, ma5: 103, ma10: 102, ma20: 101, bollUpper: 110, bollMiddle: 103, bollLower: 96 },
    ],
  }
}

type PredictionResolver = (value: PredictionSnapshot) => void

class DeferredPredictionClient implements MarketClient {
  readonly signals: AbortSignal[] = []
  private pending: PredictionResolver[] = []

  async snapshot(symbol: string) {
    return demoMarketSnapshot(symbol)
  }

  async prediction(_symbol: string, signal?: AbortSignal) {
    if (signal) this.signals.push(signal)
    return new Promise<PredictionSnapshot>((resolve) => {
      this.pending.push(resolve)
    })
  }

  async resolve(index: number, prediction: PredictionSnapshot) {
    await act(async () => {
      this.pending[index]?.(prediction)
      await Promise.resolve()
    })
  }
}

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
      <p>周期：{workspace.cycle}</p>
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

function PredictionProbe() {
  const workspace = useStockWorkspace()
  return (
    <div>
      <p>Status: {workspace.status}</p>
      <p>Prediction: {workspace.current?.prediction ? `${workspace.current.prediction.symbol}/${workspace.current.prediction.modelVersion}` : 'none'}</p>
      <p>Error: {workspace.errorMessage ?? 'none'}</p>
      <button type="button" onClick={() => workspace.selectStock('600519')}>Select 600519</button>
      <button type="button" onClick={() => workspace.selectStock('000001')}>Select 000001</button>
      <button type="button" onClick={() => workspace.refresh()}>Refresh</button>
    </div>
  )
}

describe('StockWorkspaceProvider', () => {
  test('defaults analysis to the short operation cycle', () => {
    render(
      <StockWorkspaceProvider client={{ snapshot: async (symbol) => demoMarketSnapshot(symbol) }}>
        <Probe />
      </StockWorkspaceProvider>,
    )

    expect(screen.getByText('周期：short')).toBeInTheDocument()
  })

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

  test('publishes history as ready while prediction is pending', async () => {
    const market = new DeferredPredictionClient()
    render(<StockWorkspaceProvider client={market}><PredictionProbe /></StockWorkspaceProvider>)

    await userEvent.click(screen.getByRole('button', { name: 'Select 600519' }))

    expect(await screen.findByText('Status: ready')).toBeInTheDocument()
    expect(market.signals).toHaveLength(1)
    expect(screen.getByText('Prediction: none')).toBeInTheDocument()
  })

  test('adds a resolved prediction to the current workspace snapshot', async () => {
    const market = new DeferredPredictionClient()
    render(<StockWorkspaceProvider client={market}><PredictionProbe /></StockWorkspaceProvider>)

    await userEvent.click(screen.getByRole('button', { name: 'Select 600519' }))
    await screen.findByText('Status: ready')
    await market.resolve(0, predictionSnapshot('600519'))

    expect(await screen.findByText('Prediction: 600519/baseline-v1')).toBeInTheDocument()
  })

  test('keeps history ready when prediction loading fails', async () => {
    let predictionCalls = 0
    const market: MarketClient = {
      snapshot: async (symbol) => demoMarketSnapshot(symbol),
      prediction: async () => {
        predictionCalls += 1
        throw new Error('prediction unavailable')
      },
    }
    render(<StockWorkspaceProvider client={market}><PredictionProbe /></StockWorkspaceProvider>)

    await userEvent.click(screen.getByRole('button', { name: 'Select 600519' }))

    expect(await screen.findByText('Status: ready')).toBeInTheDocument()
    expect(predictionCalls).toBe(1)
    expect(screen.getByText('Prediction: none')).toBeInTheDocument()
    expect(screen.getByText('Error: none')).toBeInTheDocument()
  })

  test('does not attach a superseded stock prediction', async () => {
    const market = new DeferredPredictionClient()
    render(<StockWorkspaceProvider client={market}><PredictionProbe /></StockWorkspaceProvider>)

    await userEvent.click(screen.getByRole('button', { name: 'Select 600519' }))
    await screen.findByText('Status: ready')
    await userEvent.click(screen.getByRole('button', { name: 'Select 000001' }))
    await screen.findByText('Status: ready')
    await market.resolve(0, predictionSnapshot('600519', 'superseded'))

    expect(screen.getByText('Prediction: none')).toBeInTheDocument()
    await market.resolve(1, predictionSnapshot('000001', 'current'))
    expect(await screen.findByText('Prediction: 000001/current')).toBeInTheDocument()
  })

  test('does not attach a prediction from a superseded refresh', async () => {
    const market = new DeferredPredictionClient()
    render(<StockWorkspaceProvider client={market}><PredictionProbe /></StockWorkspaceProvider>)

    await userEvent.click(screen.getByRole('button', { name: 'Select 600519' }))
    await screen.findByText('Status: ready')
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    await screen.findByText('Status: ready')
    await market.resolve(0, predictionSnapshot('600519', 'superseded'))

    expect(screen.getByText('Prediction: none')).toBeInTheDocument()
    await market.resolve(1, predictionSnapshot('600519', 'current'))
    expect(await screen.findByText('Prediction: 600519/current')).toBeInTheDocument()
  })

  test('aborts prediction loading when the provider unmounts', async () => {
    const market = new DeferredPredictionClient()
    const view = render(<StockWorkspaceProvider client={market}><PredictionProbe /></StockWorkspaceProvider>)
    await userEvent.click(screen.getByRole('button', { name: 'Select 600519' }))
    await screen.findByText('Status: ready')

    view.unmount()

    expect(market.signals[0]?.aborted).toBe(true)
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
