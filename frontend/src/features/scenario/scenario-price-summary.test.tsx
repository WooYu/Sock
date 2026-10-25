import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { analysisInputFixture, seriesFixture } from './scenario-test-fixtures'
import { buildScenarioAnalysis } from './scenario-engine'
import { resolveDailyPriceLimit } from './scenario-price-ladder'
import { ScenarioPriceSummary } from './scenario-price-summary'

test('audit_percentages_use_the_same_rounded_price_as_the_ladder', () => {
  const input = analysisInputFixture(seriesFixture({ closes: Array<number>(22).fill(10) }))
  input.periods['60m'] = analysisInputFixture(seriesFixture({ period: '60m', closes: Array<number>(22).fill(10.01) })).periods['60m']
  input.periods['30m'] = analysisInputFixture(seriesFixture({ period: '30m', closes: Array<number>(22).fill(10.09) })).periods['30m']
  const analysis = buildScenarioAnalysis(input, {}, { id: 'round-price', version: 1, kind: 'live', createdAt: input.asOf,
    registry: [], scenarios: [], horizons: [1, 2, 3], executionWindow: null, priceSelection: { limit: resolveDailyPriceLimit(input.symbol) } })
  render(<ScenarioPriceSummary analysis={analysis} loading={false} />)
  const original = screen.getByRole('article', { name: '综合参考价组1' })
  expect(original).toHaveTextContent('10.03')
  expect(original).toHaveTextContent('相对基准收盘 +0.30%')
  expect(within(screen.getByRole('article', { name: '上方参考价1' })).getByText('+0.30%')).toBeVisible()
})
