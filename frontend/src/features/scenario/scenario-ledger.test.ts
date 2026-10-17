import { describe, expect, test } from 'vitest'
import { appendScenarioSnapshot, parseScenarioLedger, saveScenarioSnapshot, SCENARIO_STORAGE_KEY } from './scenario-ledger'
import { forecastFixture } from './scenario-test-fixtures'
import { analysisInputFixture, seriesFixture } from './scenario-test-fixtures'
import { buildScenarioAnalysis } from './scenario-engine'
import { resolveDailyPriceLimit } from './scenario-price-ladder'

describe('immutable analysis ledger', () => {
  test('freezes_all_computed_prices_and_percentages_and_rejects_fixed_count_or_price_tampering', () => {
    const input = analysisInputFixture(seriesFixture({ closes: Array<number>(22).fill(10) }))
    input.periods['60m'] = analysisInputFixture(seriesFixture({ period: '60m', closes: Array<number>(22).fill(10.4) })).periods['60m']
    input.periods['30m'] = analysisInputFixture(seriesFixture({ period: '30m', closes: Array<number>(22).fill(9.6) })).periods['30m']
    const snapshot = buildScenarioAnalysis(input, {}, { id: 'daily-ladder', version: 1, kind: 'live', registry: [], scenarios: [], horizons: [1, 2, 3],
      createdAt: input.asOf, executionWindow: null, priceSelection: { limit: resolveDailyPriceLimit(input.symbol) } })
    const raw = (record = snapshot) => JSON.stringify({ schemaVersion: 1, records: [record] })
    expect(parseScenarioLedger(raw())[0].dailyPriceLadder).toEqual(snapshot.dailyPriceLadder)
    expect(snapshot.dailyPriceLadder).toMatchObject({ definitionVersion: 'daily-close-levels-v2', up: [{ value: 10.4 }], down: [{ value: 9.6 }] })
    for (const mutate of [
      (s: typeof snapshot) => { s.dailyPriceLadder!.anchor!.close = 12 },
      (s: typeof snapshot) => { s.dailyPriceLadder!.up[0].value = 100 },
      (s: typeof snapshot) => { s.dailyPriceLadder!.down[0].changeRatio = 0.8 },
      (s: typeof snapshot) => { Object.assign(s.dailyPriceLadder!.selection, { count: 3 }) },
      (s: typeof snapshot) => { s.dailyPriceLadder!.selection.limit.ratio = 0.3 },
    ]) {
      const changed = structuredClone(snapshot); mutate(changed)
      expect(() => parseScenarioLedger(raw(changed))).toThrow(/格式/)
    }
  })
  test('old_fixed_count_snapshots_remain_readable_without_rewriting_the_saved_grid', () => {
    const input = analysisInputFixture(seriesFixture({ closes: Array<number>(22).fill(10) }))
    const snapshot = buildScenarioAnalysis(input, {}, { id: 'legacy-ladder', version: 1, kind: 'live', registry: [], scenarios: [], horizons: [1, 2, 3],
      createdAt: input.asOf, executionWindow: null })
    snapshot.dailyPriceLadder = { definitionVersion: 'daily-close-ladder-v1', tickSize: 0.01,
      selection: { count: 5, limit: { source: 'manual', ratio: 0.2, label: '手动设定 ±20%' } },
      anchor: { barKey: '2026-09-22', endAt: '2026-09-22T15:00:00+08:00', close: 10 }, band: { lower: 8, upper: 12 },
      up: [[10.4, 0.04], [10.8, 0.08], [11.2, 0.12], [11.6, 0.16], [12, 0.2]].map(([value, changeRatio]) => ({ id: 'up-' + Math.round(value * 100), value, changeRatio, kind: 'grid', groupIds: [] })),
      down: [[9.6, -0.04], [9.2, -0.08], [8.8, -0.12], [8.4, -0.16], [8, -0.2]].map(([value, changeRatio]) => ({ id: 'down-' + Math.round(value * 100), value, changeRatio, kind: 'grid', groupIds: [] })),
      excludedGroupIds: [], issues: [] }
    const raw = () => JSON.stringify({ schemaVersion: 1, records: [snapshot] })
    expect(parseScenarioLedger(raw())[0]).toEqual(snapshot)
    snapshot.dailyPriceLadder.up[0].value = 100
    expect(() => parseScenarioLedger(raw())).toThrow(/格式/)
  })
  test('merge_definition_and_frozen_means_survive_reload_and_tampered_means_are_rejected', () => {
    const input = analysisInputFixture(seriesFixture({ closes: [...Array<number>(21).fill(10), 11] }))
    const snapshot = buildScenarioAnalysis(input, {}, { id: 'price-summary', version: 1, kind: 'live', registry: [], scenarios: [], horizons: [1, 2, 3],
      createdAt: input.asOf, executionWindow: null, mergeSelection: { method: 'last_delta', scenarioIds: {} } })
    const raw = () => JSON.stringify({ schemaVersion: 1, records: [snapshot] })
    expect(parseScenarioLedger(raw())[0].consolidation?.method).toBe('last_delta')
    snapshot.mergedLevels[0].value += 0.001
    expect(() => parseScenarioLedger(raw())).toThrow(/格式/)
  })
  test('legacy_snapshot_keeps_its_previously_saved_representative_prices', () => {
    const { snapshot } = forecastFixture()
    delete snapshot.consolidation
    snapshot.mergedLevels = [{ id: 'legacy-median', value: snapshot.references[0].value!, references: snapshot.references }]
    const parsed = parseScenarioLedger(JSON.stringify({ schemaVersion: 1, records: [snapshot] }))
    expect(parsed[0].mergedLevels).toEqual(snapshot.mergedLevels)
    expect(parsed[0].consolidation).toBeUndefined()
  })
  test('damaged_inactive_paths_are_rejected_before_rendering_history', () => {
    const { snapshot } = forecastFixture()
    Object.assign(snapshot, { inactiveScenarios: 'damaged' })
    expect(() => parseScenarioLedger(JSON.stringify({ schemaVersion: 1, records: [snapshot] }))).toThrow(/格式/)
  })
  test('provisional_snapshot_with_discontinuity_saves_and_reloads', () => {
    const dates = Array.from({ length: 23 }, (_, i) => new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10))
    const input = analysisInputFixture(seriesFixture({ dates, closes: Array<number>(23).fill(10), fetchedAt: '2026-09-23T14:00:00+08:00' }))
    const snapshot = buildScenarioAnalysis(input, { discontinuities: [{ period: 'day', barKey: '2026-09-21', reason: '人工确认价格口径变化' }] },
      { id: 'discontinuous-provisional', version: 1, kind: 'live', createdAt: input.asOf, registry: [], scenarios: [], horizons: [1, 2, 3], executionWindow: null })
    expect(snapshot.provisional![0].indicators.ma5).toBeNull()
    const saved = appendScenarioSnapshot([], snapshot)
    expect(parseScenarioLedger(JSON.stringify({ schemaVersion: 1, records: saved }))).toEqual(saved)
  })
  test('append_preserves_old_input_and_versions', () => {
    const { snapshot: first } = forecastFixture()
    const records = appendScenarioSnapshot([], first)
    first.input.periods.day!.closed[0].close = 999
    expect(records[0].input.periods.day!.closed[0].close).toBe(10)
    const { snapshot: second } = forecastFixture()
    second.version = 2; second.previousVersion = 1
    const next = appendScenarioSnapshot(records, second)
    expect(next.map(s => s.version)).toEqual([1, 2])
    expect(records).toHaveLength(1)
    expect(parseScenarioLedger(JSON.stringify({ schemaVersion: 1, records: next }))).toEqual(next)
  })
  test('damaged_ledger_is_not_overwritten', () => {
    const raw = '{"schemaVersion":99,"records":[]}'
    let stored = raw
    const storage = { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value } }
    expect(() => saveScenarioSnapshot(storage, forecastFixture().snapshot)).toThrow(/损坏|版本/)
    expect(stored).toBe(raw)
  })
  test('demo_cannot_enter_real_ledger', () => {
    const { snapshot } = forecastFixture()
    snapshot.input.sourceMode = 'demo'
    expect(() => appendScenarioSnapshot([], snapshot)).toThrow(/示例/)
  })
  test('duplicate_version_is_rejected', () => {
    const { snapshot } = forecastFixture()
    expect(() => appendScenarioSnapshot([snapshot], snapshot)).toThrow(/版本/)
  })
  test('future_closed_candle_is_rejected_on_reload', () => {
    const { snapshot } = forecastFixture()
    snapshot.input.periods.day!.closed.at(-1)!.day = '2026-10-12'
    expect(() => parseScenarioLedger(JSON.stringify({ schemaVersion: 1, records: [snapshot] }))).toThrow(/格式/)
  })
  test('valid_reference_cannot_have_nan_or_null_price', () => {
    const { snapshot } = forecastFixture()
    snapshot.references[0].value = NaN
    expect(() => parseScenarioLedger(JSON.stringify({ schemaVersion: 1, records: [snapshot] }))).toThrow(/格式/)
  })
  test('malformed_calendar_is_not_accepted_as_source_evidence', () => {
    const { snapshot } = forecastFixture()
    snapshot.input.calendar!.tradingDays = ['not-a-date']
    expect(() => parseScenarioLedger(JSON.stringify({ schemaVersion: 1, records: [snapshot] }))).toThrow(/格式/)
  })
  test('malformed_provisional_data_is_not_accepted', () => {
    const dates = Array.from({ length: 20 }, (_, i) => new Date(Date.UTC(2026, 8, 23 + i)).toISOString().slice(0, 10))
    const input = analysisInputFixture(seriesFixture({ dates, closes: [...Array<number>(19).fill(10), 11], fetchedAt: '2026-10-12T14:15:00+08:00' }))
    const snapshot = buildScenarioAnalysis(input, {}, { id: 'provisional-schema', version: 1, kind: 'live', createdAt: input.asOf,
      registry: [], scenarios: [], horizons: [1, 2, 3], executionWindow: null })
    snapshot.provisional![0].observedClose = NaN
    expect(() => parseScenarioLedger(JSON.stringify({ schemaVersion: 1, records: [snapshot] }))).toThrow(/格式/)
  })
  test('quota_failure_preserves_existing_storage_and_in_memory_snapshot', () => {
    const raw = JSON.stringify({ schemaVersion: 1, records: [] })
    const storage = { getItem: () => raw, setItem: () => { throw new Error('QuotaExceededError') } }
    const { snapshot } = forecastFixture()
    expect(() => saveScenarioSnapshot(storage, snapshot)).toThrow(/未保存/)
    expect(storage.getItem()).toBe(raw)
    expect(snapshot.references).toHaveLength(3)
  })
  test('concurrent_update_between_reads_requires_reload', () => {
    const { snapshot } = forecastFixture()
    let reads = 0
    const storage = { getItem: () => JSON.stringify({ schemaVersion: 1, records: reads++ ? [snapshot] : [] }),
      setItem: () => { throw new Error('不应覆盖异地更新') } }
    expect(() => saveScenarioSnapshot(storage, snapshot)).toThrow(/更新/)
  })
  test('uses_a_separate_storage_key_and_keeps_scenarios', () => {
    const { snapshot } = forecastFixture()
    let stored: string | null = null
    const storage = { getItem: () => stored, setItem: (key: string, value: string) => {
      expect(key).toBe(SCENARIO_STORAGE_KEY); stored = value
    } }
    const saved = saveScenarioSnapshot(storage, snapshot)
    expect(saved[0]).toHaveProperty('scenarios')
    expect(SCENARIO_STORAGE_KEY).not.toContain('note-tags')
  })
})
