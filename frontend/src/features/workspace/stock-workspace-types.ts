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

export type RuleConditionField =
  | 'closeAboveMa5'
  | 'closeAboveMa20'
  | 'closeAboveBollMiddle'
  | 'ma5SlopePositive'
  | 'bollMiddleSlopePositive'
  | 'volumeRatio'
  | 'supportDistance'
  | 'granvilleDay'
  | 'phase'
  | 'marketPanic'
  | 'relativeStrength'
  | 'phase3Opening'
  | 'mirrorRetest'

export type RuleConditionOperator = 'equals' | 'greaterThan' | 'greaterThanOrEqual' | 'lessThan' | 'lessThanOrEqual'

export type RuleCondition = {
  field: RuleConditionField
  operator: RuleConditionOperator
  value: number
}

export type RuleEvaluation = {
  ruleId: string
  status: 'matched' | 'not-matched' | 'insufficient'
  conditions: Array<{ field: RuleConditionField; actual: number | boolean | string | null; passed: boolean | null }>
  missingFacts: string[]
  failedConditions: string[]
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
  mode?: string
  priority: number
  evidence: DecisionEvidence[]
  conditions?: RuleCondition[]
  invalidationConditions?: string[]
}

export type DecisionResult = {
  action: DecisionAction
  mode?: StrategyMode
  reason: string
  matchedRules: DecisionRule[]
  ruleEvaluations?: RuleEvaluation[]
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
  ruleEvaluations?: RuleEvaluation[]
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
