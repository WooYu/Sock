import type { ScenarioAnalysis } from '../scenario/scenario-types'
import { futureBarTargets } from '../scenario/scenario-calendar'
import { mergeReferenceLevels } from '../scenario/scenario-levels'
import { isShanghaiComposite } from '@/lib/api/market-symbol'

/** Screen original references before averaging: an unreachable value must not pull a group into range. */
export function dailyCandidates(analysis: ScenarioAnalysis) {
  const ladder = analysis.dailyPriceLadder
  const anchor = analysis.input.periods.day?.closed.at(-1)
  const target = anchor ? futureBarTargets('day', anchor.day, [1], analysis.input.calendar)[0] : null
  const band = ladder?.band ?? null
  const index = isShanghaiComposite(analysis.input.symbol)
  const verified = Boolean(anchor && (band || index))
  const original = analysis.mergedLevels.flatMap(level => level.references)
  const eligible = verified ? original.filter(ref => {
    if (!ref.valid || ref.value === null || !Number.isFinite(ref.value) || ref.value <= 0) return false
    if (band && (ref.value < band.lower || ref.value > band.upper)) return false
    // Horizon one is the next daily session even when its calendar date is not verified.
    if (ref.period === 'day') return ref.target.horizon === 1
    return Boolean(target?.barKey && ref.target.endAt?.slice(0, 10) === target.barKey)
  }) : []
  const chosen = new Set(eligible.map(ref => ref.id))
  const deferred = original.filter(ref => !chosen.has(ref.id))
  return { levels: mergeReferenceLevels(eligible), extended: mergeReferenceLevels(deferred),
    band, anchor, targetDay: target?.barKey ?? null, index, verified,
    limitLabel: ladder?.selection.limit.label ?? '单日涨跌幅待核实' }
}
