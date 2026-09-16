import { expect, test } from '@playwright/test'

test('eight moving averages and all calendar/minute periods work in the explicitly labeled example', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/?example=1')
  await expect(page.getByRole('heading', { name: '示例股票' })).toBeVisible()
  for (const period of [5, 10, 20, 30, 60, 90, 120, 250]) await expect(page.getByRole('switch', { name: `MA${period}`, exact: true })).toBeChecked()
  await expect(page.getByTestId('predicted-indicator-line')).toHaveCount(11)
  await page.getByRole('switch', { name: 'MA250', exact: true }).uncheck()
  await expect(page.getByRole('switch', { name: 'MA250', exact: true })).not.toBeChecked()
  await page.getByRole('switch', { name: 'MA250', exact: true }).check()

  for (const period of ['周线', '月线', '季线', '年线']) {
    await page.getByRole('tab', { name: period, exact: true }).click()
    await expect(page.getByText(`当前周期：${period}`, { exact: true })).toBeVisible()
    await expect(page.getByTestId('candlestick-layer')).toBeVisible()
    await expect(page.getByTestId('prediction-candle')).toHaveCount(0)
  }
  await expect(page.getByText(/MA250 历史不足|MA.*历史不足/)).toBeVisible()
  for (const [value, name] of [['1m', '1分钟'], ['5m', '5分钟'], ['15m', '15分钟'], ['30m', '30分钟'], ['60m', '1小时'], ['120m', '2小时']]) {
    await page.getByRole('combobox', { name: '分钟K线周期' }).selectOption(value)
    await expect(page.getByText(`当前周期：${name}`, { exact: true })).toBeVisible()
    await expect(page.getByTestId('candlestick-layer')).toBeVisible()
    await expect(page.getByText(/正在加载.*行情/)).toHaveCount(0)
  }
  await page.getByRole('tab', { name: '分时', exact: true }).click()
  await expect(page.getByText('当前周期：分时', { exact: true })).toBeVisible()
  await expect(page.getByTestId('candlestick-layer')).toHaveCount(0)
  await expect(page.getByRole('switch', { name: 'MA250', exact: true })).toHaveCount(0)
  await expect(page.getByRole('img', { name: '分时主图' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  expect(errors).toEqual([])
})

test('minute drawing survives reload in its own period without appearing on the daily chart', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Desktop inspector flow')
  await page.goto('/?example=1')
  await page.getByRole('combobox', { name: '分钟K线周期' }).selectOption('30m')
  await expect(page.getByText('当前周期：30分钟', { exact: true })).toBeVisible()
  await expect(page.getByText(/正在加载.*行情/)).toHaveCount(0)
  await page.getByLabel('桌面绘图工具').getByRole('button', { name: '水平线', exact: true }).click()
  await page.getByRole('img', { name: 'K线主图' }).click({ position: { x: 240, y: 150 } })
  await expect(page.getByTestId('annotation-horizontal-line')).toHaveCount(1)
  await page.reload()
  await expect(page.getByTestId('annotation-horizontal-line')).toHaveCount(0)
  await page.getByRole('combobox', { name: '分钟K线周期' }).selectOption('30m')
  await expect(page.getByTestId('annotation-horizontal-line')).toHaveCount(1)
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('stockcal:chart-workspace:DEMO:30m')!).drawings[0])
  expect(stored.points[0].time).toMatch(/T\d\d:\d\d:00\+08:00$/)
  expect(stored.period).toBe('30m')
})
