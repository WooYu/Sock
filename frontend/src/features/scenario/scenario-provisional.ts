import type { AnalysisInput, AnalysisPeriod, Horizon, ProvisionalAnalysis } from './scenario-types'
import { barEndAt } from './scenario-calendar'
import { computeReferences, createFlatScenario, indicatorSeries, SCENARIO_INDICATORS } from './scenario-calculator'
export function computeProvisionalAnalysis(input: AnalysisInput, period: AnalysisPeriod, horizons: Horizon[]): ProvisionalAnalysis | null {
  const original = input.periods[period], observation = original?.observed.at(-1)
  if (!original || !observation || Date.parse(original.source.fetchedAt) > Date.parse(input.asOf)
    || Date.parse(barEndAt(period, observation.day)) <= Date.parse(input.asOf)) return null
  // Mathematical hypothesis only. This temporary history never enters states, rules or formal references.
  const temporary = { ...original, closed: [...original.closed, observation], observed: [],
    lastClosedAt: barEndAt(period, observation.day) }
  const hypotheticalInput = { ...input, periods: { [period]: temporary } }
  const scenario = createFlatScenario(temporary)
  scenario.id = 'provisional:' + scenario.id
  const values = indicatorSeries(temporary.closed)
  const indicators = Object.fromEntries(SCENARIO_INDICATORS.map(key => [key, values[key].at(-1) ?? null])) as ProvisionalAnalysis['indicators']
  return { kind: 'provisional', period, originBarKey: observation.day, observedAt: original.source.fetchedAt,
    observedClose: observation.close, condition: '假设本柱最终收于当前观察价，后续收盘保持该价；这些MA/BOLL为盘中暂估。',
    indicators, references: computeReferences(hypotheticalInput, { period, method: 'rolling_close', horizons, scenario, executionWindow: null }) }
}
