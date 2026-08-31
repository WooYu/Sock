import type { OperationCycle } from '../workspace/stock-workspace-types'

export type PredictionRecord = {
  id: string
  symbol: string
  securityName: string
  cycle: OperationCycle
  createdAt: string
  direction: string
  confidence: number
  support: number
  resistance: number
  target: number
  reason: string
}

export type TradeRecord = {
  id: string
  symbol: string
  side: 'buy' | 'sell'
  quantity: number
  price: number
  fee: number
  tradedAt: string
  note: string
}

export type ReviewRecord = {
  id: string
  date: string
  content: string
  tradeId?: string
  predictionId?: string
  createdAt: string
}
