import { act, fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { AutomaticForecastPanel } from './automatic-forecast-panel'
import { forecastFixture } from '../scenario/scenario-test-fixtures'
import { buildDailyPriceLadder, resolveDailyPriceLimit } from '../scenario/scenario-price-ladder'
import { mergeReferenceLevels } from '../scenario/scenario-levels'
import type { AutomaticForecast } from './use-automatic-forecast'
import { analysisInputFixture, seriesFixture } from '../scenario/scenario-test-fixtures'
import { buildScenarioAnalysis } from '../scenario/scenario-engine'
import { forecastNoteRegistry } from './forecast-note-registry'

test('explains source-backed entry exclusions alongside retained indicator prices', () => {
  const input = analysisInputFixture(seriesFixture({ closes: Array.from({ length: 30 }, (_, i) => 20 - i / 10) }))
  const snapshot = buildScenarioAnalysis(input, {}, { id: 'entry-filter', version: 1, createdAt: input.asOf, kind: 'live',
    registry: forecastNoteRegistry, scenarios: [], horizons: [1, 2, 3, 4], executionWindow: null,
    priceSelection: { limit: resolveDailyPriceLimit(input.symbol) } })
  const forecast: AutomaticForecast = { analysis: snapshot, error: null, periods: ['day'], loading: false, issues: [], clearPeriod: null, refresh: vi.fn() }
  render(<AutomaticForecastPanel forecast={forecast} selected={null} onSelect={vi.fn()} />)
  expect(screen.getByRole('region', { name: '笔记预估条件核对' })).toHaveTextContent('原文入场过滤已触发')
  expect(screen.getByText('日MA20下方的新参与过滤 · 日线 · 条件已满足')).toBeInTheDocument()
  expect(screen.getByText(/未采用的条件/)).toBeInTheDocument()
  expect(screen.getAllByText('入场过滤未通过 · 仅作指标参考').length).toBeGreaterThan(0)
})

test('merges nearby cross-day targets in ascending order and filters remote extrapolations from candidates', () => {
  const { snapshot } = forecastFixture()
  snapshot.dailyPriceLadder = buildDailyPriceLadder(snapshot.input, [], { limit: resolveDailyPriceLimit(snapshot.input.symbol) })
  snapshot.mergedLevels = mergeReferenceLevels([12, 21.09, 10].map((value, i) => ({ ...snapshot.references[0], id: `ref-${i}`, value,
    target: { horizon: 4, barKey: '2026-10-15', endAt: '2026-10-15T15:00:00+08:00', issues: [] } })))
  const forecast: AutomaticForecast = { analysis: snapshot, error: null, periods: ['day'], loading: false, issues: [], clearPeriod: null, refresh: vi.fn() }
  const onSelect = vi.fn()
  const { container } = render(<AutomaticForecastPanel forecast={forecast} selected={null} onSelect={onSelect} />)
  expect([...container.querySelectorAll('#automatic-forecast-results > .rs-auto-levels strong')].map(e => e.textContent)).toEqual(['10.00', '12.00'])
  expect(screen.getByTestId('daily-candidate-scope')).toHaveTextContent('保留当日及跨日各目标根数')
  expect(container.querySelector('.rs-extended-levels')).toBeNull()
  expect(container.querySelector('.rs-auto-levels')!.textContent).not.toContain('21.09')
  fireEvent.click(container.querySelector('.rs-auto-levels button')!)
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ value: 10, references: [expect.objectContaining({ target: expect.objectContaining({ horizon: 4 }) })] }))
})


test('waits for delayed forecast layout before following the initial hash, without stealing later scroll', async () => {
  const { snapshot } = forecastFixture()
  const forecast: AutomaticForecast = { analysis: null, error: null, periods: ['day'], loading: true, issues: [], clearPeriod: null, refresh: vi.fn() }
  window.history.replaceState(null, '', '/#automatic-forecast-results')
  const scroll = vi.fn()
  const original = HTMLElement.prototype.scrollIntoView
  HTMLElement.prototype.scrollIntoView = scroll
  vi.useFakeTimers()
  try {
    const view = render(<AutomaticForecastPanel forecast={forecast} selected={null} onSelect={vi.fn()} />)
    await act(() => vi.advanceTimersByTimeAsync(40))
    expect(scroll).not.toHaveBeenCalled()
    view.rerender(<AutomaticForecastPanel forecast={{ ...forecast, analysis: snapshot, loading: false }} selected={null} onSelect={vi.fn()} />)
    await act(() => vi.advanceTimersByTimeAsync(40))
    expect(scroll).toHaveBeenCalledTimes(1)
    view.rerender(<AutomaticForecastPanel forecast={forecast} selected={null} onSelect={vi.fn()} />)
    view.rerender(<AutomaticForecastPanel forecast={{ ...forecast, analysis: snapshot, loading: false }} selected={null} onSelect={vi.fn()} />)
    await act(() => vi.advanceTimersByTimeAsync(40))
    expect(scroll).toHaveBeenCalledTimes(1)
  } finally {
    vi.useRealTimers()
    HTMLElement.prototype.scrollIntoView = original
    window.history.replaceState(null, '', '/')
  }
})
