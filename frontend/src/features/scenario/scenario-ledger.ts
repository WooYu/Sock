import type { ScenarioAnalysis } from './scenario-types'
import { isChartTime, isIsoTimestamp } from '../chart/chart-periods'
import { ANALYSIS_PERIODS, barEndAt, isTradingCalendar } from './scenario-calendar'
import { SCENARIO_INDICATORS } from './scenario-calculator'
import { validCandle } from './scenario-inputs'
import { computeProvisionalAnalysis } from './scenario-provisional'
import { continuousScenarioInput } from './scenario-state'
import { consolidateReferencePrices } from './scenario-levels'
import { buildDailyPriceLadder, buildLegacyDailyPriceLadder } from './scenario-price-ladder'
import type { EvidenceRef, ExecutionWindow, PeriodInput } from './scenario-types'
export const SCENARIO_STORAGE_KEY = 'stockcal.scenario-analysis.v1'
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(s => typeof s === 'string')
const evidenceValid = (e: EvidenceRef) => e && typeof e.recordId === 'string' && Number.isSafeInteger(e.tagVersion) && e.tagVersion > 0
  && typeof e.sourceHash === 'string' && /^[a-f0-9]{64}$/.test(e.sourceHash) && typeof e.sourceUrl === 'string' && /^https:\/\//.test(e.sourceUrl)
  && Number.isSafeInteger(e.startLine) && e.startLine >= 1 && Number.isSafeInteger(e.endLine) && e.endLine >= e.startLine
  && typeof e.quote === 'string' && !!e.quote.trim()
