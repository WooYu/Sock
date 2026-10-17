import type { ScenarioAnalysis } from './scenario-types'
import type { NoteTagRecord } from '../knowledge/note-tags'

export type LegacyNoteKey = { legacyRecordId: string; level: 'document' | 'fragment'; sourceHash: string; tagVersion: number; channel: string }
export type NoteBindingInput = { revisionId: string | null; sourceHash: string; legacyKey: LegacyNoteKey | null; inlineVersion: NoteTagRecord | null }
export type StudyImport = { sourceFile: string; sourceHash: string; sourceText: string; sourceUrl: string; channel: string; parentRevisionId: string | null; legacyKey: LegacyNoteKey | null; payload: Record<string, unknown> }
export type NoteStudyRevision = StudyImport & { id: string; owner: string; createdAt: string; payloadHash: string }
export type FrozenNoteBinding = NoteBindingInput & { status: 'resolved' | 'unresolved'; study: NoteStudyRevision | null }
export type SaveForecastRequest = { snapshot: ScenarioAnalysis; noteBindings: NoteBindingInput[] }
export type ForecastLevel = { id: string; priceCents: number; groupIds: string[] }
export type ForecastRecord = {
  id: string; owner: string; clientRecordId: string; clientVersion: number; previousRecordId: string | null
  symbol: string; kind: 'live' | 'replay'; serverReceivedAt: string; clientCreatedAt: string; inputAsOf: string
  anchorDay: string; method: string; definitionVersion: string; payloadHash: string; targetPolicy: string
  snapshot: ScenarioAnalysis; noteBindings: FrozenNoteBinding[]; levels: ForecastLevel[]
}
export type ActualTarget = 'open' | 'high' | 'low' | 'close'
export type PriceClosenessResult = {
  definitionVersion: 'ohlc-price-closeness-v1'
  levels: Array<ForecastLevel & { errors: Record<ActualTarget, number>; nearest: ActualTarget; matches: ActualTarget[]; exactMatch: boolean }>
  targets: Record<ActualTarget, { priceCents: number; covered: boolean; levelIds: string[]; nearestError: number | null }>
  totalLevels: number; closeLevels: number; levelClosenessRatio: number | null; coveredTargets: number; exactLevels: number
}
export type TargetResolution = { version: number; state: 'pending' | 'target_unverified' | 'verified'; targetDay: string | null; evidence: string[] }
export type PriceEvaluation = {
  id: string; forecastId: string; version: number; previousEvaluationId: string | null; targetResolution: TargetResolution
  status: 'pending' | 'target_unverified' | 'scored' | 'source_error'; eligibility: { forwardEligible: boolean; reasons: string[] }
  actual: { day: string; open: number; high: number; low: number; close: number; volume: number } | null
  source: { provider: string; symbol: string; adjustment: 'none' | 'qfq'; fetchedAt: string; candleHash: string | null; responseHash: string; responseHashKind: string } | null
  result: PriceClosenessResult | null; evaluatedAt: string; nextRetryAt: string | null; scoreEvaluationId?: string | null
}
export type EvaluationView = { latestStatus: PriceEvaluation | null; latestSuccessful: PriceEvaluation | null }
export type Page<T> = { items: T[]; nextCursor: string | null; asOf: string }
export type LearningSample = { forecast: ForecastRecord; evaluation: EvaluationView }
export type LearningFilters = Partial<Record<'symbol' | 'anchorFrom' | 'anchorThrough' | 'method' | 'forecastDefinitionVersion' | 'evaluationDefinitionVersion' | 'directionCandidate' | 'directionConfirmed' | 'noteFile' | 'status', string>> & { forwardEligible?: boolean }
