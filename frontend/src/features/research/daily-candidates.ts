import type { ScenarioAnalysis } from '../scenario/scenario-types'
import { mergeReferenceLevels } from '../scenario/scenario-levels'
import { isMarketIndex } from '@/lib/api/market-symbol'

/** All horizons share the origin's proximity band. Filter before averaging, without changing raw calculations. */
export function dailyCandidates(analysis: ScenarioAnalysis) {
  const ladder = analysis.dailyPriceLadder
  const anchor = analysis.input.periods.day?.closed.at(-1)
  const band = ladder?.band ?? null
  const index = isMarketIndex(analysis.input.symbol)
  const verified = Boolean(anchor && (band || index))
  const original = analysis.mergedLevels.flatMap(level => level.references)
  const eligible = verified ? original.filter(ref => {
    if (!ref.valid || ref.value === null || !Number.isFinite(ref.value) || ref.value <= 0) return false
    if (band && (ref.value < band.lower || ref.value > band.upper)) return false
    return true
  }) : []
  const chosen = new Set(eligible.map(ref => ref.id))
  const deferred = original.filter(ref => !chosen.has(ref.id))
  return { levels: mergeReferenceLevels(eligible), extended: mergeReferenceLevels(deferred),
    band, anchor, index, verified,
    limitLabel: ladder?.selection.limit.label ?? '单日涨跌幅待核实' }
}
