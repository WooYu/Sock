import { expect, test } from './fixtures/test'

test('historical candle details show change, amplitude and axis labels', async ({ page }, info) => {
  await page.route('**/api/sync/**', route => route.fulfill({ json: { nextCursor: 0, changes: [], applied: true, cursor: 0 } }))
  await page.goto('/?example=1')
  const chart = page.getByRole('img', { name: 'K线主图', exact: true })
  await expect(chart).toBeVisible({ timeout: 30_000 })
  await chart.scrollIntoViewIfNeeded()
  await expect(page.getByTestId('candlestick-layer').locator('rect').first()).toBeVisible()
  const bounds = await page.getByTestId('candlestick-layer').locator('rect').nth(1).boundingBox()
  if (!bounds) throw new Error('Chart has no bounds')
  const point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
  if (info.project.name === 'mobile') await page.touchscreen.tap(point.x, point.y)
  else await page.mouse.move(point.x, point.y)
  const tooltip = page.getByTestId(info.project.name === 'mobile' ? 'candle-touch-details' : 'crosshair-tooltip')
  await expect(tooltip).toContainText('当日涨跌')
  await expect(tooltip).toContainText(/振幅.*%/)
  await expect(page.getByTestId('crosshair-axis-labels')).toBeVisible()
  await page.screenshot({ path: `artifacts/kline-details-${info.project.name}.png` })
})
