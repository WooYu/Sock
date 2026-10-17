import { expect, test, type Page } from '@playwright/test'
import { createPreviewData } from '../src/features/research/preview-data'
import { aggregateCandles } from '../src/features/chart/chart-math'
import type { ChartPeriod } from '../src/features/chart/chart-periods'

const sample = createPreviewData()
const names: Record<string, string> = { '600519': '贵州茅台', '002475': '立讯精密', '000001': '平安银行' }

async function marketApi(page: Page, failPrediction = false) {
  await page.route('**/api/market/stocks/*/candles?*', (route) => {
    const url = new URL(route.request().url())
    const symbol = url.pathname.split('/').at(-2)!
    const period = url.searchParams.get('period') as ChartPeriod
    return route.fulfill({ json: { symbol, period, adjustment: 'none', kind: 'candles', bars: aggregateCandles(sample.market.dailyCandles, period), source: { ...sample.market.source, name: 'TEST', online: true }, limitedHistory: true } })
  })
  await page.route('**/api/market/search?*', (route) => route.fulfill({ json: [{ code: '002475', name: '立讯精密', exchange: 'SZ' }] }))
  await page.route('**/api/market/stocks/*/snapshot', (route) => {
    const code = new URL(route.request().url()).pathname.split('/').at(-2)!
    return route.fulfill({ json: { ...sample.market, quote: { ...sample.market.quote, security: { code, name: names[code] ?? code, exchange: 'SH' } }, source: { ...sample.market.source, name: 'TEST', online: true, state: 'READY' } } })
  })
  await page.route('**/api/market/stocks/*/prediction?*', (route) => {
    const symbol = new URL(route.request().url()).pathname.split('/').at(-2)!
    return failPrediction ? route.fulfill({ status: 503, json: { message: '预测数据不足' } }) : route.fulfill({ json: { ...sample.prediction, symbol, modelVersion: 'baseline-v1' } })
  })
  await page.route('**/api/knowledge/rules', (route) => route.fulfill({ json: [{ id: 'note-rule', name: '均线位置校验', enabled: true, action: 'WAIT', priority: 50, conditions: [{ field: 'closeAboveMa20', operator: 'equals', value: 0 }], evidenceIds: ['笔记/均线.md:12'] }] }))
}

