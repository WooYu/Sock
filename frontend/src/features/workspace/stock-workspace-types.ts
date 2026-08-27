export type OperationCycle = 'short' | 'swing' | 'long'

export type WorkspaceStatus =
  | 'idle'
  | 'searching'
  | 'loading'
  | 'refreshing'
  | 'ready'
  | 'stale'
  | 'offline'
  | 'error'

export type Security = {
  code: string
  name: string
  pinyin?: string
  initials?: string
  exchange?: string
  industry?: string
}

export type Candle = {
  day: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type MarketSnapshot = {
  quote: {
    security: Security
    price: number
    previousClose?: number
    open?: number
    high?: number
    low?: number
    volume?: number
    turnover?: number
    limitRatio?: number
  }
  dailyCandles: Candle[]
  source: {
    name: string
    fetchedAt: string
    state: string
    online: boolean
  }
}

export type StockAnalysis = {
  support: number
  resistance: number
  target: number
  direction: 'bullish' | 'neutral' | 'bearish'
  confidence: number
  directionStrength: number
  matchedRules: Array<{ name: string; score: number; band: string }>
  future: Array<{ day: string; maValues: Record<string, number>; bollUpper: number; bollMiddle: number; bollLower: number }>
}

export type StockWorkspaceSnapshot = {
  symbol: string
  security: Security
  market: MarketSnapshot
  analysis: StockAnalysis | null
  cycle: OperationCycle
  generatedAt: string
}
