import type { Candle, MarketSnapshot } from '../workspace/stock-workspace-types'

export type AnalysisPeriod = 'day' | '60m' | '30m'
export type Horizon = 1 | 2 | 3 | 4
export type Indicator = 'ma5' | 'ma10' | 'ma20' | 'ma30' | 'ma60' | 'ma90' | 'ma120' | 'ma250' | 'bollUpper' | 'bollMiddle' | 'bollLower'
export type TradingCalendar = { fromDay: string; throughDay: string; tradingDays: string[]; sourceUrl: string; verifiedAt: string }
export type PeriodInput = {
  symbol: string; period: AnalysisPeriod; asOf: string; adjustment: 'none' | 'qfq'
  source: MarketSnapshot['source']; closed: Candle[]; observed: Candle[]
  lastClosedAt: string | null; issues: string[]
}
export type AnalysisInput = {
  symbol: string; asOf: string; sourceMode: 'real' | 'demo'; calendar: TradingCalendar | null
  periods: Partial<Record<AnalysisPeriod, PeriodInput>>; loadIssues: Partial<Record<AnalysisPeriod, string[]>>
}
export type BarTarget = { horizon: Horizon; barKey: string | null; endAt: string | null; issues: string[] }
export type ExecutionWindow = { period: AnalysisPeriod; startAt: string; endAt: string }
export type EvidenceRef = { recordId: string; tagVersion: number; sourceHash: string; sourceUrl: string; startLine: number; endLine: number; quote: string }
export type CloseScenario = {
  id: string; symbol: string; period: AnalysisPeriod; originBarKey: string
  kind: 'base' | 'continuation' | 'pullback'; closes: number[]; condition: string; selectedAt: string; evidence: EvidenceRef[]
}
export type PriceReference = {
  id: string; adjustment?: 'none' | 'qfq'; period: AnalysisPeriod; indicator: Indicator; method: 'average_delta' | 'last_delta' | 'rolling_close'
  scenarioId: string | null; originBarKey: string; originEndAt: string; asOf: string; target: BarTarget
  executionWindow: ExecutionWindow | null; value: number | null; valid: boolean; issues: string[]
}
export type MergedLevel = { id: string; value: number; references: PriceReference[] }
export type ReferenceMergeSelection = { method: PriceReference['method']; scenarioIds: Partial<Record<AnalysisPeriod, string>> }
export type PriceConsolidation = ReferenceMergeSelection & {
  definitionVersion: 'reference-mean-1pct-v1'; tolerance: 0.01; aggregation: 'arithmetic_mean'
}
export type DailyPriceLimit = { source: 'board_default' | 'manual' | 'unverified' | 'demo'; ratio: number | null; label: string }
export type DailyPriceSelection = { limit: DailyPriceLimit }
export type DailyPriceLevel = { id: string; value: number; changeRatio: number; kind: 'merged' | 'grid'; groupIds: string[] }
export type DailyPriceLadder = {
  definitionVersion: 'daily-close-ladder-v1' | 'daily-close-levels-v2'; tickSize: 0.01
  selection: DailyPriceSelection & { count?: 3 | 4 | 5 }
  anchor: { barKey: string; endAt: string; close: number } | null; band: { lower: number; upper: number } | null
  up: DailyPriceLevel[]; down: DailyPriceLevel[]; excludedGroupIds: string[]; issues: string[]
}
export type ProvisionalAnalysis = {
  kind: 'provisional'; period: AnalysisPeriod; originBarKey: string; observedAt: string; condition: string
  observedClose: number; indicators: Record<Indicator, number | null>; references: PriceReference[]
}

