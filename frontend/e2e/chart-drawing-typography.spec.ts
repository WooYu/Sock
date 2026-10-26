import { expect, test } from './fixtures/test'
import { createPreviewData, loadPreviewSeries } from '../src/features/research/preview-data'
import type { ChartPeriod } from '../src/features/chart/chart-periods'
import { startDrawing } from './fixtures/chart-workbench'

for (const theme of ['c', 'd']) {
  test(`prices and drawing labels keep their proportions in theme ${theme}`, async ({ page }, info) => {
    await page.setViewportSize(info.project.name === 'desktop' ? { width: 1660, height: 1000 } : { width: 411, height: 850 })
    const sample = createPreviewData()
    await page.route('**/api/market/stocks/*/snapshot', route => route.fulfill({ json: {
      ...sample.market, adjustment: 'qfq', quote: { ...sample.market.quote, limitRatio: .1, security: { code: '600519', name: '测试股票', exchange: 'SH' } },
    } }))
    await page.route('**/api/market/stocks/*/candles?*', async route => {
      const url = new URL(route.request().url()), period = url.searchParams.get('period') as ChartPeriod
      const series = await loadPreviewSeries('DEMO', period)
      await route.fulfill({ json: { ...series, symbol: '600519', adjustment: url.searchParams.get('adjustment') } })
    })
    await page.goto('/?symbol=600519')
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme }, theme)
    const forecast = page.getByRole('button', { name: /^查看预测 / }).first()
    await forecast.click()
    const dots = page.locator('[data-testid="projection-dot-frame"] circle, [data-testid="projection-selected-dot-frame"] circle')
    await expect(page.getByTestId('projection-dot-frame').first()).toBeVisible()
    await expect(page.getByTestId('projection-selected-dot-frame').first()).toBeVisible()
    for (const dot of await dots.all()) {
      await expect.poll(() => dot.evaluate(element => {
        const rect = element.getBoundingClientRect()
        return Math.abs(rect.width - rect.height)
      })).toBeLessThan(.01)
    }
    await page.getByRole('img', { name: 'K线主图', exact: true }).screenshot({ path: info.outputPath('projection-circles.png') })
    await startDrawing(page, '卖出点')
    const chart = page.getByRole('img', { name: 'K线主图', exact: true })
    await chart.scrollIntoViewIfNeeded()
    const box = (await chart.boundingBox())!
    await chart.click({ position: { x: box.width * .35, y: box.height * .35 } })
    const marker = page.getByTestId('annotation-sell')
    await expect(marker).toBeVisible()
    const labels = page.locator('[data-testid="chart-price-label"] text, [data-testid="drawing-label-frame"] text, [data-testid="drawing-handle"]')
    for (const label of await labels.all()) {
      await expect.poll(() => label.evaluate(element => {
        const matrix = (element as SVGGraphicsElement).getScreenCTM()!
        return Math.abs(Math.hypot(matrix.a, matrix.b) - Math.hypot(matrix.c, matrix.d))
      })).toBeLessThan(.001)
    }
    await expect(marker.locator('circle').first()).toHaveAttribute('fill', '#f23645')
    const dot = (await marker.locator('circle').first().boundingBox())!
    expect(Math.abs(dot.width - dot.height)).toBeLessThan(.01)
    // The compensated marker remains a selectable object with editable anchored prices.
    await marker.locator('text').click()
    await page.getByRole('button', { name: /^对象 / }).click()
    await expect(page.getByRole('region', { name: '对象属性', exact: true }).getByLabel('控制点 1 价格')).toBeVisible()
    await page.getByRole('button', { name: '关闭对象属性', exact: true }).click()
    await chart.scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath('drawing-typography.png') })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  })
}
