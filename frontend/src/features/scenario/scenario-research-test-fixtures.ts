/** Synthetic record wrapper and frozen historical scoring response for tests only. */
import { forecastFixture } from './scenario-test-fixtures'
import { buildDailyPriceLadder, resolveDailyPriceLimit } from './scenario-price-ladder'
import type { ForecastRecord, PriceEvaluation, PriceClosenessResult } from './scenario-record-types'
import golden from './scenario-research-test-data.json'

export function researchSnapshot() {
  const { snapshot } = forecastFixture()
  snapshot.dailyPriceLadder = buildDailyPriceLadder(snapshot.input, snapshot.mergedLevels, { limit: resolveDailyPriceLimit(snapshot.input.symbol) })
  return snapshot
}
export function researchRecord(snapshot = researchSnapshot()): ForecastRecord {
  return { id: '10000000-0000-4000-8000-000000000001', owner: 'web:device', clientRecordId: snapshot.id, clientVersion: snapshot.version,
    previousRecordId: null, symbol: snapshot.input.symbol, kind: snapshot.kind, serverReceivedAt: '2026-10-16T08:00:00Z', clientCreatedAt: snapshot.createdAt,
    inputAsOf: snapshot.input.asOf, anchorDay: snapshot.dailyPriceLadder!.anchor!.barKey, method: snapshot.consolidation!.method,
    definitionVersion: snapshot.definitionVersion, payloadHash: 'a'.repeat(64), targetPolicy: 'first-observed-complete-daily-v1', snapshot,
    noteBindings: [], levels: [...snapshot.dailyPriceLadder!.up, ...snapshot.dailyPriceLadder!.down].map(p => ({ id: p.id, priceCents: Math.round(p.value * 100), groupIds: p.groupIds })) }
}
export function researchEvaluation(): PriceEvaluation {
  return { id: '20000000-0000-4000-8000-000000000001', forecastId: researchRecord().id, version: 1, previousEvaluationId: null,
    targetResolution: { version: 1, state: 'verified', targetDay: '2026-10-15', evidence: ['已冻结的事后回放'] }, status: 'scored',
    eligibility: { forwardEligible: false, reasons: ['historical_replay', 'server_receipt_after_cutoff'] },
    actual: { day: '2026-10-15', open: 29.51, high: 32.91, low: 28.95, close: 29.01, volume: 100 },
    source: { provider: '冻结测试行情', symbol: '603533', adjustment: 'none', fetchedAt: '2026-10-16T08:00:00Z', candleHash: 'b'.repeat(64), responseHash: 'c'.repeat(64), responseHashKind: 'canonical_adapter' },
    result: golden as PriceClosenessResult, evaluatedAt: '2026-10-16T08:00:00Z', nextRetryAt: null }
}
