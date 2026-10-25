import { expect, test, type Page } from './fixtures/test'
import { openResearch, startDrawing } from './fixtures/chart-workbench'
import { createPreviewData, loadPreviewSeries } from '../src/features/research/preview-data'
import { aggregateCandles } from '../src/features/chart/chart-math'
import type { ChartPeriod } from '../src/features/chart/chart-periods'

const sample = createPreviewData()
// Real-market fixtures use exchange ticks and an as-of time matching the frozen bars.
sample.market.dailyCandles = sample.market.dailyCandles.map(bar => ({ ...bar,
  open: Number(bar.open.toFixed(2)), high: Number(bar.high.toFixed(2)),
  low: Number(bar.low.toFixed(2)), close: Number(bar.close.toFixed(2)),
}))
const names: Record<string, string> = { '600519': '贵州茅台', '002475': '立讯精密', '000001': '平安银行' }

async function marketApi(page: Page, failPrediction = false) {
  await page.clock.setFixedTime(new Date(sample.market.source.fetchedAt))
  await page.route('**/api/market/stocks/*/candles?*', async (route) => {
    const url = new URL(route.request().url())
    const symbol = url.pathname.split('/').at(-2)!
    const period = url.searchParams.get('period') as ChartPeriod
    const bars = ['day', 'week', 'month', 'quarter', 'year'].includes(period) ? aggregateCandles(sample.market.dailyCandles, period) : (await loadPreviewSeries('DEMO', period)).bars
    return route.fulfill({ json: { symbol, period, adjustment: 'none', kind: 'candles', bars, source: { ...sample.market.source, name: 'TEST', online: true }, limitedHistory: true } })
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
  test('shows per-period trend and mode context and supports 15 minute forecasts', async ({ page }, info) => {
    await page.goto('/?example=1')
    await openResearch(page)
    const panel = page.getByRole('region', { name: '自动 MA/BOLL 预测', exact: true })
    const periods = panel.getByRole('navigation', { name: '预测计算周期' })
    await expect(periods.getByRole('button', { name: '15分钟', exact: true })).toBeEnabled({ timeout: 20000 })
    for (const name of ['日线', '1小时', '30分钟', '15分钟']) {
      const card = panel.getByRole('region', { name: name + '趋势与模式', exact: true })
      await expect(card).toContainText('K线趋势')
      await expect(card).toContainText('优先核对模式')
      await card.getByText('核对全部盈利模式条件').click()
      await expect(card.getByRole('listitem')).toHaveCount(4)
    }
    await periods.getByRole('button', { name: '15分钟', exact: true }).click()
    const table = panel.getByRole('table', { name: '15分钟 MA/BOLL参考位', exact: true })
    await expect(table).toBeVisible()
    await expect(table.getByRole('columnheader', { name: /未来第/ })).toHaveCount(4)
    await expect(table.locator('tbody tr').first()).not.toContainText('历史不足')
    await panel.locator('.rs-period-context').screenshot({ path: `artifacts/forecast-context-${info.project.name}.png` })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })

  test('shows indicator movement and sorts forecast rows', async ({ page }) => {
    await page.goto('/?example=1')
    await openResearch(page)
    const panel = page.getByRole('region', { name: '自动 MA/BOLL 预测', exact: true })
    const table = panel.getByRole('table', { name: /日线 MA\/BOLL参考位/ })
    await expect(panel.getByLabel('指标排序')).toBeVisible({ timeout: 20000 })
    const sorting = panel.getByLabel('指标排序')
    await sorting.selectOption('rise')
    const changes = await table.locator('tbody th small').allTextContents()
    const percentages = changes.map(text => Number(text.match(/([+-]?\d+\.\d+)%/)![1]))
    expect(percentages).toEqual([...percentages].sort((a, b) => b - a))
    const coloredValues = table.locator('td strong.sa-tone-rise, td strong.sa-tone-fall')
    expect(await coloredValues.count()).toBeGreaterThan(0)
    await expect(table.locator('td.sa-forecast-start').first()).toBeVisible()
    await sorting.selectOption('indicator')
    await expect(table.locator('tbody th').first()).toContainText('MA5')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })

  test('opens search with a shortcut, clears without closing, and restores focus after selection', async ({ page }, info) => {
    await marketApi(page)
    await page.goto('/?example=1')
    await expect(page.getByRole('heading', { name: '示例股票', exact: true })).toBeVisible()
    // Wait for an observable client interaction before sending a global shortcut.
    if (info.project.name === 'mobile') await page.getByRole('button', { name: '选择对象', exact: true }).click()
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
      await expect(page.getByRole('button', { name: '选择对象', exact: true })).toBeFocused()
      await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  })

  test('automatically calculates three historical and four future indicator columns and links candidate evidence', async ({ page }) => {
    await marketApi(page)
    const requested: string[] = []
    page.on('request', request => { if (request.url().includes('/candles?')) requested.push(new URL(request.url()).searchParams.get('period')!) })
    await page.goto('/')
    await openResearch(page)
    const panel = page.getByRole('region', { name: '自动 MA/BOLL 预测', exact: true })
    await expect(panel.getByRole('button', { name: '30分钟', exact: true })).toBeEnabled()
    expect(requested).toContain('60m')
    expect(requested).toContain('30m')
    const table = panel.getByRole('table', { name: /日线 MA\/BOLL参考位/ })
    await expect(table.getByRole('columnheader', { name: /历史第/ })).toHaveCount(3)
    await expect(table.getByRole('columnheader', { name: /未来第/ })).toHaveCount(4)
    await expect(page.getByTestId('prediction-candle')).toHaveCount(0)
    await expect(page.getByTestId('indicator-projection')).toHaveCount(1)
    await page.getByRole('button', { name: '图表设置', exact: true }).click()
    await page.getByRole('button', { name: 'MA总开关' }).click()
    await expect(page.locator('[data-chart-layer=indicator] [data-indicator]')).toHaveCount(0)
    await page.getByRole('button', { name: 'MA总开关' }).click()
    await expect(page.locator('[data-chart-layer=indicator] [data-indicator]')).toHaveCount(8)
    await page.getByRole('button', { name: '关闭图表设置', exact: true }).click()
    await panel.locator('.rs-auto-levels button').first().click()
    await expect(panel.getByRole('region', { name: '所选价位依据' })).toBeVisible()
    await page.getByRole('tab', { name: '笔记规则', exact: true }).click()
    await expect(page.getByRole('heading', { name: /价位选择依据 ·/ })).toBeVisible()
    await page.getByRole('tab', { name: '历史相似', exact: true }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })

  test('searches in place, preserves selection in the URL, and saves a watchlist', async ({ page }, info) => {
    await marketApi(page)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: '贵州茅台', exact: true })).toBeVisible()
    if (info.project.name === 'mobile') await page.getByRole('button', { name: '选择对象', exact: true }).click()
    await page.getByRole('combobox', { name: '搜索 A 股' }).fill('立讯')
    await page.getByRole('option', { name: /立讯精密/ }).click()
    await expect(page.getByRole('heading', { name: '立讯精密', exact: true })).toBeVisible()
    await expect(page).toHaveURL(/symbol=002475/)
    if (info.project.name === 'mobile') await page.getByRole('button', { name: '选择对象', exact: true }).click()
    await page.getByRole('button', { name: '加入自选 立讯精密' }).click()
    await page.reload()
    await expect(page.getByRole('heading', { name: '立讯精密', exact: true })).toBeVisible()
    if (info.project.name === 'mobile') await page.getByRole('button', { name: '选择对象', exact: true }).click()
    await page.getByRole('tab', { name: /我的自选/ }).click()
    await expect(page.getByRole('button', { name: '取消自选 立讯精密' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  })

  test('creates an anchored line, edits and restores it, and switches chart windows', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'Desktop drawing inspector')
    await marketApi(page)
    await page.goto('/chart')
    await expect(page.getByTestId('indicator-projection')).toHaveCount(1)
    await startDrawing(page, '水平线')
    await page.getByRole('img', { name: 'K线主图' }).click({ position: { x: 240, y: 150 } })
    await expect(page.getByTestId('annotation-horizontal-line')).toHaveCount(1)
    await page.getByRole('button', { name: /^对象 / }).click()
    await page.getByLabel('控制点 1 价格').fill('65.10')
    await page.getByRole('button', { name: '关闭对象属性', exact: true }).click()
    await expect(page.getByTestId('drawing-price-label')).toHaveText('65.10')
    await page.getByRole('button', { name: '撤销', exact: true }).click()
    await expect(page.getByTestId('drawing-price-label')).not.toHaveText('65.10')
    await page.getByRole('button', { name: '重做', exact: true }).click()
    await expect(page.getByTestId('drawing-price-label')).toHaveText('65.10')
    await page.reload()
    await expect(page.getByTestId('drawing-price-label')).toHaveText('65.10')
    await page.getByRole('button', { name: '回到最新', exact: true }).click()
    await page.locator('.rs-workbench-data > summary').click()
    await expect(page.getByText(`共 ${sample.market.dailyCandles.length} 根 K 线`, { exact: false })).toBeVisible()
    await page.getByRole('tab', { name: '周线', exact: true }).click()
    await expect(page.getByTestId('annotation-horizontal-line')).toHaveCount(0)
    await expect(page.getByTestId('prediction-candle')).toHaveCount(0)
    await page.getByRole('tab', { name: '日线', exact: true }).click()
    await expect(page.getByTestId('annotation-horizontal-line')).toHaveCount(1)
  })

  test('shows forecast failure without losing the chart and offers an explicit sample on market failure', async ({ page }) => {
    await marketApi(page, true)
    await page.goto('/')
    await expect(page.getByRole('img', { name: 'K线主图' })).toBeVisible()
    await openResearch(page)
    await expect(page.getByRole('region', { name: '自动 MA/BOLL 预测', exact: true }).locator('.rs-auto-levels button').first()).toBeVisible()
    await page.locator('.rs-workbench-research > summary').click()
    await page.route('**/api/market/stocks/*/snapshot', (route) => route.fulfill({ status: 502, json: {} }))
    await page.goto('/?symbol=000001')
    await expect(page.getByRole('button', { name: '先探索示例' })).toBeVisible()
    await expect(page.getByRole('img', { name: 'K线主图' })).toHaveCount(0)
    await page.getByRole('button', { name: '先探索示例' }).click()
    await expect(page.getByRole('heading', { name: '示例股票', exact: true })).toBeVisible()
    await expect(page.getByText(/当前为合成数据/)).toBeVisible()
    await expect(page.getByTestId('indicator-projection')).toHaveCount(1)
  })

  test('keeps full mobile research and drawing tools directly reachable', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'Phone research disclosure')
    await marketApi(page)
    await page.goto('/')
    await expect(page.getByTestId('indicator-projection')).toHaveCount(1)
    await startDrawing(page, '水平线')
    await expect(page.getByRole('navigation', { name: '绘图工具', exact: true }).getByRole('button', { name: '水平线', exact: true })).toBeVisible()
    await openResearch(page)
    const panel = page.getByRole('region', { name: '自动 MA/BOLL 预测', exact: true })
    await expect(panel.locator('.rs-auto-levels button').first()).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
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
  await expect(page.getByTestId('indicator-projection')).toHaveCount(0)
  await page.getByRole('button', { name: '回到最新', exact: true }).click()
  await expect(surface).toHaveAttribute('data-visible-end', String(end))
  await expect(page.getByTestId('indicator-projection')).toHaveCount(1)
  const box = await chart.boundingBox()
  await page.mouse.move(box!.x + box!.width * 0.8, box!.y + box!.height / 2)
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -150)
  await page.keyboard.up('Control')
  await expect.poll(async () => Number(await surface.getAttribute('data-visible-start'))).toBeGreaterThan(start)
  await page.mouse.move(box!.x + box!.width * 0.4, box!.y + box!.height * 0.5)
  await page.mouse.down()
  await page.mouse.move(box!.x + box!.width * 0.7, box!.y + box!.height * 0.5, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => Number(await surface.getAttribute('data-visible-end'))).toBeLessThan(end)
  await chart.press('0')
  await expect.poll(async () => Number(await surface.getAttribute('data-visible-end')) - Number(await surface.getAttribute('data-visible-start'))).toBe(80)
  const zoomOut = page.getByRole('button', { name: '缩小图表', exact: true })
  for (let i = 0; i < 8 && await zoomOut.isEnabled(); i++) await zoomOut.click()
  await expect(zoomOut).toBeDisabled()
  expect(Number(await surface.getAttribute('data-visible-end')) - Number(await surface.getAttribute('data-visible-start'))).toBeLessThanOrEqual(180)
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
