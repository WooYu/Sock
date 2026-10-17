import type { CloseScenario, MergedLevel, PriceConsolidation, PriceReference, ReferenceMergeSelection } from './scenario-types'
import { ANALYSIS_PERIODS } from './scenario-calendar'
export const PRICE_MERGE_TOLERANCE = 0.01
export function mergeReferenceLevels(refs: PriceReference[], tolerance = PRICE_MERGE_TOLERANCE): MergedLevel[] {
  if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 1) throw new Error('价位合并容差无效')
  const unique = new Map<string, PriceReference>()
  for (const ref of refs) {
    if (!ref.valid || ref.value === null || !Number.isFinite(ref.value) || ref.value <= 0) continue
    const previous = unique.get(ref.id)
    if (previous && previous.value !== ref.value) throw new Error('同一参考位id存在冲突值')
    unique.set(ref.id, ref)
  }
  const sorted = [...unique.values()].sort((a, b) => a.value! - b.value! || a.id.localeCompare(b.id))
  const groups: PriceReference[][] = []
  // Allow machine roundoff at an inclusive boundary without rounding the prices.
  const inclusiveLimit = tolerance > 0 ? tolerance + 8 * Number.EPSILON : 0
  for (const ref of sorted) {
    const group = groups.at(-1)
    if (group && group.every(other => (ref.adjustment ?? 'none') === (other.adjustment ?? 'none') && Math.abs(ref.value! - other.value!) / (ref.value! / 2 + other.value! / 2) <= inclusiveLimit)) group.push(ref)
    else groups.push([ref])
  }
  return groups.map(group => {
    const value = group.reduce((sum, ref) => sum + ref.value! / group.length, 0)
    return { id: group.map(r => r.id).join('::'), value, references: group.map(r => ({ ...r })) }
  })
}
export function consolidateReferencePrices(refs: PriceReference[], scenarios: CloseScenario[],
  selection: ReferenceMergeSelection = { method: 'average_delta', scenarioIds: {} }): { mergedLevels: MergedLevel[]; consolidation: PriceConsolidation } {
  if (!['average_delta', 'last_delta', 'rolling_close'].includes(selection.method)) throw new Error('综合价格的计算方法无效')
  const scenarioIds: ReferenceMergeSelection['scenarioIds'] = {}
  if (selection.method === 'rolling_close') for (const period of ANALYSIS_PERIODS) {
    const candidates = scenarios.filter(s => s.period === period)
    const chosen = candidates.find(s => s.id === selection.scenarioIds[period]) ?? candidates.find(s => s.kind === 'base')
    if (chosen) scenarioIds[period] = chosen.id
  }
  const basis = refs.find(r => r.period === 'day')?.adjustment ?? 'none'
  const selected = refs.filter(r => (r.adjustment ?? 'none') === basis && r.method === selection.method && (r.method !== 'rolling_close' || r.scenarioId === scenarioIds[r.period]))
  return { mergedLevels: mergeReferenceLevels(selected), consolidation: { definitionVersion: 'reference-mean-1pct-v1',
    tolerance: PRICE_MERGE_TOLERANCE, aggregation: 'arithmetic_mean', method: selection.method, scenarioIds } }
}
