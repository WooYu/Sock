import { describe, expect, test } from 'vitest'
import { forecastFixture } from '../scenario/scenario-test-fixtures'
import { buildDailyPriceLadder, resolveDailyPriceLimit } from '../scenario/scenario-price-ladder'
import { mergeReferenceLevels } from '../scenario/scenario-levels'
import type { PriceReference } from '../scenario/scenario-types'
import { dailyCandidates } from './daily-candidates'

function fixture() {
  const { snapshot } = forecastFixture()
  snapshot.input.symbol = '300502'
  snapshot.input.periods.day!.symbol = '300502'
  snapshot.dailyPriceLadder = buildDailyPriceLadder(snapshot.input, [], { limit: resolveDailyPriceLimit('300502', '新易盛') })
  const base = snapshot.references[0]
  const ref = (id: string, value: number, overrides: Partial<PriceReference> = {}): PriceReference => ({
    ...base, id, value, valid: true, period: 'day', target: { horizon: 1, barKey: '2026-10-12', endAt: '2026-10-12T15:00:00+08:00', issues: [] }, ...overrides,
  })
  const set = (...refs: PriceReference[]) => { snapshot.mergedLevels = mergeReferenceLevels(refs); return snapshot }
  return { snapshot, ref, set }
}

describe('origin-relative candidate scope across all horizons', () => {
  test('keeps inclusive board bounds and defers a ninety percent extrapolation without changing source evidence', () => {
    const { snapshot, ref, set } = fixture()
    set(ref('low', 8.8), ref('high', 13.2), ref('far', 21.09), ref('far-72pct', 18.92, {
      target: { horizon: 4, barKey: '2026-10-15', endAt: null, issues: [] },
    }))
    const original = JSON.stringify(snapshot)
    const result = dailyCandidates(snapshot)
    expect(result.levels.map(l => l.value)).toEqual([8.8, 13.2])
    expect(result.extended.map(l => l.value)).toEqual([18.92, 21.09])
    expect(JSON.stringify(snapshot)).toBe(original)
  })
  test('filters constituents before remerging rather than accepting their in-band mean', () => {
    const { ref, set } = fixture()
    const result = dailyCandidates(set(ref('inside', 13.15), ref('outside', 13.25)))
    expect(result.levels.map(l => l.value)).toEqual([13.15])
    expect(result.extended.map(l => l.value)).toEqual([13.25])
  })
  test('retains today and cross-day targets inside the same origin band', () => {
    const { ref, set } = fixture()
    const result = dailyCandidates(set(ref('day', 10), ref('later', 11, { target: { horizon: 2, barKey: '2026-10-13', endAt: null, issues: [] } }),
      ref('minute', 12, { period: '60m' }), ref('old-minute', 9, { period: '15m', target: { horizon: 1, barKey: null, endAt: '2026-10-09T15:00:00+08:00', issues: [] } })))
    expect(result.levels.flatMap(l => l.references.map(r => r.id))).toEqual(['old-minute', 'day', 'later', 'minute'])
  })
  test('a missing calendar does not discard valid minute or later daily targets', () => {
    const { snapshot, ref, set } = fixture()
    set(ref('day', 10), ref('minute', 12, { period: '60m' }), ref('later', 11, { target: { horizon: 4, barKey: null, endAt: null, issues: ['calendar_missing'] } }))
    snapshot.input.calendar = null
    expect(dailyCandidates(snapshot).levels.map(l => l.id)).toEqual(['day', 'later', 'minute'])
  })
  test('does not manufacture candidates when the daily band is unverified', () => {
    const { snapshot, ref, set } = fixture()
    set(ref('day', 10))
    snapshot.dailyPriceLadder!.band = null
    expect(dailyCandidates(snapshot)).toMatchObject({ levels: [], verified: false })
    snapshot.input.symbol = 'sh000001'
    expect(dailyCandidates(snapshot).levels.map(l => l.id)).toEqual(['day'])
  })
})
