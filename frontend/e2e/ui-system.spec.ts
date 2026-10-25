import { expect, test } from './fixtures/test'
import { createPreviewData, loadPreviewSeries } from '../src/features/research/preview-data'
import { aggregateCandles } from '../src/features/chart/chart-math'
import type { ChartPeriod } from '../src/features/chart/chart-periods'

const routes = [
  ['research', '/?example=1'], ['overview', '/overview?symbol=600519'],
  ['analysis-levels', '/analysis/key-levels?symbol=600519'], ['analysis-patterns', '/analysis/patterns?symbol=600519'],
  ['analysis-future', '/analysis/future?symbol=600519'], ['analysis-ai', '/analysis/ai?symbol=600519'],
  ['chart', '/chart?symbol=600519'], ['knowledge', '/knowledge?view=library'],
  ['notes', '/knowledge?view=notes'], ['samples', '/knowledge?view=samples'], ['evidence', '/knowledge?view=backtest'],
  ['rules', '/rules'], ['positions', '/trading/positions?symbol=600519'], ['ledger', '/trading/ledger?symbol=600519'],
  ['predictions', '/trading/predictions?symbol=600519'], ['statistics', '/trading/statistics?symbol=600519'],
  ['review-daily', '/review/daily'], ['review-trade', '/review/trade'], ['review-history', '/review/history'],
  ['review-backtest', '/review/backtest'], ['settings', '/settings'],
] as const
const sample = createPreviewData()

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', route => {
    const request = route.request(), pathname = new URL(request.url()).pathname
    if (pathname.startsWith('/api/sync/')) return route.fulfill({ json: { nextCursor: 0, changes: [], applied: true, cursor: 0 } })
    if (!['GET', 'HEAD'].includes(request.method())) return route.fulfill({ status: 503, json: { message: 'Isolated UI check' } })
    return route.continue()
  })
  await page.route('**/api/market/stocks/*/snapshot', route => {
    const code = new URL(route.request().url()).pathname.split('/').at(-2)!
    return route.fulfill({ json: { ...sample.market, adjustment: 'qfq', quote: { ...sample.market.quote, security: { code, name: '贵州茅台', exchange: 'SH' } }, source: { ...sample.market.source, name: '浏览器测试行情', online: true } } })
  })
  await page.route('**/api/market/stocks/*/candles?*', async route => {
    const url = new URL(route.request().url()), symbol = url.pathname.split('/').at(-2)!
    const period = url.searchParams.get('period') as ChartPeriod
    const preview = await loadPreviewSeries('DEMO', period)
    return route.fulfill({ json: { ...preview, symbol, adjustment: url.searchParams.get('adjustment') ?? 'none', bars: period === 'day' ? aggregateCandles(sample.market.dailyCandles, period) : preview.bars } })
  })
  await page.route('**/api/market/stocks/*/prediction?*', route => route.fulfill({ json: { ...sample.prediction, symbol: new URL(route.request().url()).pathname.split('/').at(-2)! } }))
})

