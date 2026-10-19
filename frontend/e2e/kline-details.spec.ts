import { expect, test } from '@playwright/test'

test('historical candle details show change, amplitude and axis labels', async ({ page }, info) => {
  await page.route('**/api/sync/**', route => route.fulfill({ json: { nextCursor: 0, changes: [], applied: true, cursor: 0 } }))
  await page.goto('/?example=1')
  const chart = page.getByRole('img', { name: 'K线主图', exact: true })
  await expect(chart).toBeVisible({ timeout: 30_000 })
  await chart.scrollIntoViewIfNeeded()
  await expect(page.getByTestId('candlestick-layer').locator('rect').first()).toBeVisible()
  const bounds = await page.getByTestId('candlestick-layer').locator('rect').nth(1).boundingBox()
  if (!bounds) throw new Error('Chart has no bounds')
  await chart.dispatchEvent('pointermove', { pointerId: 1, pointerType: 'mouse', clientX: bounds.x + bounds.width / 2, clientY: bounds.y + bounds.height / 2 })
  const tooltip = page.getByTestId('crosshair-tooltip')
  await expect(tooltip).toContainText('当日涨跌')
  await expect(tooltip).toContainText(/振幅.*%/)
  await expect(page.getByTestId('crosshair-axis-labels')).toBeVisible()
  await page.screenshot({ path: `artifacts/kline-details-${info.project.name}.png` })
})
