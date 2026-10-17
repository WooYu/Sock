import type { AnalysisAnnotations, AnalysisInput, AnalysisKind, CloseScenario, DailyPriceSelection, ExecutionWindow, Horizon, ReferenceMergeSelection, ScenarioAnalysis, ScenarioRule } from './scenario-types'
import { isIsoTimestamp } from '../chart/chart-periods'
import { ANALYSIS_PERIODS } from './scenario-calendar'
import { computeReferences, createFlatScenario } from './scenario-calculator'
import { continuousScenarioInput, derivePeriodState, matchModeCandidates } from './scenario-state'
import { consolidateReferencePrices } from './scenario-levels'
import { evaluateScenarioRules } from './scenario-rules'
import { SCENARIO_DEFINITION_VERSION } from './scenario-rule-registry'
import { computeProvisionalAnalysis } from './scenario-provisional'
import { buildDailyPriceLadder } from './scenario-price-ladder'
export type BuildAnalysisOptions = { id: string; version: number; previousVersion?: number; createdAt: string; kind: AnalysisKind; registry: ScenarioRule[]; scenarios: CloseScenario[]; horizons: Horizon[]; executionWindow: ExecutionWindow | null; mergeSelection?: ReferenceMergeSelection; priceSelection?: DailyPriceSelection }
export function buildScenarioAnalysis(input: AnalysisInput, annotations: AnalysisAnnotations, options: BuildAnalysisOptions): ScenarioAnalysis {
  if (!options.id.trim() || !Number.isSafeInteger(options.version) || options.version < 1
    || (options.version > 1 && options.previousVersion !== options.version - 1)
    || !isIsoTimestamp(options.createdAt) || Date.parse(options.createdAt) < Date.parse(input.asOf)) throw new Error('分析版本或生成时间无效')
  const safeInput: AnalysisInput = { ...input, periods: {} }
  const states: ScenarioAnalysis['states'] = {}
  for (const period of ANALYSIS_PERIODS) {
    const original = input.periods[period]
    if (!original) continue
    safeInput.periods[period] = continuousScenarioInput(original, annotations)
    states[period] = derivePeriodState(original, annotations, options.kind)
  }
  const references: ScenarioAnalysis['references'] = []
  const scenarios: CloseScenario[] = []
  const inactiveScenarios: NonNullable<ScenarioAnalysis['inactiveScenarios']> = []
  for (const period of ANALYSIS_PERIODS) {
    const history = safeInput.periods[period]
    if (!history?.closed.length) continue
    const baseScenario = createFlatScenario(history)
    scenarios.push(baseScenario)
    const common = { kind: options.kind, period, horizons: options.horizons, executionWindow: options.executionWindow }
    references.push(...computeReferences(safeInput, { ...common, method: 'average_delta' }),
      ...computeReferences(safeInput, { ...common, method: 'last_delta' }),
      ...computeReferences(safeInput, { ...common, method: 'rolling_close', scenario: baseScenario }))
    for (const scenario of options.scenarios.filter(s => s.period === period && s.symbol === input.symbol)) {
      const issues: string[] = []
      if (scenario.originBarKey !== history.closed.at(-1)!.day) issues.push('path_origin_changed')
      if (scenario.closes.length < Math.max(...options.horizons)) issues.push('path_horizon_insufficient')
      if (issues.length) { inactiveScenarios.push({ scenario, issues }); continue }
      scenarios.push(scenario)
      references.push(...computeReferences(safeInput, { ...common, method: 'rolling_close', scenario }))
    }
  }
  const result = evaluateScenarioRules(input, states, annotations, options.registry)
  const provisional = ANALYSIS_PERIODS.flatMap(period => {
    const temporary = computeProvisionalAnalysis(safeInput, period, options.horizons)
    return temporary ? [temporary] : []
  })
  const modeCandidates = matchModeCandidates(states, annotations).map(mode => ({
    ...mode, evidence: options.registry.filter(r => r.mode === mode.id).flatMap(r => r.evidence),
  }))
  const consolidation = consolidateReferencePrices(references, scenarios, options.mergeSelection)
  return structuredClone({ schemaVersion: 1, definitionVersion: SCENARIO_DEFINITION_VERSION,
    id: options.id, version: options.version, ...(options.previousVersion ? { previousVersion: options.previousVersion } : {}),
    kind: options.kind, createdAt: options.createdAt, input, annotations, states, modeCandidates, provisional, scenarios, inactiveScenarios, references,
    ...consolidation, ...(options.priceSelection ? { dailyPriceLadder: buildDailyPriceLadder(input, consolidation.mergedLevels, options.priceSelection) } : {}), ...result })
}
