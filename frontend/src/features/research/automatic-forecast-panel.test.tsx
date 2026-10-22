import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { AutomaticForecastPanel } from './automatic-forecast-panel'
import { forecastFixture } from '../scenario/scenario-test-fixtures'
import { buildDailyPriceLadder, resolveDailyPriceLimit } from '../scenario/scenario-price-ladder'
import { mergeReferenceLevels } from '../scenario/scenario-levels'
import type { AutomaticForecast } from './use-automatic-forecast'

test('shows ascending single-day candidates and keeps remote extrapolations collapsed but selectable', () => {
  const { snapshot } = forecastFixture()
  snapshot.dailyPriceLadder = buildDailyPriceLadder(snapshot.input, [], { limit: resolveDailyPriceLimit(snapshot.input.symbol) })
  snapshot.mergedLevels = mergeReferenceLevels([12, 21.09, 10].map((value, i) => ({ ...snapshot.references[0], id: `ref-${i}`, value,
    target: { horizon: 1, barKey: '2026-10-12', endAt: '2026-10-12T15:00:00+08:00', issues: [] } })))
  const forecast: AutomaticForecast = { analysis: snapshot, error: null, periods: ['day'], loading: false, issues: [], clearPeriod: null, refresh: vi.fn() }
  const onSelect = vi.fn()
  const { container } = render(<AutomaticForecastPanel forecast={forecast} selected={null} onSelect={onSelect} />)
  expect([...container.querySelectorAll('#automatic-forecast-results > .rs-auto-levels strong')].map(e => e.textContent)).toEqual(['10.00', '12.00'])
  expect(screen.getByTestId('daily-candidate-scope')).toHaveTextContent('2026-10-12')
  const details = container.querySelector<HTMLDetailsElement>('.rs-extended-levels')!
  expect(details.open).toBe(false)
  expect(details.textContent).toContain('21.09')
  fireEvent.click(details.querySelector('summary')!)
  fireEvent.click(details.querySelector('button')!)
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ value: 21.09 }))
})

