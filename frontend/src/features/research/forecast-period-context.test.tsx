import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { ForecastPeriodContext } from './forecast-period-context'
import { analysisInputFixture, seriesFixture } from '../scenario/scenario-test-fixtures'
import { buildScenarioAnalysis } from '../scenario/scenario-engine'
import { barEndAt } from '../scenario/scenario-calendar'
import type { AnalysisAnnotations, AnalysisPeriod } from '../scenario/scenario-types'

function fixture(confirmed = false) {
  const input = analysisInputFixture(seriesFixture({ closes: Array.from({ length: 30 }, (_, i) => 10 + i * .1) }))
  input.periods['15m'] = analysisInputFixture(seriesFixture({ period: '15m', closes: Array.from({ length: 30 }, (_, i) => 20 - i * .1) })).periods['15m']
  const bar = input.periods.day!.closed.at(-1)!
  const c = { period: 'day' as const, barKey: bar.day, eventAt: barEndAt('day', bar.day), confirmedAt: input.asOf, reason: '测试人工核对' }
  const annotations: AnalysisAnnotations = confirmed ? { trends: { day: { ...c, direction: 'rising', style: 'climbing' } }, mode: { ...c, id: 'trend_climb' }, bottom: { period: 'day', kind: 'indicator', indicator: 'ma5', selectedAt: input.asOf, reason: '底线已选' } } : {}
  return buildScenarioAnalysis(input, annotations, { id: 'context', version: 1, createdAt: input.asOf, kind: 'live', registry: [], scenarios: [], horizons: [1, 2, 3, 4], executionWindow: null })
}

test('shows each period direction and missing mode conditions without inventing confirmations', async () => {
  const onSelect = vi.fn<(period: AnalysisPeriod) => void>()
  render(<ForecastPeriodContext analysis={fixture()} selected="day" onSelect={onSelect} />)
  const daily = within(screen.getByRole('region', { name: '日线趋势与模式' }))
  expect(daily.getByRole('button')).toHaveTextContent('上涨 · 候选')
  expect(daily.getByText(/优先核对模式/).parentElement).toHaveTextContent('上涨趋势')
  expect(daily.getByText(/待补/)).toHaveTextContent('趋势未人工确认')
  expect(within(screen.getByRole('region', { name: '15分钟趋势与模式' })).getByRole('button')).toHaveTextContent('下跌 · 候选')
  expect(within(screen.getByRole('region', { name: '1小时趋势与模式' })).getByRole('button')).toBeDisabled()
  await userEvent.click(within(screen.getByRole('region', { name: '15分钟趋势与模式' })).getByRole('button'))
  expect(onSelect).toHaveBeenCalledWith('15m')
})

test('uses valid saved confirmation for the corresponding period only', () => {
  render(<ForecastPeriodContext analysis={fixture(true)} selected="day" onSelect={() => {}} />)
  const daily = within(screen.getByRole('region', { name: '日线趋势与模式' }))
  expect(daily.getByRole('button')).toHaveTextContent('上涨 · 已确认')
  expect(daily.getByText('已确认模式：').parentElement).toHaveTextContent('上涨趋势')
  expect(within(screen.getByRole('region', { name: '15分钟趋势与模式' })).getByRole('button')).toHaveTextContent('下跌 · 候选')
})
