import type { AnalysisInput, DailyPriceLadder, DailyPriceLevel, DailyPriceLimit, DailyPriceSelection, MergedLevel } from './scenario-types'
import { barEndAt, isTradingCalendar } from './scenario-calendar'

const RATIOS = [0.05, 0.1, 0.2, 0.3]

/** Ordinary-board assumptions only: status, listing-day exceptions and ex-rights bases need verification. */
export function resolveDailyPriceLimit(symbol: string, name?: string): DailyPriceLimit {
  if (symbol === 'DEMO') return { source: 'demo', ratio: 0.1, label: '示例区间 ±10%' }
  if (name && /ST|退|^[NC]/i.test(name.trim())) return { source: 'unverified', ratio: null, label: '特殊状态，涨跌幅待核实' }
  const ratio = /^(?:300|301|688|689)\d{3}$/.test(symbol) ? 0.2
    : /^(?:[48]\d{5}|92\d{4})$/.test(symbol) ? 0.3
      : /^(?:600|601|603|605|000|001|002|003)\d{3}$/.test(symbol) ? 0.1 : null
  return ratio === null ? { source: 'unverified', ratio: null, label: '涨跌幅待核实' }
    : { source: 'board_default', ratio, label: `${ratio === 0.1 ? '主板' : ratio === 0.2 ? '创业板／科创板' : '北交所'}常规 ±${ratio * 100}%` }
}

export function validDailyPriceSelection(selection: DailyPriceSelection, symbol: string): boolean {
  if (!selection || typeof selection !== 'object' || 'count' in selection || !selection.limit) return false
  const { source, ratio, label } = selection.limit
  if (typeof label !== 'string' || !label.trim() || label.length > 100) return false
  if (source === 'unverified') return ratio === null
  if (source === 'manual') return ratio !== null && RATIOS.includes(ratio)
  const expected = resolveDailyPriceLimit(symbol)
  return source === expected.source && ratio === expected.ratio && label === expected.label
}

// Work in integer cents so comparisons, deduplication and interval fills share the displayed tick.
function cents(value: number): number {
  const scaled = value * 100
  return Math.floor(scaled + 0.5 + Math.abs(scaled) * Number.EPSILON * 4)
}

export function roundDailyPrice(value: number): number { return cents(value) / 100 }

function laterCompletedSession(input: AnalysisInput, anchorDay: string): boolean {
  const asOf = Date.parse(input.asOf)
  if (isTradingCalendar(input.calendar) && input.calendar.tradingDays.some(day => day > anchorDay && Date.parse(barEndAt('day', day)) <= asOf)) return true
  return (['60m', '30m'] as const).some(period => {
    const history = input.periods[period]
    if (!history || history.symbol !== input.symbol) return false
    const cutoff = Math.min(asOf, Date.parse(history.source.fetchedAt))
    return history.closed.some(bar => bar.day.slice(0, 10) > anchorDay && bar.day.slice(11, 16) === '15:00'
      && Date.parse(barEndAt(period, bar.day)) <= cutoff)
  })
}

export function buildDailyPriceLadder(input: AnalysisInput, mergedLevels: MergedLevel[], selection: DailyPriceSelection): DailyPriceLadder {
  if (!validDailyPriceSelection(selection, input.symbol)) throw new Error('单日参考价的涨跌幅规则无效')
  return calculateDailyPriceLevels(input, mergedLevels, selection)
}

/** Read-only compatibility for already frozen v1 snapshots; never used to create new analyses. */
export function buildLegacyDailyPriceLadder(input: AnalysisInput, mergedLevels: MergedLevel[], selection: DailyPriceLadder['selection']): DailyPriceLadder {
  if (!selection || ![3, 4, 5].includes(selection.count ?? 0) || !validDailyPriceSelection({ limit: selection.limit }, input.symbol)) throw new Error('历史价位定义无效')
  return calculateDailyPriceLevels(input, mergedLevels, selection, selection.count)
}

