import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { IndicatorProjectionLayer } from './indicator-projection-layer'
import { CHART_PERIODS, type IndicatorValues, isIntradayPeriod } from './chart-periods'
import { projectionTimes } from './indicator-projection'
import { createChartTransform } from './chart-coordinates'

test.each(CHART_PERIODS)('%s displays four guides, all selected indicators, limits and percentages', period => {
  const origin = isIntradayPeriod(period) ? '2026-10-16T10:00:00+08:00' : period === 'week' ? '2026-10-12' : period === 'month' || period === 'quarter' ? '2026-10-01' : period === 'year' ? '2026-01-01' : '2026-10-16'
  const times = projectionTimes(origin, period, null).map(p => p.day)
  const transform = createChartTransform({ times: [origin, ...times], minPrice: 90, maxPrice: 115, rect: { left: 58, top: 22, width: 850, height: 300 } })
  const values: IndicatorValues = { ma5: [100, 101, 101, 101, 101], boll: { upper: [105, 106, 106, 106, 106], middle: [100, 101, 101, 101, 101], lower: [95, 96, 96, 96, 96] } }
  render(<svg><IndicatorProjectionLayer baseClose={100} previousClose={100} limitRatio={0.1} times={times} historicalCount={1} transform={transform} period={period} indicators={{ ma5: true, boll: true }} values={values} interactive selectedTime={times[0]} /></svg>)
  expect(screen.getAllByTestId('projection-day-line')).toHaveLength(4)
  expect(screen.getAllByTestId('projection-within-limit')).toHaveLength(16)
  expect(screen.getByTestId('projection-tooltip')).toHaveTextContent('+1.00%')
  expect(screen.getByTestId('projection-tooltip')).toHaveTextContent('BOLL上')
  expect(screen.getByTestId('projection-tooltip')).toHaveTextContent('每日 ±10.00%')
})
