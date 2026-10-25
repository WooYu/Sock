import { describe, expect, test } from 'vitest'
import { futureBarTargets } from './scenario-calendar'
import { testCalendar } from './scenario-test-fixtures'

describe('scenario trading targets', () => {
  test('15m_targets_skip_lunch_and_overnight', () => {
    expect(futureBarTargets('15m', '2026-10-12T11:30:00+08:00', [1, 2, 3, 4], testCalendar).map(t => t.barKey)).toEqual([
      '2026-10-12T13:15:00+08:00', '2026-10-12T13:30:00+08:00', '2026-10-12T13:45:00+08:00', '2026-10-12T14:00:00+08:00',
    ])
    expect(futureBarTargets('15m', '2026-10-09T15:00:00+08:00', [1], testCalendar)[0].barKey).toBe('2026-10-12T09:45:00+08:00')
  })
  test('daily_targets_skip_weekend', () => {
    expect(futureBarTargets('day', '2026-10-09', [1, 2, 3], testCalendar).map(t => t.barKey)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14'])
  })
  test('preopen_targets_from_today_use_horizons_2_3_4', () => {
    expect(futureBarTargets('day', '2026-10-09', [2, 3, 4], testCalendar).map(t => t.barKey)).toEqual(['2026-10-13', '2026-10-14', '2026-10-15'])
  })
  test('hour_targets_skip_lunch_and_overnight', () => {
    expect(futureBarTargets('60m', '2026-10-12T11:30:00+08:00', [1, 2, 3], testCalendar).map(t => t.barKey)).toEqual([
      '2026-10-12T14:00:00+08:00', '2026-10-12T15:00:00+08:00', '2026-10-13T10:30:00+08:00',
    ])
  })
  test('30m_targets_use_their_own_session_ends', () => {
    expect(futureBarTargets('30m', '2026-10-12T11:30:00+08:00', [1, 2, 3], testCalendar).map(t => t.barKey)).toEqual([
      '2026-10-12T13:30:00+08:00', '2026-10-12T14:00:00+08:00', '2026-10-12T14:30:00+08:00',
    ])
  })
  test('synthetic_holiday_is_skipped', () => {
    const calendar = { ...testCalendar, tradingDays: testCalendar.tradingDays.filter(d => d !== '2026-10-13') }
    expect(futureBarTargets('day', '2026-10-12', [1], calendar)[0].barKey).toBe('2026-10-14')
  })
  test('missing_calendar_keeps_relative_horizons', () => {
    const targets = futureBarTargets('day', '2026-10-09', [1, 2, 3], null)
    expect(targets.map(t => t.horizon)).toEqual([1, 2, 3])
    expect(targets.every(t => t.barKey === null && t.issues.includes('calendar_missing'))).toBe(true)
  })
  test('calendar_out_of_range_does_not_guess_weekdays', () => {
    const target = futureBarTargets('day', '2026-10-15', [1], testCalendar)[0]
    expect(target.barKey).toBeNull()
    expect(target.issues).toContain('calendar_out_of_range')
  })
  test('invalid_origin_or_horizon_is_rejected', () => {
    expect(() => futureBarTargets('day', '2026-02-30', [1], testCalendar)).toThrow(/原点/)
    expect(() => futureBarTargets('60m', '2026-10-12T12:30:00+08:00', [1], testCalendar)).toThrow(/原点/)
  })
})