test.describe('K-line research studio', () => {
  test('opens search with a shortcut, clears without closing, and restores focus after selection', async ({ page }, info) => {
    await marketApi(page)
    await page.goto('/?example=1')
    await expect(page.getByRole('heading', { name: '示例股票', exact: true })).toBeVisible()
    // Wait for an observable client interaction before sending a global shortcut.
    if (info.project.name === 'mobile') await page.getByRole('button', { name: '选股', exact: true }).click()
    const search = page.getByRole('combobox', { name: '搜索 A 股' })
    await search.fill('准备')
    await page.getByRole('button', { name: '清空搜索' }).click()
    if (info.project.name === 'mobile') await page.getByRole('button', { name: '关闭选股', exact: true }).click()
    else await search.press('Tab')
    await page.keyboard.press('Control+k')
    await expect(search).toBeFocused()
    if (info.project.name === 'mobile') {
      await expect(page.getByRole('dialog', { name: '选择股票' })).toBeVisible()
      await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')
    }
    await search.fill('立讯')
    await page.getByRole('button', { name: '清空搜索' }).click()
    await expect(search).toHaveValue('')
    await expect(search).toBeFocused()
    await search.fill('立讯')
    await search.press('Escape')
    await expect(search).toHaveValue('')
    await expect(search).toBeFocused()
    await search.fill('立讯')
    await expect(page.getByRole('option', { name: /立讯精密/ })).toBeVisible()
    await search.press('Enter')
    await expect(page.getByRole('heading', { name: '立讯精密', exact: true })).toBeVisible()
    if (info.project.name === 'mobile') {
      await expect(page.getByRole('dialog', { name: '选择股票' })).toHaveCount(0)
      await expect(page.getByRole('button', { name: '选股', exact: true })).toBeFocused()
      await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  })

  test('selects forecasts, reads all indicators, and compares actual historical evidence', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'Desktop forecast rail')
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await marketApi(page)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: '贵州茅台', exact: true })).toBeVisible()
    await expect(page.getByTestId('prediction-candle')).toHaveCount(3)
    await expect(page.getByTestId('predicted-indicator-line')).toHaveCount(6)
    const rail = page.getByRole('region', { name: '未来预测' })
    await rail.getByRole('button', { name: /T\+2/ }).click()
    await expect(page.getByTestId('prediction-candle').nth(1)).toHaveAttribute('aria-pressed', 'true')
    await rail.getByRole('tab', { name: 'MA 均线' }).click()
    for (const label of ['MA5', 'MA10', 'MA20']) await expect(rail.getByText(label, { exact: true })).toBeVisible()
    await rail.getByRole('tab', { name: 'BOLL 通道' }).click()
    for (const label of ['BOLL 上轨', 'BOLL 中轨', 'BOLL 下轨']) await expect(rail.getByText(label, { exact: true })).toBeVisible()
    await page.getByRole('switch', { name: '未来推演', exact: true }).uncheck()
    await expect(page.getByTestId('prediction-candle')).toHaveCount(0)
    await expect(rail.getByText('预测图层已隐藏')).toBeVisible()
    await rail.getByRole('button', { name: '显示未来推演' }).click()
    await expect(page.getByTestId('prediction-candle')).toHaveCount(3)
    await page.getByRole('tab', { name: '历史相似', exact: true }).click()
    await expect(page.getByText('历史后续 3 日').first()).toBeVisible()
    await page.getByRole('tab', { name: /笔记规则/ }).click()
    await expect(page.getByText('均线位置校验')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('searches in place, preserves selection in the URL, and saves a watchlist', async ({ page }, info) => {
    await marketApi(page)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: '贵州茅台', exact: true })).toBeVisible()
    if (info.project.name === 'mobile') await page.getByRole('button', { name: '选股', exact: true }).click()
    await page.getByRole('combobox', { name: '搜索 A 股' }).fill('立讯')
    await page.getByRole('option', { name: /立讯精密/ }).click()
    await expect(page.getByRole('heading', { name: '立讯精密', exact: true })).toBeVisible()
    await expect(page).toHaveURL(/symbol=002475/)
    if (info.project.name === 'mobile') await page.getByRole('button', { name: '选股', exact: true }).click()
    await page.getByRole('button', { name: '加入自选 立讯精密' }).click()
    await page.reload()
    await expect(page.getByRole('heading', { name: '立讯精密', exact: true })).toBeVisible()
    if (info.project.name === 'mobile') await page.getByRole('button', { name: '选股', exact: true }).click()
    await page.getByRole('tab', { name: /我的自选/ }).click()
    await expect(page.getByRole('button', { name: '取消自选 立讯精密' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  })

  test('creates an anchored line, edits and restores it, and switches chart windows', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'Desktop drawing inspector')
    await marketApi(page)
    await page.goto('/chart')
    await expect(page.getByTestId('prediction-candle')).toHaveCount(3)
    await page.getByLabel('桌面绘图工具').getByRole('button', { name: '水平线', exact: true }).click()
    await page.getByRole('img', { name: 'K线主图' }).click({ position: { x: 240, y: 150 } })
    await expect(page.getByTestId('annotation-horizontal-line')).toHaveCount(1)
    await page.getByLabel('控制点 1 价格').fill('33.25')
    await expect(page.getByTestId('drawing-price-label')).toHaveText('33.25')
    await page.getByRole('button', { name: '撤销', exact: true }).click()
    await expect(page.getByTestId('drawing-price-label')).not.toHaveText('33.25')
    await page.getByRole('button', { name: '重做', exact: true }).click()
    await expect(page.getByTestId('drawing-price-label')).toHaveText('33.25')
    await page.reload()
    await expect(page.getByTestId('drawing-price-label')).toHaveText('33.25')
    await page.getByRole('button', { name: '适应全图', exact: true }).click()
    await expect(page.getByText(`共 ${sample.market.dailyCandles.length} 根 K 线`)).toBeVisible()
    await page.getByRole('tab', { name: '周线', exact: true }).click()
    await expect(page.getByTestId('annotation-horizontal-line')).toHaveCount(0)
    await expect(page.getByTestId('prediction-candle')).toHaveCount(0)
    await page.getByRole('tab', { name: '日线', exact: true }).click()
    await expect(page.getByTestId('annotation-horizontal-line')).toHaveCount(1)
  })

  test('shows forecast failure without losing the chart and offers an explicit sample on market failure', async ({ page }, info) => {
    await marketApi(page, true)
    await page.goto('/')
    await expect(page.getByRole('img', { name: 'K线主图' })).toBeVisible()
    if (info.project.name === 'mobile') await page.getByRole('button', { name: '预测详情', exact: true }).click()
    await expect(page.getByRole('heading', { name: '预测暂不可用', exact: true })).toBeVisible()
    await page.route('**/api/market/stocks/*/snapshot', (route) => route.fulfill({ status: 502, json: {} }))
    await page.goto('/?symbol=000001')
    await expect(page.getByRole('button', { name: '用示例体验' })).toBeVisible()
    await expect(page.getByRole('img', { name: 'K线主图' })).toHaveCount(0)
    await page.getByRole('button', { name: '用示例体验' }).click()
    await expect(page.getByRole('heading', { name: '示例股票', exact: true })).toBeVisible()
    await expect(page.getByText(/当前为合成数据/)).toBeVisible()
    await expect(page.getByTestId('prediction-candle')).toHaveCount(3)
  })

  test('opens the full mobile forecast and keeps drawing tools reachable', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'Phone forecast sheet')
    await marketApi(page)
    await page.goto('/')
    await expect(page.getByTestId('prediction-candle')).toHaveCount(3)
    await expect(page.getByRole('navigation', { name: '移动绘图工具' }).getByRole('button', { name: '水平线', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '预测详情', exact: true }).click()
    const sheet = page.getByRole('dialog', { name: '预测详情' })
    await sheet.getByRole('tab', { name: /第3日/ }).click()
    for (const label of ['MA5', 'MA10', 'MA20', 'BOLL上轨', 'BOLL中轨', 'BOLL下轨']) await expect(sheet.getByText(label, { exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  })
})

