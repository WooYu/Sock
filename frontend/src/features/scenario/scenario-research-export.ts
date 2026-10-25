import type { EvaluationView, ForecastRecord, NoteBindingInput, PriceEvaluation } from './scenario-record-types'
import type { NoteTagRecord } from '../knowledge/note-tags'
import type { EvidenceRef, ScenarioAnalysis } from './scenario-types'

export function freezeLegacyBindings(snapshot: ScenarioAnalysis, versions: NoteTagRecord[]): NoteBindingInput[] {
  const references = new Map<string, EvidenceRef>()
  function visit(value: unknown) {
    if (Array.isArray(value)) { value.forEach(visit); return }
    if (!value || typeof value !== 'object') return
    const object = value as Record<string, unknown>
    if (typeof object.recordId === 'string' && typeof object.sourceHash === 'string' && Number.isInteger(object.tagVersion)) {
      references.set(`${object.recordId}|${object.sourceHash}|${object.tagVersion}`, object as EvidenceRef)
    }
    Object.values(object).forEach(visit)
  }
  visit(snapshot)
  return structuredClone([...references.values()].map(ref => {
    const matches = versions.filter(v => v.id === ref.recordId && v.sourceHash === ref.sourceHash && v.version === ref.tagVersion)
    const exact = matches.length === 1 ? matches[0] : null
    return { revisionId: null, sourceHash: ref.sourceHash, legacyKey: exact ? { legacyRecordId: exact.id, level: exact.level, sourceHash: exact.sourceHash, tagVersion: exact.version, channel: 'legacy' } : null, inlineVersion: exact }
  }))
}

export function buildResearchExport(record: ForecastRecord, view: EvaluationView, history: PriceEvaluation[]) {
  if (history.some(e => e.forecastId !== record.id)) throw new Error('评价不属于该冻结预测，已取消导出')
  const missingEvidence = record.noteBindings.filter(b => b.status === 'unresolved').map(b => 'unresolved_note_reference:' + (b.legacyKey?.legacyRecordId ?? b.sourceHash))
  if (!view.latestSuccessful) missingEvidence.push('successful_price_evaluation_unavailable')
  return structuredClone({
    schemaVersion: 1, exportedAt: new Date().toISOString(), definitionVersion: 'scenario-research-export-v1', forecast: record,
    selectedEvaluationId: view.latestSuccessful?.id ?? null, latestStatusEvaluationId: view.latestStatus?.id ?? null,
    evaluations: history, actualEvidence: history.filter(e => e.source).map(e => ({ evaluationId: e.id, targetResolution: e.targetResolution, actual: e.actual, ...e.source! })),
    noteBindings: record.noteBindings, missingEvidence, intradaySupportResistance: { status: 'not_evaluated' },
    criteria: { definitionVersion: 'ohlc-price-closeness-v1', denominator: 'actual_price', operator: 'lt', threshold: 0.01, outcome: 'price_closeness_only' },
  })
}
