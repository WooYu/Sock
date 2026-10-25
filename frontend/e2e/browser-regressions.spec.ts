import { expect, test } from './fixtures/test'
import { chooseBasis, startDrawing } from './fixtures/chart-workbench'
import { createPreviewData, loadPreviewSeries } from '../src/features/research/preview-data'
import { aggregateCandles } from '../src/features/chart/chart-math'
import type { ChartPeriod } from '../src/features/chart/chart-periods'

const sample = createPreviewData()

test.beforeEach(async ({ page }) => {
  // Keep browser regression runs isolated from shared account and sync data.
  await page.route('**/api/**', route => {
    const request = route.request()
    if (new URL(request.url()).pathname.startsWith('/api/sync/')) return route.fulfill({ json: { nextCursor: 0, changes: [], applied: true, cursor: 0 } })
    if (!['GET', 'HEAD'].includes(request.method())) return route.fulfill({ status: 503, json: { message: 'Browser test: writes isolated' } })
    return route.continue()
  })
  await page.route('**/api/market/stocks/*/snapshot', async route => {
    await new Promise(resolve => setTimeout(resolve, 500))
    return route.fulfill({ json: { ...sample.market, quote: { ...sample.market.quote, security: { code: '300502', name: '新易盛' } }, source: { ...sample.market.source, online: true, state: 'READY' } } })
  })
  await page.route('**/api/market/stocks/*/candles?*', async route => {
    const url = new URL(route.request().url())
    const period = url.searchParams.get('period') as ChartPeriod
    const bars = ['60m', '30m', '15m', 'intraday'].includes(period) ? (await loadPreviewSeries('DEMO', period)).bars : aggregateCandles(sample.market.dailyCandles, period)
    return route.fulfill({ json: { symbol: '300502', period, adjustment: url.searchParams.get('adjustment') ?? 'none', kind: period === 'intraday' ? 'intraday' : 'candles', bars, source: { ...sample.market.source, online: true }, limitedHistory: true } })
  })
  await page.route('**/api/market/stocks/*/prediction?*', route => route.fulfill({ json: { ...sample.prediction, symbol: '300502' } }))
})

test('adjusted drawings survive reload and remain isolated between price bases', async ({ page }) => {
  test.setTimeout(90000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('dialog', dialog => dialog.accept())
  await page.goto('/?symbol=300502')
  const annotation = page.getByTestId('annotation-horizontal-line')
  for (const adjustment of ['qfq', 'hfq']) {
    await chooseBasis(page, adjustment)
    await expect(page.getByTestId('candlestick-layer')).toBeVisible()
    await expect(annotation).toHaveCount(0)
    await startDrawing(page, '水平线')
    const chart = page.getByRole('img', { name: 'K线主图', exact: true })
    await chart.scrollIntoViewIfNeeded()
    const box = (await chart.boundingBox())!
    await chart.click({ position: { x: box.width * .4, y: box.height * .4 } })
    await expect(annotation).toHaveCount(1)
    await chart.press('Control+z')
    await expect(annotation).toHaveCount(0)
    await chart.press('Control+y')
    await expect(annotation).toHaveCount(1)
    await page.reload()
    await chooseBasis(page, adjustment)
    await expect(annotation).toHaveCount(1)
  }
  await chooseBasis(page, 'none')
  await expect(annotation).toHaveCount(0)
  await chooseBasis(page, 'qfq')
  await expect(annotation).toHaveCount(1)
  expect(errors).toEqual([])
})

test('saved trades hydrate without errors after repeated reloads', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => localStorage.setItem('stockcal:trades', JSON.stringify([{ id: 'browser-hydration', symbol: '300502', side: 'buy', quantity: 100, price: 129, fee: 0, tradedAt: '2026-10-23T00:00:00Z', note: '', revision: 1 }])))
  await page.goto('/trading/positions?symbol=300502')
  for (let i = 0; i < 2; i++) {
    await expect(page.getByRole('table', { name: '持仓列表' })).toContainText('100')
    await page.reload()
  }
  await expect(page.getByRole('table', { name: '持仓列表' })).toContainText('100')
  expect(errors).toEqual([])
})

