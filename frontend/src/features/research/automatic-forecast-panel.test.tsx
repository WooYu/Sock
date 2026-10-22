import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { AutomaticForecastPanel } from './automatic-forecast-panel'
import { forecastFixture } from '../scenario/scenario-test-fixtures'
import { buildDailyPriceLadder, resolveDailyPriceLimit } from '../scenario/scenario-price-ladder'
import { mergeReferenceLevels } from '../scenario/scenario-levels'
import type { AutomaticForecast } from './use-automatic-forecast'

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

