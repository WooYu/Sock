import { describe, expect, test } from 'vitest'
import { normalizeScenarioSeries } from './scenario-inputs'
import { seriesFixture } from './scenario-test-fixtures'

describe('scenario candle boundaries', () => {
  test('15m_keeps_only_current_unfinished_bucket_as_observed', () => {
    const asOf = '2026-10-12T10:05:00+08:00'
    const series = seriesFixture({ period: '15m', closes: [10, 11, 12], dates: ['2026-10-12T10:00:00+08:00', '2026-10-12T10:15:00+08:00', '2026-10-12T10:30:00+08:00'], fetchedAt: asOf })
    const result = normalizeScenarioSeries(series, asOf)
    expect(result.closed.map(b => b.day)).toEqual(['2026-10-12T10:00:00+08:00'])
    expect(result.observed.map(b => b.day)).toEqual(['2026-10-12T10:15:00+08:00'])
  })
  test('daily_bar_stays_observed_before_1500', () => {
    const asOf = '2026-10-12T14:15:00+08:00'
    const result = normalizeScenarioSeries(seriesFixture({ dates: ['2026-10-09', '2026-10-12'], fetchedAt: asOf }), asOf)
    expect(result.closed.map(b => b.day)).toEqual(['2026-10-09'])
    expect(result.observed.map(b => b.day)).toEqual(['2026-10-12'])
    expect(result.lastClosedAt).toBe('2026-10-09T15:00:00+08:00')
  })
  test('minute_bucket_end_controls_completeness', () => {
    const asOf = '2026-10-12T14:15:00+08:00'
    const series = seriesFixture({ period: '60m', dates: ['2026-10-12T14:00:00+08:00', '2026-10-12T15:00:00+08:00'], fetchedAt: asOf })
    series.bars[1].endTime = asOf
    const result = normalizeScenarioSeries(series, asOf)
    expect(result.closed).toHaveLength(1)
    expect(result.observed).toHaveLength(1)
    expect(result.lastClosedAt).toBe('2026-10-12T14:00:00+08:00')
  })
  test('source_timestamp_also_bounds_known_bars', () => {
    const series = seriesFixture({ dates: ['2026-10-09', '2026-10-12'], fetchedAt: '2026-10-12T14:00:00+08:00' })
    expect(normalizeScenarioSeries(series, '2026-10-12T16:00:00+08:00').closed).toHaveLength(1)
  })
  test('future_mutations_do_not_change_closed_history', () => {
    const asOf = '2026-10-09T16:00:00+08:00'
    const series = seriesFixture({ dates: ['2026-10-09', '2026-10-12'], fetchedAt: asOf })
    const before = normalizeScenarioSeries(series, asOf)
    series.bars[1].close = -900
    expect(normalizeScenarioSeries(series, asOf)).toEqual(before)
  })
  test('invalid_ohlc_does_not_compress_history', () => {
    const series = seriesFixture({ dates: ['2026-10-09', '2026-10-12', '2026-10-13'], closes: [10, 11, 12] })
    series.bars[1].high = 9
    const result = normalizeScenarioSeries(series, series.source.fetchedAt)
    expect(result.closed.map(b => b.day)).toEqual(['2026-10-13'])
    expect(result.issues).toContain('invalid_ohlc:2026-10-12')
  })
  test('conflicting_duplicate_starts_a_new_contiguous_tail', () => {
    const series = seriesFixture({ dates: ['2026-10-09', '2026-10-12'], closes: [10, 11] })
    series.bars.push({ ...series.bars[0], close: 10.1 })
    const result = normalizeScenarioSeries(series, series.source.fetchedAt)
    expect(result.closed.map(b => b.day)).toEqual(['2026-10-12'])
    expect(result.issues).toContain('conflicting_duplicate:2026-10-09')
  })
  test('known_missing_intraday_bar_does_not_bridge_a_gap', () => {
    const series = seriesFixture({ period: '30m', dates: ['2026-10-12T10:00:00+08:00', '2026-10-12T11:00:00+08:00'] })
    const result = normalizeScenarioSeries(series, series.source.fetchedAt)
    expect(result.closed.map(b => b.day)).toEqual(['2026-10-12T11:00:00+08:00'])
    expect(result.issues.some(i => i.startsWith('missing_bar:'))).toBe(true)
  })
  test.each([NaN, Infinity, 0, -1])('rejects invalid closed price %s', close => {
    const series = seriesFixture()
    series.bars[1].close = close
    expect(normalizeScenarioSeries(series, series.source.fetchedAt).closed).toEqual([])
  })
  test('rejects unsupported adjustment and period', () => {
    expect(() => normalizeScenarioSeries({ ...seriesFixture(), adjustment: 'hfq' }, '2026-12-31T23:00:00Z')).toThrow(/口径/)
    expect(() => normalizeScenarioSeries({ ...seriesFixture(), period: 'week' }, '2026-12-31T23:00:00Z')).toThrow(/周期/)
  })
})
