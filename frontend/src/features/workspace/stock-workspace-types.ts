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

export type DecisionAction = 'ENTER' | 'HOLD' | 'REDUCE' | 'EXIT' | 'AVOID' | 'WAIT'

export type StrategyMode =
  | 'baseGranville'
  | 'phase3Opening'
  | 'seaTurtle'
  | 'rebound'
  | 'mirrorRetest'
  | 'sidewaysPhase3'
  | 'monthlyWait'
  | 'demonStock'
  | 'exclusion'

export type DecisionEvidence = {
  id: string
  label: string
  detail?: string
}

export type DecisionCalibration = {
  sampleCount: number
  hitRate: number
  meanAbsoluteError: number
  meanSlippage: number
  maximumDrawdown: number
  calibrated: boolean
  confidence: number | null
}

export type DecisionRule = {
  ruleId: string
  version: number
  name: string
  score?: number
  band?: string
  action: DecisionAction
  priority: number
  evidence: DecisionEvidence[]
}

export type DecisionResult = {
  action: DecisionAction
  mode?: StrategyMode
  reason: string
  matchedRules: DecisionRule[]
  missingFacts: string[]
  conflicts: string[]
  invalidationConditions: string[]
  evidence: DecisionEvidence[]
  calibration?: DecisionCalibration
}

export type StockAnalysis = {
  support: number | null
  resistance: number | null
  target: number | null
  direction: 'bullish' | 'neutral' | 'bearish'
  confidence: number | null
  directionStrength: number
  matchedRules: DecisionRule[]
  future: Array<{ day: string; maValues: Record<string, number>; bollUpper: number; bollMiddle: number; bollLower: number }>
  decision: DecisionResult
}

export type StockWorkspaceSnapshot = {
  symbol: string
  security: Security
  market: MarketSnapshot
  analysis: StockAnalysis | null
  cycle: OperationCycle
  generatedAt: string
}
