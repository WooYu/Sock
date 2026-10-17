import type { ExecutionWindow, PeriodInput, ScenarioAnalysis } from './scenario-types'
import { barEndAt, sessionEnds } from './scenario-calendar'
import { validExecutionWindow } from './scenario-ledger'
import { indicatorSeries } from './scenario-calculator'
export type CoverageResult = { eligible: boolean; issues: string[]; references: Array<{ referenceId: string; covered: boolean | null }>; coveredCount: number; anyCovered: boolean | null }
export type IndicatorErrorResult = { issues: string[]; references: Array<{ referenceId: string; actualValue: number | null; absoluteError: number | null; relativeError: number | null; status: 'evaluated' | 'insufficient' | 'invalid'; issues: string[] }> }
function basisChanged(snapshot: ScenarioAnalysis, actual: PeriodInput): boolean {
  if (actual.adjustment !== 'qfq') return false
  const origin = snapshot.input.periods[actual.period]?.closed.at(-1)
  const current = actual.closed.find(bar => bar.day === origin?.day)
  return !origin || !current || Math.abs(current.close - origin.close) > 0.005
}
function barStartAt(period: PeriodInput['period'], key: string): string {
  if (period === 'day') return key + 'T09:30:00+08:00'
  const end = key.slice(11, 16)
  const ends = sessionEnds(period)
  const index = ends.indexOf(end)
  const start = index === 0 ? '09:30' : end === (period === '60m' ? '14:00' : '13:30') ? '13:00' : ends[index - 1]
  return key.slice(0, 10) + 'T' + start + ':00+08:00'
}
export function evaluateRangeCoverage(snapshot: ScenarioAnalysis, actual: PeriodInput, window: ExecutionWindow): CoverageResult {
  if (!validExecutionWindow(window)) return { eligible: false, issues: ['invalid_execution_window'], references: [], coveredCount: 0, anyCovered: null }
  const issues: string[] = []
  const start = Date.parse(window.startAt), end = Date.parse(window.endAt)
  if (!validExecutionWindow(window)) issues.push('invalid_execution_window')
  if (snapshot.kind !== 'live' || snapshot.input.sourceMode !== 'real') issues.push('not_a_live_forward_plan')
  if (!(Date.parse(snapshot.createdAt) < start && Date.parse(snapshot.input.asOf) < start)) issues.push('plan_after_window_start')
  if (actual.symbol !== snapshot.input.symbol || actual.adjustment !== snapshot.input.periods[actual.period]?.adjustment) issues.push('actual_symbol_or_adjustment_mismatch')
  if (basisChanged(snapshot, actual)) issues.push('adjustment_basis_changed')
  if (actual.period !== window.period) issues.push('actual_period_mismatch')
  if (Date.parse(actual.asOf) < end || Date.parse(actual.source.fetchedAt) < end) issues.push('window_not_finished')
  const selectedRefs = snapshot.references.filter(r => r.executionWindow?.startAt === window.startAt
    && r.executionWindow.endAt === window.endAt && r.executionWindow.period === window.period)
  if (!selectedRefs.some(r => r.valid)) issues.push('no_planned_valid_references')
  const firstDay = new Date(start + 8 * 3600_000).toISOString().slice(0, 10)
  const lastDay = new Date(end + 8 * 3600_000).toISOString().slice(0, 10)
  let dates = [firstDay]
  if (firstDay !== lastDay) {
    const calendar = snapshot.input.calendar
    if (!calendar || firstDay < calendar.fromDay || lastDay > calendar.throughDay) issues.push('coverage_calendar_unverified')
    else dates = calendar.tradingDays.filter(d => d >= firstDay && d <= lastDay)
  }
  const keys = dates.flatMap(day => actual.period === 'day' ? [day] : sessionEnds(actual.period).map(time => day + 'T' + time + ':00+08:00'))
  const expected = keys.filter(key => Date.parse(barEndAt(actual.period, key)) > start && Date.parse(barStartAt(actual.period, key)) < end)
  if (expected.some(key => Date.parse(barStartAt(actual.period, key)) < start || Date.parse(barEndAt(actual.period, key)) > end)) issues.push('finer_bars_required')
  const bars = expected.map(key => actual.closed.find(b => b.day === key))
  if (!bars.length || bars.some(b => !b)) issues.push('execution_bars_missing')
  const eligible = issues.length === 0
  const references = selectedRefs.map(r => ({ referenceId: r.id, covered: eligible && r.valid && r.value !== null
    ? bars.some(b => r.value! >= b!.low && r.value! <= b!.high) : null }))
  const coveredCount = references.filter(r => r.covered === true).length
  return { eligible, issues: [...new Set(issues)], references, coveredCount, anyCovered: eligible ? coveredCount > 0 : null }
}
export function evaluateIndicatorError(snapshot: ScenarioAnalysis, actual: PeriodInput): IndicatorErrorResult {
  const issues: string[] = []
  if (actual.symbol !== snapshot.input.symbol || actual.adjustment !== snapshot.input.periods[actual.period]?.adjustment) issues.push('actual_symbol_or_adjustment_mismatch')
  if (basisChanged(snapshot, actual)) issues.push('adjustment_basis_changed')
  const indicators = indicatorSeries(actual.closed)
  const references = snapshot.references.filter(r => r.period === actual.period).map(ref => {
    const row: IndicatorErrorResult['references'][number] = { referenceId: ref.id, actualValue: null, absoluteError: null,
      relativeError: null, status: ref.valid ? 'insufficient' : 'invalid', issues: [...issues] }
    if (!ref.valid || ref.value === null) { row.issues.push('invalid_reference'); return row }
    const index = actual.closed.findIndex(b => b.day === ref.target.barKey)
    const observed = index >= 0 ? indicators[ref.indicator][index] : null
    if (row.issues.length || ref.target.endAt === null || Date.parse(ref.target.endAt) > Math.min(Date.parse(actual.asOf), Date.parse(actual.source.fetchedAt))
      || observed == null || !Number.isFinite(observed) || observed <= 0) { row.issues.push('target_indicator_unavailable'); return row }
    row.actualValue = observed; row.absoluteError = Math.abs(ref.value - observed); row.relativeError = row.absoluteError / observed; row.status = 'evaluated'
    return row
  })
  return { issues, references }
}
