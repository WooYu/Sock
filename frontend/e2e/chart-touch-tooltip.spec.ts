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
      const rect = (await details.boundingBox())!
      expect(rect.x).toBeGreaterThanOrEqual(bounds.x - 1)
      expect(rect.x + rect.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1)
      expect(rect.y + rect.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1)
      await expect(details).toHaveCSS('background-color', theme === 'c' ? 'rgb(252, 254, 252)' : 'rgb(24, 36, 49)')
      const before = await details.locator('header strong').innerText()
      const viewport = page.locator('.sc-kline-chart-surface')
      const visibleStart = await viewport.getAttribute('data-visible-start')
      const list = details.locator('dl')
      const listBounds = (await list.boundingBox())!
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: listBounds.x + listBounds.width / 2, y: listBounds.y + listBounds.height * .8 }] })
      for (let step = 1; step <= 8; step++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: listBounds.x + listBounds.width / 2, y: listBounds.y + listBounds.height * (.8 - step * .075) }] })
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await cdp.detach()
      await expect.poll(() => list.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
      await details.locator('dl > div').last().scrollIntoViewIfNeeded()
      const lastRow = (await details.locator('dl > div').last().boundingBox())!
      const currentListBounds = (await list.boundingBox())!
      expect(lastRow.y + lastRow.height).toBeLessThanOrEqual(currentListBounds.y + currentListBounds.height + 1)
      await expect(details.locator('header strong')).toHaveText(before)
      await expect(viewport).toHaveAttribute('data-visible-start', visibleStart!)
      await expect(details.getByRole('button', { name: '关闭K线数据详情' })).toBeInViewport()
      await details.getByRole('button', { name: '关闭K线数据详情' }).tap()
      await expect(details).toHaveCount(0)
    })

    test(`forecast sheet keeps its header reachable after scrolling at ${width}px in theme ${theme}`, async ({ page }, info) => {
      test.skip(info.project.name !== 'mobile', 'Exercises the mobile forecast sheet')
      await page.setViewportSize({ width, height: 620 })
      await page.goto('/?example=1')
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme }, theme)
      const target = page.getByRole('button', { name: /^查看预测 / }).first()
      await target.tap()
      const sheet = page.getByRole('dialog', { name: '指标预测详情', exact: true })
      await expect(sheet).toBeVisible()
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
    })
  }
}
