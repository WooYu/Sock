import { getAuthorizationHeader, getClientId } from '../records/record-sync'
import type { EvaluationView, ForecastRecord, LearningFilters, LearningSample, NoteStudyRevision, Page, PriceEvaluation, SaveForecastRequest, StudyImport } from './scenario-record-types'

export class ScenarioApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); this.name = 'ScenarioApiError' }
}
async function request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const authorization = getAuthorizationHeader()
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST', signal, cache: 'no-store',
    headers: { Accept: 'application/json', 'X-Client-Id': getClientId(), ...(authorization ? { Authorization: authorization } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok) throw new ScenarioApiError(response.status, result?.message ?? `研究记录请求失败：${response.status}`)
  if (result === null) throw new ScenarioApiError(502, '研究记录响应不完整，请重试')
  return result as T
}
function query(values: object) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  return params.size ? '?' + params.toString() : ''
}
export function saveForecast(body: SaveForecastRequest, signal?: AbortSignal) { return request<ForecastRecord>('/api/scenario-records', body, signal) }
export function listForecasts(symbol?: string, cursor?: string, signal?: AbortSignal) { return request<Page<ForecastRecord>>('/api/scenario-records' + query({ symbol, cursor }), undefined, signal) }
export function getForecastRecord(id: string, signal?: AbortSignal) { return request<ForecastRecord>('/api/scenario-records/' + encodeURIComponent(id), undefined, signal) }
export function evaluateForecast(id: string, signal?: AbortSignal) { return request<EvaluationView>('/api/scenario-records/' + encodeURIComponent(id) + '/evaluate', {}, signal) }
export function getEvaluationHistory(id: string, signal?: AbortSignal) { return request<PriceEvaluation[]>('/api/scenario-records/' + encodeURIComponent(id) + '/evaluations', undefined, signal) }
export function listLearningSamples(filters: LearningFilters, cursor?: string, signal?: AbortSignal) { return request<Page<LearningSample>>('/api/learning-samples' + query({ ...filters, cursor }), undefined, signal) }
export function importStudy(body: StudyImport, signal?: AbortSignal) { return request<NoteStudyRevision>('/api/note-studies', body, signal) }
export function listStudyVersions(file: string, cursor?: string, signal?: AbortSignal) { return request<Page<NoteStudyRevision>>('/api/note-studies' + query({ file, cursor }), undefined, signal) }

export function evaluationViewFromHistory(history: PriceEvaluation[]): EvaluationView {
  const latestStatus = history.at(-1) ?? null
  let latestSuccessful: PriceEvaluation | null = null
  for (const e of history) if (e.targetResolution.version === latestStatus?.targetResolution.version && e.targetResolution.state === 'verified' && e.status === 'scored') {
    if (e.result) latestSuccessful = e
    else if (e.scoreEvaluationId) latestSuccessful = history.find(score => score.id === e.scoreEvaluationId && score.result) ?? null
  }
  return { latestStatus, latestSuccessful }
}
