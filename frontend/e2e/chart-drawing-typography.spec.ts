import { expect, test } from './fixtures/test'
import { startDrawing } from './fixtures/chart-workbench'

for (const theme of ['c', 'd']) {
  test(`prices and drawing labels keep their proportions in theme ${theme}`, async ({ page }, info) => {
    await page.setViewportSize(info.project.name === 'desktop' ? { width: 1660, height: 1000 } : { width: 411, height: 850 })
    await page.goto('/?example=1')
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme }, theme)
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
    await expect(marker.locator('circle').first()).toHaveAttribute('fill', '#c87988')
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
