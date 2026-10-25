import { expect, test } from './fixtures/test'
import { chooseBasis } from './fixtures/chart-workbench'
test('one daily read renders before optional rules and keeps adjustment explicit', async ({ page }) => {
  const bars = Array.from({ length: 400 }, (_, i) => ({ day: new Date(Date.UTC(2024,0,i+1)).toISOString().slice(0,10), open: 1200+i, close: 1201+i, high: 1202+i, low: 1199+i, volume: 100 }))
  const source = { name: '独立测试行情', fetchedAt: '2026-10-18T00:00:00Z', state: 'TEST', online: true }
  let snapshots = 0, unusedPredictions = 0, rawReads = 0
  await page.route('**/api/knowledge/rules', route => new Promise<void>(() => { void route }))
  await page.route('**/api/market/stocks/*/prediction*', route => { unusedPredictions++; return route.fulfill({ status: 503, json: {} }) })
  await page.route('**/api/market/stocks/600519/snapshot', route => { snapshots++; return route.fulfill({ json: { adjustment: 'qfq', quote: { security: { code: '600519', name: '贵州茅台' }, price: bars.at(-1)!.close }, dailyCandles: bars, source } }) })
  await page.route('**/api/market/stocks/*/candles?*', route => {
    const params = new URL(route.request().url()).searchParams
    const adjustment = params.get('adjustment')
    if (adjustment === 'none' && params.get('period') === 'day') rawReads++
    return route.fulfill({ json: { symbol: '600519', period: params.get('period'), adjustment, kind: 'candles', bars: bars.map(b => adjustment === 'none' ? { ...b, open: b.open+50, high: b.high+50, low: b.low+50, close: b.close+50 } : b), source, limitedHistory: false } })
  })
  await page.goto('/?symbol=600519')
  await expect(page.getByRole('img', { name: 'K线主图' })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: '图表设置', exact: true }).click()
  await expect(page.getByRole('combobox', { name: '价格复权方式' })).toHaveValue('qfq')
  await page.getByRole('button', { name: '关闭图表设置', exact: true }).click()
  await page.locator('.rs-workbench-legend summary').click()
  const mean = bars.slice(-250).reduce((sum,b) => sum+b.close,0)/250
  await expect(page.locator('.rs-workbench-legend')).toContainText(`MA250 ${mean.toFixed(2)}`)
  await chooseBasis(page, 'none')
  await expect(page.locator('.rs-workbench-legend')).toContainText(`MA250 ${(mean+50).toFixed(2)}`)
  expect(snapshots).toBe(1)
  expect(unusedPredictions).toBe(0)
  expect(rawReads).toBe(1)
})

test('cached history survives reload and stays visible when a forced update fails', async ({ page }) => {
  const bars = Array.from({ length: 400 }, (_, i) => ({ day: new Date(Date.UTC(2024, 0, i + 1)).toISOString().slice(0, 10), open: 100, high: 102, low: 99, close: 101, volume: 100 }))
  const source = { name: '缓存测试行情', fetchedAt: '2026-10-18T00:00:00Z', state: 'TEST', online: true }
  let snapshots = 0, fail = false
  await page.route('**/api/market/stocks/600519/snapshot', route => {
    snapshots++
    return fail ? route.abort('failed') : route.fulfill({ json: { adjustment: 'qfq', quote: { security: { code: '600519', name: '贵州茅台' }, price: 101 }, dailyCandles: bars, source } })
  })
  await page.route('**/api/market/stocks/*/candles?*', route => route.fulfill({ json: { symbol: '600519', period: new URL(route.request().url()).searchParams.get('period'), adjustment: 'none', kind: 'candles', bars, source, limitedHistory: false } }))
  await page.goto('/?symbol=600519')
  await expect(page.getByRole('img', { name: 'K线主图' })).toBeVisible({ timeout: 30000 })
  await expect(page.getByRole('button', { name: '刷新行情与预测' })).toBeEnabled()
  await page.reload()
  await expect(page.getByRole('img', { name: 'K线主图' })).toBeVisible({ timeout: 30000 })
  await expect(page.getByRole('button', { name: '刷新行情与预测' })).toBeEnabled()
  expect(snapshots).toBe(1)
  fail = true
  await page.getByRole('button', { name: '刷新行情与预测' }).click()
  await expect(page.getByRole('img', { name: 'K线主图' })).toBeVisible()
  await expect(page.locator('.rs-data-timestamps')).toContainText('更新失败 · 保留缓存')
  expect(snapshots).toBe(2)
})
