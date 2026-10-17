import { expect, test } from '@playwright/test'
test('one daily read renders before optional rules and keeps adjustment explicit', async ({ page }) => {
  const bars = Array.from({ length: 400 }, (_, i) => ({ day: new Date(Date.UTC(2024,0,i+1)).toISOString().slice(0,10), open: 1200+i, close: 1201+i, high: 1202+i, low: 1199+i, volume: 100 }))
  const source = { name: '独立测试行情', fetchedAt: '2026-10-18T00:00:00Z', state: 'TEST', online: true }
  let snapshots = 0, unusedPredictions = 0, rawReads = 0
  await page.route('**/api/knowledge/rules', route => new Promise<void>(() => { void route }))
  await page.route('**/api/market/stocks/*/prediction*', route => { unusedPredictions++; return route.fulfill({ status: 503, json: {} }) })
  await page.route('**/api/market/stocks/*/snapshot', route => { snapshots++; return route.fulfill({ json: { adjustment: 'qfq', quote: { security: { code: '600519', name: '贵州茅台' }, price: bars.at(-1)!.close }, dailyCandles: bars, source } }) })
  await page.route('**/api/market/stocks/*/candles?*', route => {
    const params = new URL(route.request().url()).searchParams
    const adjustment = params.get('adjustment')
    if (adjustment === 'none' && params.get('period') === 'day') rawReads++
    return route.fulfill({ json: { symbol: '600519', period: params.get('period'), adjustment, kind: 'candles', bars: bars.map(b => adjustment === 'none' ? { ...b, open: b.open+50, high: b.high+50, low: b.low+50, close: b.close+50 } : b), source, limitedHistory: false } })
  })
  await page.goto('/?symbol=600519')
  await expect(page.getByRole('img', { name: 'K线主图' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('combobox', { name: '价格复权方式' })).toHaveValue('qfq')
  const mean = bars.slice(-250).reduce((sum,b) => sum+b.close,0)/250
  await expect(page.locator('.sc-kline-legend')).toContainText(`MA250 ${mean.toFixed(2)}`)
  await page.getByRole('combobox', { name: '价格复权方式' }).selectOption('none')
  await expect(page.locator('.sc-kline-legend')).toContainText(`MA250 ${(mean+50).toFixed(2)}`)
  expect(snapshots).toBe(1)
  expect(unusedPredictions).toBe(0)
  expect(rawReads).toBe(1)
})
