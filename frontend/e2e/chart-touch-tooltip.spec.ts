import { expect, test } from './fixtures/test'

for (const width of [320, 411]) {
  for (const theme of ['c', 'd']) {
    test(`candle data stays beside the chart at ${width}px in theme ${theme}`, async ({ page }, info) => {
      test.skip(info.project.name !== 'mobile', 'Exercises native touch input')
      await page.setViewportSize({ width, height: 780 })
      await page.goto('/?example=1')
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme; document.documentElement.style.scrollBehavior = 'auto' }, theme)
      const chart = page.getByRole('img', { name: 'K线主图', exact: true })
      await expect(page.getByTestId('candlestick-layer')).toBeVisible()
      await chart.scrollIntoViewIfNeeded()
      const bounds = (await chart.boundingBox())!
      const viewport = page.locator('.sc-kline-chart-surface')
      const visibleStart = await viewport.getAttribute('data-visible-start')
      const y = await page.evaluate(() => scrollY)
      await page.touchscreen.tap(bounds.x + bounds.width * .3, bounds.y + bounds.height * .35)
      const details = page.getByRole('region', { name: 'K线数据详情' })
      await expect(details).toBeVisible()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      expect(await page.evaluate(() => scrollY)).toBe(y)
      await expect(details.locator('.rs-candle-main-values > div')).toHaveCount(4)
      const before = await details.locator('header strong').innerText()
      await details.getByText('涨跌、成交量与指标', { exact: true }).tap()
      await expect(details.getByText('BOLL下', { exact: true })).toBeVisible()
      await details.locator('dl > div').last().scrollIntoViewIfNeeded()
      await expect(details.locator('header strong')).toHaveText(before)
      await expect(viewport).toHaveAttribute('data-visible-start', visibleStart!)
      const rect = (await details.boundingBox())!
      expect(rect.x).toBeGreaterThanOrEqual(0)
      expect(rect.x + rect.width).toBeLessThanOrEqual(width + 1)
      await details.getByRole('button', { name: '关闭K线数据详情', exact: true }).tap()
      await expect(details).toHaveCount(0)
      await expect(page.getByText('点选任意历史K线，在这里查看数据', { exact: true })).toBeVisible()
    })

    test(`forecast selection uses inline values without moving the page at ${width}px in theme ${theme}`, async ({ page }, info) => {
      test.skip(info.project.name !== 'mobile', 'Exercises the mobile forecast selection')
      await page.setViewportSize({ width, height: 780 })
      await page.goto('/?example=1')
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme; document.documentElement.style.scrollBehavior = 'auto' }, theme)
      const target = page.getByRole('button', { name: /^查看预测 / }).first()
      await target.scrollIntoViewIfNeeded()
      const backgroundY = await page.evaluate(() => scrollY)
      await target.tap()
      const details = page.locator('.rs-inline-forecast-details')
      await expect(details).toBeVisible()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      expect(await page.evaluate(() => scrollY)).toBe(backgroundY)
      await expect(details.locator('.rs-forecast-value-grid > div')).toHaveCount(11)
      await expect(page.locator('html')).not.toHaveCSS('overflow', 'hidden')
      await expect(details.getByText('MA250', { exact: true })).toBeVisible()
      const dates = page.locator('.rs-forecast-date-buttons button')
      await dates.nth(3).tap()
      await expect(dates.nth(3)).toHaveAttribute('aria-pressed', 'true')
      await expect(target).toHaveAttribute('aria-pressed', 'false')
      await expect(details.locator('header')).toContainText('2026-08-20')
      const rect = (await details.boundingBox())!
      expect(rect.x).toBeGreaterThanOrEqual(0)
      expect(rect.x + rect.width).toBeLessThanOrEqual(width + 1)
      await details.getByRole('button', { name: '收起详情', exact: true }).tap()
      await expect(details).toHaveCount(0)
    })
  }
}

test('mobile date labels use undistorted theme typography', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'Checks the mobile axis override')
  await page.goto('/?example=1')
  const chart = page.getByRole('img', { name: 'K线主图', exact: true })
  await expect(chart).toBeVisible()
  const labels = page.locator('[data-testid="chart-date-label"] text')
  await expect(labels.first()).toBeVisible()
  await expect(page.locator('[data-last-projection=true] [data-testid="projection-date-label"]')).toBeVisible()
  for (const label of await labels.all()) {
    await expect(label).toHaveCSS('font-size', '11px')
    await expect(label).toHaveCSS('transform', 'none')
    await expect.poll(() => label.evaluate(element => {
      const matrix = (element as SVGGraphicsElement).getScreenCTM()!
      return Math.abs(Math.hypot(matrix.a, matrix.b) - Math.hypot(matrix.c, matrix.d))
    })).toBeLessThan(.001)
  }
  const dates = await page.locator('[data-testid="chart-date-label"], [data-testid="projection-date-label"]').evaluateAll(elements => elements.map(element => element.getBoundingClientRect()).filter(rect => rect.width > 0).sort((a, b) => a.left - b.left).map(rect => ({ left: rect.left, right: rect.right })))
  for (let index = 1; index < dates.length; index++) expect(dates[index].left).toBeGreaterThan(dates[index - 1].right + 3)
})