function calculateDailyPriceLevels(input: AnalysisInput, mergedLevels: MergedLevel[], selection: DailyPriceLadder['selection'], legacyCount?: 3 | 4 | 5): DailyPriceLadder {
  const result: DailyPriceLadder = { definitionVersion: legacyCount === undefined ? 'daily-close-levels-v2' : 'daily-close-ladder-v1', tickSize: 0.01, selection: structuredClone(selection),
    anchor: null, band: null, up: [], down: [], excludedGroupIds: [], issues: [] }
  const daily = input.periods.day
  const bar = daily?.closed.at(-1)
  if (!bar || daily?.symbol !== input.symbol) { result.issues.push('daily_close_missing'); return result }
  const anchorCents = cents(bar.close), endAt = barEndAt('day', bar.day)
  if (!Number.isSafeInteger(anchorCents) || anchorCents < 1 || Math.abs(bar.close - anchorCents / 100) > 1e-8
    || Date.parse(endAt) > Math.min(Date.parse(input.asOf), Date.parse(daily.source.fetchedAt))) {
    result.issues.push('daily_close_invalid'); return result
  }
  result.anchor = { barKey: bar.day, endAt, close: anchorCents / 100 }
  if (laterCompletedSession(input, bar.day)) { result.issues.push('daily_close_stale'); return result }
  const ratio = selection.limit.ratio
  if (ratio === null) { result.issues.push('price_limit_unverified'); return result }
  const lowerCents = Math.max(1, cents(bar.close * (1 - ratio))), upperCents = cents(bar.close * (1 + ratio))
  if (lowerCents === anchorCents || upperCents === anchorCents) { result.issues.push('price_limit_tick_unverified'); return result }
  result.band = { lower: lowerCents / 100, upper: upperCents / 100 }
  const candidates = new Map<number, string[]>()
  for (const group of mergedLevels) {
    if (!Number.isFinite(group.value) || group.value < result.band.lower || group.value > result.band.upper) {
      result.excludedGroupIds.push(group.id); continue
    }
    const tick = cents(group.value)
    if (tick === anchorCents) continue
    candidates.set(tick, [...(candidates.get(tick) ?? []), group.id])
  }
  function side(direction: 1 | -1, boundary: number): DailyPriceLevel[] {
    const entries = [...candidates.entries()]
      .filter(([tick]) => (tick - anchorCents) * direction > 0)
      .sort(([a], [b]) => (a - b) * direction)
    const chosen = new Map<number, string[]>(entries)
    if (legacyCount !== undefined) {
      const width = Math.abs(boundary - anchorCents), count = Math.min(legacyCount, width)
      chosen.clear()
      for (const entry of entries.slice(0, count)) chosen.set(...entry)
      // Reproduce archived v1 grids exactly; current v2 results use computed entries only.
      for (let i = 1; i <= legacyCount && chosen.size < count; i++) {
        const offset = Math.round(width * i / legacyCount)
        if (offset <= 0) continue
        const tick = anchorCents + direction * offset
        if (!chosen.has(tick)) chosen.set(tick, [])
      }
      for (let offset = 1; chosen.size < count && offset <= width; offset++) {
        const tick = anchorCents + direction * offset
        if (!chosen.has(tick)) chosen.set(tick, [])
      }
    }
    return [...chosen.entries()].sort(([a], [b]) => (a - b) * direction).map(([tick, groupIds]) => ({
      id: (direction === 1 ? 'up-' : 'down-') + tick, value: tick / 100, changeRatio: (tick - anchorCents) / anchorCents,
      kind: groupIds.length ? 'merged' : 'grid', groupIds,
    }))
  }
  result.up = side(1, upperCents); result.down = side(-1, lowerCents)
  if (legacyCount !== undefined && (result.up.length < legacyCount || result.down.length < legacyCount)) result.issues.push('insufficient_price_ticks')
  return result
}