test('initial forecast hash scrolls after delayed market and forecast rendering', async ({ page }) => {
  await page.goto('/?symbol=300502#automatic-forecast-results')
  const panel = page.locator('#automatic-forecast-results')
  await expect(panel.getByRole('table', { name: /日线 MA\/BOLL参考位/ })).toBeVisible({ timeout: 45000 })
  await expect.poll(async () => panel.evaluate(element => {
    const rect = element.getBoundingClientRect()
    return rect.top >= -1 && rect.top < innerHeight / 2 && scrollY > 0
  }), { timeout: 45000 }).toBe(true)
})

test('forecast values remain readable when the chart stretches', async ({ page }, info) => {
  await page.goto('/?symbol=300502')
  await page.getByRole('button', { name: /^查看预测 / }).first().click()
  const values = page.locator('.rs-inline-forecast-details')
  await expect(values).toBeVisible()
  await expect(values.locator('[data-indicator=ma5]')).toContainText('MA5')
  await expect(values.locator('em').first()).toContainText('%')
  await expect(page.getByTestId('projection-tooltip')).toHaveCount(0)
  await values.screenshot({ path: `artifacts/forecast-values-${info.project.name}.png` })
  for (const width of [1000, 1200]) {
    await page.setViewportSize({ width, height: 850 })
    const rect = (await values.boundingBox())!
    expect(rect.x).toBeGreaterThanOrEqual(0)
    expect(rect.x + rect.width).toBeLessThanOrEqual(width)
    await expect(values.locator('[data-indicator=ma5]')).toContainText('MA5')
  }
})

test('five-day tab displays five sessions and preserves the daily adjustment preference', async ({ page }) => {
  await page.route('**/api/market/stocks/*/candles?*', async route => {
    const url = new URL(route.request().url())
    const period = url.searchParams.get('period') as ChartPeriod
    const series = await loadPreviewSeries('DEMO', period)
    return route.fulfill({ json: { ...series, symbol: '300502', adjustment: url.searchParams.get('adjustment') } })
  })
  await page.goto('/?symbol=300502')
  await expect(page.getByTestId('candlestick-layer')).toBeVisible()
  await page.getByLabel('更多K线周期').selectOption('5day')
  await expect(page.getByLabel('更多K线周期')).toHaveValue('5day')
  await expect(page.getByTestId('intraday-price-line')).toBeVisible()
  await expect(page.getByTestId('five-day-sessions').locator('text')).toHaveCount(5)
  await expect(page.getByTestId('intraday-average-line')).toBeVisible()
  await expect(page.getByTestId('projection-day-line')).toHaveCount(0)
  await expect(page.getByTestId('predicted-indicator-line')).toHaveCount(0)
  await expect(page.locator('[data-chart-layer="indicator"] path')).toHaveCount(0)
  await expect(page.locator('.rs-auto-method')).toHaveCount(0)
  await expect(page.getByRole('switch', { name: '未来推演', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'MA总开关' })).toHaveCount(0)
  await page.getByRole('button', { name: '图表设置', exact: true }).click()
  await expect(page.getByLabel('价格复权方式')).toBeDisabled()
  await expect(page.getByLabel('价格复权方式')).toHaveValue('none')
  await page.getByRole('button', { name: '关闭图表设置', exact: true }).click()
  await page.locator('.sc-kline-chart-panel').screenshot({ path: `artifacts/five-day-simple-${test.info().project.name}.png` })
  await page.getByRole('tab', { name: '日线', exact: true }).click()
  await page.getByRole('button', { name: '图表设置', exact: true }).click()
  await expect(page.getByLabel('价格复权方式')).toHaveValue('qfq')
  await expect(page.getByTestId('candlestick-layer')).toBeVisible()
  await expect(page.getByRole('button', { name: 'MA总开关' })).toBeVisible()
})
