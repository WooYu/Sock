import type { Candle, MarketSnapshot } from '../workspace/stock-workspace-types'
import type { ChartPeriod } from './chart-periods'

export type PriceAdjustment = 'none' | 'qfq' | 'hfq'
export type ChartSeries = {
  symbol: string
  period: ChartPeriod
  adjustment: PriceAdjustment
  kind: 'candles' | 'intraday'
  bars: Candle[]
  source: MarketSnapshot['source']
  previousClose?: number
  limitedHistory: boolean
  note?: string
}