export function validExecutionWindow(window: ExecutionWindow): boolean {
  return !!window && ANALYSIS_PERIODS.includes(window.period) && isIsoTimestamp(window.startAt) && isIsoTimestamp(window.endAt)
    && Date.parse(window.startAt) < Date.parse(window.endAt)
}
function periodValid(input: PeriodInput, snapshot: ScenarioAnalysis): boolean {
  if (!input || input.symbol !== snapshot.input.symbol || input.asOf !== snapshot.input.asOf || !(input.adjustment === 'none' || (input.period === 'day' && input.adjustment === 'qfq'))
    || !ANALYSIS_PERIODS.includes(input.period) || !input.source || !isIsoTimestamp(input.source.fetchedAt)
    || typeof input.source.name !== 'string' || typeof input.source.online !== 'boolean' || typeof input.source.state !== 'string'
    || !Array.isArray(input.closed) || !Array.isArray(input.observed) || !strings(input.issues)) return false
  const cutoff = Math.min(Date.parse(input.asOf), Date.parse(input.source.fetchedAt))
  if (!input.closed.every((bar, i) => validCandle(bar) && isChartTime(bar.day, input.period)
    && Date.parse(barEndAt(input.period, bar.day)) <= cutoff && (i === 0 || bar.day > input.closed[i - 1].day))) return false
  return input.observed.every(bar => validCandle(bar) && isChartTime(bar.day, input.period))
    && input.lastClosedAt === (input.closed.length ? barEndAt(input.period, input.closed.at(-1)!.day) : null)
}
function snapshotValid(value: unknown): value is ScenarioAnalysis {
  try {
    const s = value as ScenarioAnalysis
    if (!s || s.schemaVersion !== 1 || typeof s.id !== 'string' || !s.id.trim() || typeof s.definitionVersion !== 'string'
      || !Number.isSafeInteger(s.version) || s.version < 1 || (s.version === 1 ? s.previousVersion !== undefined : s.previousVersion !== s.version - 1)
      || !['live', 'replay'].includes(s.kind) || !isIsoTimestamp(s.createdAt) || !s.input || s.input.sourceMode !== 'real'
      || !/^\d{6}$/.test(s.input.symbol) || !isIsoTimestamp(s.input.asOf) || Date.parse(s.createdAt) < Date.parse(s.input.asOf)
      || !s.input.periods || !s.input.loadIssues || !s.annotations || !s.states || typeof s.entryBlocked !== 'boolean') return false
    if (s.input.calendar !== null && !isTradingCalendar(s.input.calendar)) return false
    for (const [period, input] of Object.entries(s.input.periods)) {
      if (!ANALYSIS_PERIODS.includes(period as PeriodInput['period']) || input.period !== period || !periodValid(input, s)) return false
    }
    if (!Array.isArray(s.scenarios) || (s.inactiveScenarios !== undefined && (!Array.isArray(s.inactiveScenarios)
      || !s.inactiveScenarios.every(p => p && strings(p.issues) && p.issues.length > 0)))) return false
    if (![...s.scenarios, ...(s.inactiveScenarios ?? []).map(p => p.scenario)].every(c => c.symbol === s.input.symbol && ANALYSIS_PERIODS.includes(c.period)
      && typeof c.id === 'string' && isChartTime(c.originBarKey, c.period) && ['base', 'continuation', 'pullback'].includes(c.kind)
      && Array.isArray(c.closes) && c.closes.length > 0 && c.closes.every(v => Number.isFinite(v) && v > 0)
      && typeof c.condition === 'string' && !!c.condition.trim() && isIsoTimestamp(c.selectedAt) && (s.kind === 'replay' || Date.parse(c.selectedAt) <= Date.parse(s.input.asOf))
      && Array.isArray(c.evidence) && c.evidence.every(evidenceValid))) return false
    if (!Array.isArray(s.references) || !s.references.every(r => ANALYSIS_PERIODS.includes(r.period) && SCENARIO_INDICATORS.includes(r.indicator)
      && typeof r.id === 'string' && ['average_delta', 'last_delta', 'rolling_close'].includes(r.method)
      && r.asOf === s.input.asOf && isChartTime(r.originBarKey, r.period) && r.originEndAt === barEndAt(r.period, r.originBarKey)
      && Date.parse(r.originEndAt) <= Date.parse(s.input.asOf) && r.originBarKey === s.input.periods[r.period]?.closed.at(-1)?.day
      && r.target && [1, 2, 3, 4].includes(r.target.horizon) && strings(r.target.issues)
      && (r.target.barKey === null ? r.target.endAt === null : isChartTime(r.target.barKey, r.period) && r.target.endAt === barEndAt(r.period, r.target.barKey)
        && Date.parse(r.target.endAt) > Date.parse(r.originEndAt))
      && (r.value === null || Number.isFinite(r.value)) && typeof r.valid === 'boolean' && (!r.valid || r.value !== null && r.value > 0)
      && strings(r.issues) && (r.executionWindow === null || validExecutionWindow(r.executionWindow)))) return false
    if (new Set(s.references.map(r => r.id)).size !== s.references.length) return false
    if (s.provisional !== undefined && (!Array.isArray(s.provisional) || !s.provisional.every(p => {
      if (!p || p.kind !== 'provisional' || !ANALYSIS_PERIODS.includes(p.period)
        || !Number.isFinite(p.observedClose) || p.observedClose <= 0 || !Array.isArray(p.references)) return false
      const horizons = [...new Set(p.references.map(r => r.target.horizon))]
      if (!horizons.length || !horizons.every(h => [1, 2, 3, 4].includes(h))) return false
      const original = s.input.periods[p.period]
      if (!original) return false
      const expected = computeProvisionalAnalysis({ ...s.input, periods: { ...s.input.periods,
        [p.period]: continuousScenarioInput(original, s.annotations) } }, p.period, horizons)
      return expected !== null && p.originBarKey === expected.originBarKey && p.observedAt === expected.observedAt
        && p.observedClose === expected.observedClose && p.condition === expected.condition
        && SCENARIO_INDICATORS.filter(key => ['ma5', 'ma10', 'ma20', 'bollUpper', 'bollMiddle', 'bollLower'].includes(key) || Object.hasOwn(p.indicators, key)).every(key => p.indicators[key] === expected.indicators[key])
        && JSON.stringify(p.references) === JSON.stringify(expected.references.filter(ref => Object.hasOwn(p.indicators, ref.indicator)))
    }))) return false
    for (const [period, state] of Object.entries(s.states)) {
      if (state.period !== period || state.asOf !== s.input.asOf || state.kind !== s.kind || !s.input.periods[state.period]
        || !Array.isArray(state.bars) || !state.bars.every(b => validCandle(b) && s.input.periods[state.period]!.closed.some(source => source.day === b.day && source.close === b.close))
        || !state.facts || !Object.values(state.facts).every(f => f === null || typeof f === 'boolean' || typeof f === 'number' && Number.isFinite(f))
        || !['rising', 'falling', 'sideways', 'unknown'].includes(state.direction) || !['climbing', 'surging', 'unknown'].includes(state.style)
        || typeof state.confirmed !== 'boolean' || typeof state.shockConfirmed !== 'boolean' || !strings(state.issues)
        || !state.granville || !(state.granville.stage === null || Number.isSafeInteger(state.granville.stage) && state.granville.stage > 0)) return false
    }
    if (!Array.isArray(s.modeCandidates) || !s.modeCandidates.every(m => ['trend_climb', 'mirror_retest', 'down_rebound', 'range'].includes(m.id)
      && ANALYSIS_PERIODS.includes(m.period) && ['candidate', 'confirmed', 'insufficient', 'not_applicable'].includes(m.status)
      && strings(m.missing) && Array.isArray(m.evidence) && m.evidence.every(evidenceValid))) return false
    if (!Array.isArray(s.rules) || !s.rules.every(r => typeof r.ruleId === 'string' && typeof r.name === 'string' && typeof r.reason === 'string'
      && ['adopted', 'not_applicable', 'insufficient', 'duplicate', 'manual_disabled'].includes(r.status) && strings(r.missing)
      && Array.isArray(r.conditions) && Array.isArray(r.evidence) && r.evidence.every(evidenceValid))) return false
    if (!Array.isArray(s.risk) || !s.risk.every(r => typeof r.id === 'string' && typeof r.ruleId === 'string' && ANALYSIS_PERIODS.includes(r.period)
      && ['price', 'dynamic_line', 'deadline', 'condition'].includes(r.kind) && (r.value === null || Number.isFinite(r.value) && r.value > 0)
      && typeof r.condition === 'string' && Array.isArray(r.evidence) && r.evidence.every(evidenceValid))) return false
    if (!Array.isArray(s.mergedLevels) || !s.mergedLevels.every(g => typeof g.id === 'string' && Number.isFinite(g.value) && g.value > 0
      && Array.isArray(g.references) && g.references.length > 0 && g.references.every(r => s.references.some(source => source.id === r.id && source.value === r.value && source.valid)))
    ) return false
    if (s.consolidation !== undefined) {
      const c = s.consolidation
      if (!c || c.definitionVersion !== 'reference-mean-1pct-v1' || c.tolerance !== 0.01 || c.aggregation !== 'arithmetic_mean'
        || !['average_delta', 'last_delta', 'rolling_close'].includes(c.method) || !c.scenarioIds || Array.isArray(c.scenarioIds)
        || !Object.entries(c.scenarioIds).every(([period, id]) => ANALYSIS_PERIODS.includes(period as PeriodInput['period']) && typeof id === 'string')) return false
      const expected = consolidateReferencePrices(s.references, s.scenarios, c)
      if (JSON.stringify(c.scenarioIds) !== JSON.stringify(expected.consolidation.scenarioIds)
        || s.mergedLevels.length !== expected.mergedLevels.length || !s.mergedLevels.every((g, i) => {
          const original = expected.mergedLevels[i]
          return g.id === original.id && g.value === original.value && JSON.stringify(g.references) === JSON.stringify(original.references)
        })) return false
    }
    if (s.dailyPriceLadder !== undefined) {
      const ladder = s.dailyPriceLadder
      if (!s.consolidation || !ladder || !['daily-close-ladder-v1', 'daily-close-levels-v2'].includes(ladder.definitionVersion)) return false
      const expected = ladder.definitionVersion === 'daily-close-ladder-v1'
        ? buildLegacyDailyPriceLadder(s.input, s.mergedLevels, ladder.selection) : buildDailyPriceLadder(s.input, s.mergedLevels, ladder.selection)
      if (JSON.stringify(ladder) !== JSON.stringify(expected)) return false
    }
    return true
  } catch { return false }
}
function checkVersionChains(records: ScenarioAnalysis[]): boolean {
  const latest = new Map<string, ScenarioAnalysis>()
  for (const record of records) {
    const prior = latest.get(record.id)
    if (prior ? record.version !== prior.version + 1 || record.previousVersion !== prior.version
      || record.input.symbol !== prior.input.symbol || Date.parse(record.createdAt) < Date.parse(prior.createdAt) : record.version !== 1) return false
    latest.set(record.id, record)
  }
  return true
}
export function parseScenarioLedger(raw: string | null): ScenarioAnalysis[] {
  if (raw === null) return []
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { throw new Error('分析记录格式损坏，原有记录未覆盖。') }
  const ledger = parsed as { schemaVersion?: number; records?: unknown[] }
  if (!ledger || ledger.schemaVersion !== 1 || !Array.isArray(ledger.records) || !ledger.records.every(snapshotValid)
    || !checkVersionChains(ledger.records)) throw new Error('分析记录格式损坏或版本不支持，原有记录未覆盖。')
  return structuredClone(ledger.records)
}
export function appendScenarioSnapshot(records: ScenarioAnalysis[], next: ScenarioAnalysis): ScenarioAnalysis[] {
  if (next.input.sourceMode === 'demo' || next.input.symbol === 'DEMO') throw new Error('示例分析不能写入真实分析账本。')
  if (!snapshotValid(next) || !records.every(snapshotValid)) throw new Error('分析快照格式无效，原有记录未覆盖。')
  const appended = [...records, next]
  if (!checkVersionChains(appended)) throw new Error('分析版本冲突，请重新加载最新记录后保存。')
  return structuredClone(appended)
}
export function saveScenarioSnapshot(storage: Pick<Storage, 'getItem' | 'setItem'>, next: ScenarioAnalysis): ScenarioAnalysis[] {
  const raw = storage.getItem(SCENARIO_STORAGE_KEY)
  const records = appendScenarioSnapshot(parseScenarioLedger(raw), next)
  if (storage.getItem(SCENARIO_STORAGE_KEY) !== raw) throw new Error('分析记录已更新，请重新加载后保存。')
  try { storage.setItem(SCENARIO_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, records })) }
  catch { throw new Error('分析未保存到浏览器；当前结果仍可导出，请检查存储空间或权限。') }
  return records
}
