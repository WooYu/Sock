import { expect, test } from '@playwright/test'

test('inspect, deliberate navigation and price axis operate independently', async ({ page }, info) => {
  test.setTimeout(120_000)
  await page.route('**/api/**', route => route.fulfill({ status: 503, json: { message: '离线交互验证' } }))
  await page.goto('/?example=1')
  const chart = page.getByRole('img', { name: 'K线主图' })
  const surface = page.locator('.sc-kline-chart-surface')
  await expect(chart).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: '查看价格', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const initialStart = await surface.getAttribute('data-visible-start')
  const initialEnd = await surface.getAttribute('data-visible-end')
  const zoom = await surface.getAttribute('data-zoom')
  const drag = async (dx: number, dy: number) => {
    await chart.scrollIntoViewIfNeeded()
    const box = (await chart.boundingBox())!
    const x = box.x + box.width * .45, y = box.y + box.height * .35
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + dx, y + dy, { steps: 8 })
    await page.mouse.up()
  }
  await drag(60, 100)
  await expect(surface).toHaveAttribute('data-visible-start', initialStart!)
  await expect(surface).toHaveAttribute('data-zoom', zoom!)
  await expect(page.getByTestId('crosshair-tooltip')).toBeVisible()
  await page.mouse.wheel(0, 100)
  await expect(surface).toHaveAttribute('data-zoom', zoom!)

  await page.getByRole('button', { name: '移动图表', exact: true }).click()
  await drag(5, 70)
  await expect(surface).toHaveAttribute('data-visible-start', initialStart!)
  await drag(85, 3)
  await expect(surface).not.toHaveAttribute('data-visible-start', initialStart!)
  await page.getByRole('button', { name: '回到最新', exact: true }).click()
  await expect(surface).toHaveAttribute('data-visible-end', initialEnd!)

  const axis = page.getByTestId('price-axis-hit-area')
  await axis.scrollIntoViewIfNeeded()
  const axisBox = (await axis.boundingBox())!
  const min = await surface.getAttribute('data-price-min')
  await page.mouse.move(axisBox.x + axisBox.width / 2, axisBox.y + 60)
  await page.mouse.down()
  await page.mouse.move(axisBox.x + axisBox.width / 2, axisBox.y + 100, { steps: 5 })
  await page.mouse.up()
  await expect(surface).toHaveAttribute('data-price-auto', 'false')
  await expect(surface).not.toHaveAttribute('data-price-min', min!)
  await expect(surface).toHaveAttribute('data-visible-end', initialEnd!)
  await page.getByRole('button', { name: '自动价格', exact: true }).click()
  await expect(surface).toHaveAttribute('data-price-auto', 'true')
  await expect(surface).toHaveAttribute('data-price-min', min!)
  await page.getByRole('button', { name: '查看价格', exact: true }).click()
  if (info.project.name === 'mobile') {
    await chart.dispatchEvent('pointerdown', { pointerId: 12, pointerType: 'touch', button: 0, clientX: 150, clientY: 200, bubbles: true })
    await chart.dispatchEvent('pointerup', { pointerId: 12, pointerType: 'touch', clientX: 150, clientY: 200, bubbles: true })
    await chart.dispatchEvent('pointerleave', { pointerId: 12, pointerType: 'touch' })
    await expect(page.getByTestId('crosshair-tooltip')).toBeVisible()
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.locator('.sc-kline-chart-panel').screenshot({ path: `artifacts/chart-navigation-${info.project.name}.png` })
})
