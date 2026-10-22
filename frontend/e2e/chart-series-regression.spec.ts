import { expect, test } from '@playwright/test'
import { createPreviewData, loadPreviewSeries } from '../src/features/research/preview-data'
import { aggregateCandles } from '../src/features/chart/chart-math'
import { isIntradayPeriod, type ChartPeriod } from '../src/features/chart/chart-periods'

const sample = createPreviewData()

for (const symbol of ['sh000001', '600519']) {
  test(`${symbol}: stable price basis and usable chart after period round trips`, async ({ page }, info) => {
    test.setTimeout(120_000)
    const index = symbol === 'sh000001'
    await page.route('**/api/**', route => route.fulfill({ json: [] }))
    await page.route('**/api/market/stocks/*/snapshot', route => route.fulfill({ json: {
      ...sample.market, adjustment: index ? 'none' : 'qfq',
      quote: { ...sample.market.quote, security: { code: symbol, name: index ? '上证指数' : '贵州茅台', exchange: 'SH' } },
    } }))
    await page.route('**/api/market/stocks/*/candles?*', async route => {
      const url = new URL(route.request().url())
      const period = url.searchParams.get('period') as ChartPeriod
      const minute = isIntradayPeriod(period)
      const bars = minute ? (await loadPreviewSeries('DEMO', period)).bars : aggregateCandles(sample.market.dailyCandles, period)
      await route.fulfill({ json: {
        symbol, period, adjustment: index || minute ? 'none' : url.searchParams.get('adjustment'),
        kind: period === 'intraday' ? 'intraday' : 'candles',
        // Include the old invalid value to exercise persisted-cache compatibility too.
        bars: index && period === 'intraday' ? bars.map(bar => ({ ...bar, averagePrice: 14 })) : bars,
        source: sample.market.source, limitedHistory: true,
      } })
    })
    await page.goto(`/?symbol=${symbol}`)
    const basis = page.getByLabel('价格复权方式')
    const chart = page.getByRole('img', { name: /^(K线|分时)主图$/ })
    await expect(chart).toBeVisible({ timeout: 60_000 })
    await expect(basis).toHaveValue(index ? 'none' : 'qfq')
    if (!index) await basis.selectOption('hfq')
    for (const period of ['分时', '季线', '分时', '年线', '日线']) {
      await page.getByRole('tab', { name: period, exact: true }).click()
      await expect(chart).toBeVisible()
      await expect(basis).toHaveValue(index || period === '分时' ? 'none' : 'hfq')
      if (period === '分时') {
        await expect(page.getByTestId('intraday-price-line')).toBeVisible()
        if (index) await expect(page.getByTestId('intraday-average-line')).toHaveCount(0)
        await chart.screenshot({ path: `artifacts/chart-${symbol}-${info.project.name}.png` })
      } else {
        await expect(page.getByTestId('candlestick-layer')).toBeVisible()
      }
      await expect(page.getByText('返回的股票或周期与请求不一致')).toHaveCount(0)
      await expect(page.getByText('此周期暂无可绘制的数据，可切换其他周期或重试。')).toHaveCount(0)
    }
  })
}
