import type { AnalysisAnnotations, AnalysisInput, AnalysisKind, AnalysisPeriod, PeriodState } from './scenario-types'
import { ANALYSIS_PERIODS } from './scenario-calendar'
import { annotationsForPeriod, derivePeriodState, matchModeCandidates } from './scenario-state'

export function adaptivePeriodPlan(input: AnalysisInput, annotations: AnalysisAnnotations, kind: AnalysisKind = 'live') {
  const states: Partial<Record<AnalysisPeriod, PeriodState>> = {}
  for (const period of ANALYSIS_PERIODS) if (input.periods[period]) states[period] = derivePeriodState(input.periods[period]!, annotations, kind)
  const modes = matchModeCandidates(states, annotations)
  const clearPeriod = ANALYSIS_PERIODS.find(period => {
    const state = states[period], selected = annotationsForPeriod(annotations, period).mode
    return state && state.confirmed && state.direction !== 'unknown' && state.bars.length >= 22 && input.periods[period]?.source.online
      && selected?.barKey === state.bars.at(-1)?.day && modes.some(mode => mode.period === period && mode.status === 'confirmed')
  }) ?? null
  const maxIndex = clearPeriod ? Math.min(ANALYSIS_PERIODS.indexOf(clearPeriod) + 1, 2) : 2
  const attempted = ANALYSIS_PERIODS.filter(period => input.periods[period] || input.loadIssues[period])
  const includedPeriods = ANALYSIS_PERIODS.filter((period, index) => index <= maxIndex && input.periods[period])
  const deepestIndex = Math.max(0, ...attempted.map(period => ANALYSIS_PERIODS.indexOf(period)).filter(index => index <= maxIndex))
  const nextPeriod = deepestIndex < maxIndex ? ANALYSIS_PERIODS[deepestIndex + 1] : null
  const primaryPeriod = clearPeriod ?? includedPeriods.at(-1) ?? 'day'
  return { clearPeriod, primaryPeriod, includedPeriods, maxPeriod: ANALYSIS_PERIODS[maxIndex], nextPeriod,
    nextKind: clearPeriod ? 'verify' as const : 'clarify' as const }
}

export function scopedPeriodInput(input: AnalysisInput, annotations: AnalysisAnnotations, kind: AnalysisKind = 'live'): AnalysisInput {
  const plan = adaptivePeriodPlan(input, annotations, kind)
  const maxIndex = ANALYSIS_PERIODS.indexOf(plan.maxPeriod)
  return { ...input, periods: Object.fromEntries(Object.entries(input.periods).filter(([period]) => ANALYSIS_PERIODS.indexOf(period as AnalysisPeriod) <= maxIndex)),
    loadIssues: Object.fromEntries(Object.entries(input.loadIssues).filter(([period]) => ANALYSIS_PERIODS.indexOf(period as AnalysisPeriod) <= maxIndex)) }
}