for (const [name, path] of routes) test(`UI ${name}: readable layout and bounded viewport`, async ({ page }, info) => {
  test.setTimeout(45000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(path)
  await expect(page.locator('main').first()).toBeVisible()
  await expect(page.locator('h1').first()).toBeVisible()
  if (name === 'knowledge') {
    await expect(page.getByRole('heading', { name: '笔记标签', exact: true, level: 1 })).toBeVisible()
    const nav = page.getByRole('navigation', { name: '研究工作台导航' })
    await expect(nav.getByRole('link', { name: '经验原则', exact: true })).toHaveCount(0)
    await expect(nav.getByRole('link', { name: '笔记标签', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(nav.getByRole('link')).toHaveCount(4)
  }
  if (name === 'notes') await expect(page.getByLabel('搜索笔记与标签', { exact: true })).toBeVisible()
  if (info.project.name === 'mobile' && ['research', 'knowledge', 'notes', 'samples', 'evidence'].includes(name)) {
    const nav = page.getByRole('navigation', { name: '研究工作台导航' })
    expect(await nav.evaluate(element => element.getBoundingClientRect().height)).toBeLessThan(60)
  }
  await page.screenshot({ path: `artifacts/ui-refresh/${process.env.UI_AUDIT_PHASE ?? 'after'}/${info.project.name}/${name}.png` })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  expect(errors).toEqual([])
})

test('login dialog validates, reports pending work and returns keyboard focus', async ({ page }, info) => {
  await page.route('**/api/auth/**', async route => {
    await new Promise(resolve => setTimeout(resolve, 700))
    return route.fulfill({ status: 503, json: { message: 'Isolated login failure' } })
  })
  await page.goto('/settings')
  const trigger = page.getByRole('button', { name: '登录同步', exact: true })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: '登录 StockCal' })
  await expect(dialog.getByLabel('手机号')).toBeFocused()
  await dialog.getByRole('button', { name: '获取验证码' }).click()
  await expect(dialog.getByRole('alert')).toContainText('11 位手机号')
  await dialog.getByLabel('手机号').fill('13800138000')
  await dialog.getByRole('button', { name: '获取验证码' }).click()
  await expect(dialog.getByRole('button', { name: '发送中…' })).toBeDisabled()
  await expect(dialog.getByRole('alert')).toContainText('发送失败')
  await dialog.screenshot({ path: `artifacts/ui-refresh/after/${info.project.name}/login-dialog.png` })
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('login uses the browser proxy and sign out clears both session tokens', async ({ page }) => {
  await page.route('**/api/auth/request-code', route => route.fulfill({ status: 204 }))
  await page.route('**/api/auth/verify', route => route.fulfill({ json: { accessToken: 'ui-test-access', refreshToken: 'ui-test-refresh', expiresAt: '2099-01-01T00:00:00Z' } }))
  await page.goto('/settings')
  await page.getByRole('button', { name: '登录同步', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '登录 StockCal' })
  await dialog.getByLabel('手机号').fill('13800138000')
  await dialog.getByRole('button', { name: '获取验证码' }).click()
  await expect(dialog.getByRole('status')).toContainText('验证码已发送')
  await dialog.getByLabel('验证码').fill('000000')
  await dialog.getByRole('button', { name: '确认登录' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: '退出登录' })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('stockcal.refreshToken'))).toBe('ui-test-refresh')
  await page.getByRole('button', { name: '退出登录' }).click()
  await expect(page.getByRole('button', { name: '登录同步', exact: true })).toBeVisible()
  expect(await page.evaluate(() => [localStorage.getItem('stockcal.accessToken'), localStorage.getItem('stockcal.refreshToken')])).toEqual([null, null])
})

test('search shortcut reaches the visible field and empty search has feedback', async ({ page }, info) => {
  await page.goto('/settings')
  await page.getByRole('button', { name: '登录同步', exact: true }).focus()
  await page.keyboard.press('Control+k')
  const input = info.project.name === 'mobile' ? page.getByRole('textbox', { name: '股票代码或名称', exact: true }) : page.getByRole('textbox', { name: '搜索股票', exact: true })
  await expect(input).toBeFocused()
  await input.press('Enter')
  await expect(page.getByRole('status').filter({ hasText: '请输入股票代码或名称' })).toBeVisible()
  if (info.project.name === 'mobile') {
    await input.press('Escape')
    await expect(input).toHaveCount(0)
    await expect(page.getByRole('button', { name: '搜索股票（移动端）' })).toBeFocused()
  }
})

test('trade modal preserves draft on close and fits the viewport', async ({ page }, info) => {
  await page.goto('/trading/ledger?symbol=600519')
  const dialog = page.getByRole('dialog', { name: '新增交易' })
  await expect(dialog.getByLabel('交易方向')).toBeFocused()
  await dialog.getByLabel('交易数量').fill('100')
  await dialog.screenshot({ path: `artifacts/ui-refresh/after/${info.project.name}/trade-dialog.png` })
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await page.getByRole('button', { name: '记录交易', exact: true }).click()
  await expect(dialog.getByLabel('交易数量')).toHaveValue('100')
  await dialog.getByRole('button', { name: '取消', exact: true }).focus()
  await page.keyboard.press('Tab')
  await expect(dialog.getByRole('button', { name: '关闭新增交易' })).toBeFocused()
})

test('knowledge filters reset and selected records stay readable', async ({ page }) => {
  await page.goto('/knowledge?view=notes')
  const search = page.getByLabel('搜索笔记与标签', { exact: true })
  await search.fill('没有这个笔记-UI-check')
  await expect(page.getByRole('button', { name: /^查看标签：/ })).toHaveCount(0)
  await page.getByRole('button', { name: '重置标签筛选' }).click()
  await expect(search).toHaveValue('')
  const first = page.getByRole('button', { name: /^查看标签：/ }).first()
  await first.click()
  await expect(first).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('region', { name: '标签详情', exact: true })).toBeVisible()
})