export type AnalysisKind = 'live' | 'replay'
export type TrendDirection = 'rising' | 'falling' | 'sideways' | 'unknown'
export type RiseStyle = 'climbing' | 'surging' | 'unknown'
export type ScenarioMode = 'trend_climb' | 'mirror_retest' | 'down_rebound' | 'range'
export type Confirmation = { period: AnalysisPeriod; barKey: string; eventAt: string; confirmedAt: string; reason: string }
export type TrendConfirmation = Confirmation & { direction: TrendDirection; style: RiseStyle }
export type GranvilleEvent = Confirmation & { context: 'up' | 'down'; kind: 'anchor' | 'reset' }
export type AnalysisAnnotations = {
  periodSelections?: Partial<Record<AnalysisPeriod, PeriodSelection>>
  trends?: Partial<Record<AnalysisPeriod, TrendConfirmation>>
  shocks?: Partial<Record<AnalysisPeriod, Confirmation>>
  granvilleEvents?: GranvilleEvent[]
  mode?: Confirmation & { id: ScenarioMode }
  mirror?: { period: AnalysisPeriod; linePrice: number; selectedAt: string; breakBarKey: string; retestBarKey: string; direction: 'up' | 'down'; touchTolerance: number | null; reason: string }
  range?: Confirmation & { lower: number; upper: number }
  bottom?: { period: AnalysisPeriod; kind: 'indicator' | 'price'; indicator?: Indicator; price?: number; selectedAt: string; reason: string }
  holding?: 'flat' | 'held' | 'unknown'
  flags?: Partial<Record<'phase3Opening' | 'doubleHigh', Confirmation & { value: boolean }>>
  disabledRules?: Record<string, string>
  discontinuities?: Array<{ period: AnalysisPeriod; barKey: string; reason: string; evidence?: EvidenceRef[] }>
}
export type PeriodSelection = {
  mode: NonNullable<AnalysisAnnotations['mode']>; bottom?: AnalysisAnnotations['bottom']; mirror?: AnalysisAnnotations['mirror']
  range?: AnalysisAnnotations['range']; flags?: AnalysisAnnotations['flags']
}
export type PeriodFacts = Partial<Record<'ma30' | 'ma60' | 'ma90' | 'ma120' | 'ma250', number | null>> & {
  close: number | null; ma5: number | null; ma10: number | null; ma20: number | null
  bollUpper: number | null; bollMiddle: number | null; bollLower: number | null
  ma5Delta: number | null; ma10Delta: number | null; ma20Delta: number | null; bollMiddleDelta: number | null
  closeAboveMa5: boolean | null; closeAboveMa20: boolean | null; closeAboveBollMiddle: boolean | null
  ma5Distance: number | null; ma20Distance: number | null; bandwidth: number | null; volumeRatio: number | null
  body: number | null; upperWick: number | null; lowerWick: number | null; range: number | null
  higherHigh: boolean | null; higherLow: boolean | null
}
export type GranvilleStage = { anchorBarKey: string | null; stage: number | null }
export type PeriodState = {
  period: AnalysisPeriod; asOf: string; kind: AnalysisKind; facts: PeriodFacts; bars: Candle[]
  directionCandidate: TrendDirection; direction: TrendDirection; style: RiseStyle; confirmed: boolean; shockConfirmed: boolean
  granville: GranvilleStage & { context: 'up' | 'down' | null; events: GranvilleEvent[]; contextStages: { up: GranvilleStage; down: GranvilleStage } }
  issues: string[]
}
export type ModeCandidate = { id: ScenarioMode; period: AnalysisPeriod; status: 'candidate' | 'confirmed' | 'insufficient' | 'not_applicable'; missing: string[]; mirrorOutcome?: 'support_confirmed' | 'support_failed' | 'resistance_confirmed' | 'turned_stronger'; evidence: EvidenceRef[] }

export type ScenarioFact = keyof PeriodFacts | 'granvilleStage' | 'granvilleContext' | 'phase3Opening' | 'doubleHigh' | 'riseStyle' | 'modeConfirmed' | 'mirrorOutcome'
export type ScenarioCondition = { fact: ScenarioFact; operator: 'eq' | 'lt' | 'lte' | 'gt' | 'gte'; value: number | boolean | string }
export type ScenarioRule = {
  id: string; name: string; version: number; definitionVersion: string; mode: ScenarioMode | 'any'
  period: AnalysisPeriod | 'selected'; action: 'block_entry' | 'bottom' | 'target' | 'deadline' | 'context'
  holding: 'any' | 'held'; conditions: ScenarioCondition[]; exceptions: string[]; semanticKey: string
  evidence: EvidenceRef[]; undefinedConditions: string[]; explanation: string
  risk?: { kind: 'price' | 'dynamic_line' | 'deadline' | 'condition'; indicator?: Indicator; condition: string; deadlineStage?: number }
}
export type RuleApplication = {
  ruleId: string; name: string; version: number; definitionVersion: string; period: AnalysisPeriod
  status: 'adopted' | 'not_applicable' | 'insufficient' | 'duplicate' | 'manual_disabled'
  reason: string; missing: string[]; evidence: EvidenceRef[]; conditions: ScenarioCondition[]
}
export type RiskReference = {
  id: string; ruleId: string; period: AnalysisPeriod; kind: 'price' | 'dynamic_line' | 'deadline' | 'condition'
  indicator?: Indicator; value: number | null; condition: string; deadlineStage?: number; evidence: EvidenceRef[]
}
export type ScenarioAnalysis = {
  schemaVersion: 1; definitionVersion: string; id: string; version: number; previousVersion?: number
  kind: AnalysisKind; createdAt: string; input: AnalysisInput; annotations: AnalysisAnnotations
  states: Partial<Record<AnalysisPeriod, PeriodState>>; modeCandidates: ModeCandidate[]
  provisional?: ProvisionalAnalysis[]; scenarios: CloseScenario[]; inactiveScenarios?: Array<{ scenario: CloseScenario; issues: string[] }>
  references: PriceReference[]; mergedLevels: MergedLevel[]; consolidation?: PriceConsolidation; dailyPriceLadder?: DailyPriceLadder
  rules: RuleApplication[]; risk: RiskReference[]; entryBlocked: boolean
}
