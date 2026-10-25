import { expect, test } from './fixtures/test'

for (const width of [320, 411]) {
  for (const theme of ['c', 'd']) {
    test(`candle touch details fit ${width}px in theme ${theme} and scroll without moving the chart`, async ({ page }, info) => {
      test.skip(info.project.name !== 'mobile', 'Exercises native touch input')
      await page.setViewportSize({ width, height: 780 })
      await page.goto('/?example=1')
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme }, theme)
      const chart = page.getByRole('img', { name: 'K线主图', exact: true })
      await expect(page.getByTestId('candlestick-layer')).toBeVisible()
      await chart.scrollIntoViewIfNeeded()
      const bounds = (await chart.boundingBox())!
      await page.touchscreen.tap(bounds.x + bounds.width * .3, bounds.y + bounds.height * .35)
      const details = page.getByRole('region', { name: 'K线数据详情' })
      await expect(details).toBeVisible()
      const sheet = page.getByRole('dialog', { name: 'K线数据详情', exact: true })
      const rect = (await sheet.boundingBox())!
      expect(rect.x).toBeGreaterThanOrEqual(0)
      expect(rect.x + rect.width).toBeLessThanOrEqual(width + 1)
      expect(rect.y + rect.height).toBeLessThanOrEqual(781)
      await expect(sheet).toHaveCSS('background-color', theme === 'c' ? 'rgb(252, 254, 252)' : 'rgb(24, 36, 49)')
      const before = await details.locator('header strong').innerText()
      const viewport = page.locator('.sc-kline-chart-surface')
      const visibleStart = await viewport.getAttribute('data-visible-start')
      const body = sheet.locator('.sc-chart-sheet-body')
      await details.locator('dl > div').last().scrollIntoViewIfNeeded()
      const lastRow = (await details.locator('dl > div').last().boundingBox())!
      const bodyBounds = (await body.boundingBox())!
      expect(lastRow.y + lastRow.height).toBeLessThanOrEqual(bodyBounds.y + bodyBounds.height + 1)
      await expect(details.locator('header strong')).toHaveText(before)
      await expect(viewport).toHaveAttribute('data-visible-start', visibleStart!)
      await expect(sheet.getByRole('button', { name: '关闭K线数据详情', exact: true })).toBeInViewport()
      await sheet.getByRole('button', { name: '关闭K线数据详情', exact: true }).tap()
      await expect(details).toHaveCount(0)
    })

    test(`forecast sheet keeps its header reachable after scrolling at ${width}px in theme ${theme}`, async ({ page }, info) => {
      test.skip(info.project.name !== 'mobile', 'Exercises the mobile forecast sheet')
      await page.setViewportSize({ width, height: 620 })
      await page.goto('/?example=1')
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme }, theme)
      const target = page.getByRole('button', { name: /^查看预测 / }).first()
      await target.scrollIntoViewIfNeeded()
      const backgroundY = await page.evaluate(() => window.scrollY)
      await target.tap()
      const sheet = page.getByRole('dialog', { name: '指标预测详情', exact: true })
      await expect(sheet).toBeVisible()
      expect(await page.evaluate(() => window.scrollY)).toBe(backgroundY)
      await expect(page.locator('html')).toHaveCSS('overflow', 'hidden')
      await page.mouse.move(5, 10)
      await page.mouse.wheel(0, 300)
      expect(await page.evaluate(() => window.scrollY)).toBe(backgroundY)
      const body = sheet.locator('.sc-chart-sheet-body')
      const last = sheet.locator('.rs-forecast-value-grid > div').last()
      await last.scrollIntoViewIfNeeded()
      await expect.poll(() => body.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
      const rect = (await sheet.boundingBox())!
      const lastRect = (await last.boundingBox())!
      expect(lastRect.y + lastRect.height).toBeLessThanOrEqual(rect.y + rect.height + 1)
      expect(await sheet.evaluate(element => element.scrollTop)).toBe(0)
      const close = sheet.getByRole('button', { name: '关闭指标预测详情', exact: true })
      const closeRect = (await close.boundingBox())!
      expect(closeRect.y).toBeGreaterThanOrEqual(rect.y)
      await expect(close).toBeInViewport()
      await close.tap()
      await expect(sheet).toHaveCount(0)
      expect(await page.evaluate(() => window.scrollY)).toBe(backgroundY)
      await expect(page.locator('html')).not.toHaveCSS('overflow', 'hidden')
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