test('navigates continuous history without changing drawings and restores forecast at latest', async ({ page }) => {
  await marketApi(page)
  await page.goto('/?example=1')
  const chart = page.getByRole('img', { name: 'K线主图', exact: true })
  const surface = page.locator('.sc-kline-chart-surface')
  await expect(chart).toBeVisible()
  await page.getByRole('button', { name: '放大图表', exact: true }).click()
  const start = Number(await surface.getAttribute('data-visible-start'))
  const end = Number(await surface.getAttribute('data-visible-end'))
  await chart.focus()
  await chart.press('ArrowLeft')
  await expect.poll(async () => Number(await surface.getAttribute('data-visible-end'))).toBeLessThan(end)
  await expect(page.getByTestId('prediction-candle')).toHaveCount(0)
  await page.getByRole('button', { name: '回到最新', exact: true }).click()
  await expect(surface).toHaveAttribute('data-visible-end', String(end))
  await expect(page.getByTestId('prediction-candle')).toHaveCount(3)
  await page.getByTestId('prediction-candle').nth(1).click()
  await expect(page.getByTestId('prediction-candle').nth(1)).toHaveAttribute('aria-pressed', 'true')
  const box = await chart.boundingBox()
  await page.mouse.move(box!.x + box!.width * 0.8, box!.y + box!.height / 2)
  await page.mouse.wheel(0, -150)
  await expect.poll(async () => Number(await surface.getAttribute('data-visible-start'))).toBeGreaterThan(start)
  await page.mouse.move(box!.x + box!.width * 0.4, box!.y + box!.height * 0.5)
  await page.mouse.down()
  await page.mouse.move(box!.x + box!.width * 0.7, box!.y + box!.height * 0.5, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => Number(await surface.getAttribute('data-visible-end'))).toBeLessThan(end)
  await chart.press('0')
  await expect.poll(async () => Number(await surface.getAttribute('data-visible-end')) - Number(await surface.getAttribute('data-visible-start'))).toBe(80)
})


test('supports two-finger zoom on the mobile chart', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'Touch viewport')
  await marketApi(page)
  await page.goto('/?example=1')
  const chart = page.getByRole('img', { name: 'K线主图', exact: true })
  await chart.scrollIntoViewIfNeeded()
  const surface = page.locator('.sc-kline-chart-surface')
  const count = async () => Number(await surface.getAttribute('data-visible-end')) - Number(await surface.getAttribute('data-visible-start'))
  const initial = await count()
  const box = (await chart.boundingBox())!
  const client = await page.context().newCDPSession(page)
  const y = box.y + box.height / 2
  const center = box.x + box.width / 2
  const points = (distance: number) => [{ x: center - distance, y, id: 1 }, { x: center + distance, y, id: 2 }]
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(30) })
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(60) })
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect.poll(count).toBeLessThan(initial)
  await chart.focus()
  await chart.press('0')
  await expect.poll(count).toBe(80)
})
