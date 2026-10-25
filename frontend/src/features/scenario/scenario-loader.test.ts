import { describe, expect, test } from 'vitest'
import { loadScenarioInputs } from './scenario-loader'
import { seriesFixture } from './scenario-test-fixtures'
import type { AnalysisPeriod } from './scenario-types'

const asOf = '2026-12-31T23:00:00Z'
describe('independent scenario inputs', () => {
  test('loads_only_daily_history_by_default', async () => {
    const input = await loadScenarioInputs({ symbol: '603533', asOf, calendar: null, client: {
      series: async (symbol, period) => seriesFixture({ symbol, period: period as AnalysisPeriod }),
    } })
    expect(Object.keys(input.periods)).toEqual(['day'])
    expect(input.periods['60m']).toBeUndefined()
    expect(input.periods['30m']).toBeUndefined()
  })
  test('hour_failure_keeps_daily_history', async () => {
    const input = await loadScenarioInputs({ symbol: '603533', asOf, calendar: null, periods: ['day', '60m'], client: {
      series: async (symbol, period) => { if (period === '60m') throw new Error('小时数据不可用'); return seriesFixture({ symbol }) },
    } })
    expect(input.periods.day!.closed).toHaveLength(2)
    expect(input.loadIssues['60m']).toContain('小时数据不可用')
  })
  test('rejects_wrong_symbol_period_or_adjustment', async () => {
    for (const override of [{ symbol: '600519' }, { period: '30m' as const }, { adjustment: 'hfq' as const }]) {
      const input = await loadScenarioInputs({ symbol: '603533', asOf, calendar: null, client: {
        series: async (_symbol, period) => ({ ...seriesFixture({ period: period as AnalysisPeriod }), ...override }),
      } })
      expect(input.periods.day).toBeUndefined()
      expect(input.loadIssues.day!.length).toBeGreaterThan(0)
    }
  })
})
