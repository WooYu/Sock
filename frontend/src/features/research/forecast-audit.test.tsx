import { render, screen, waitFor } from '@testing-library/react'
import { expect, test } from 'vitest'
import { ForecastAudit } from './forecast-audit'
import { createPreviewData } from './preview-data'
test('keeps the first observed forecast immutable and does not invent missed daily origins', async () => {
  localStorage.clear()
  const market = createPreviewData().market
  market.quote.security.code = '600519'
  market.adjustment = 'qfq'
  market.source.fetchedAt = '2026-10-16T08:00:00Z'
  const key = 'stockcal.indicator-audit.v1:600519:qfq'
  const view = render(<ForecastAudit market={market} />)
  await waitFor(() => expect(JSON.parse(localStorage.getItem(key)!)).toHaveLength(1))
  const frozen = localStorage.getItem(key)
  view.rerender(<ForecastAudit market={{ ...market, source: { ...market.source, fetchedAt: '2026-10-16T09:00:00Z' } }} />)
  await screen.findByText(/预测核验记录/)
  expect(localStorage.getItem(key)).toBe(frozen)
})
