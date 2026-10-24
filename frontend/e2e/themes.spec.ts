import { expect, test } from './fixtures/test'
import { createPreviewData, loadPreviewSeries } from '../src/features/research/preview-data'
import { aggregateCandles } from '../src/features/chart/chart-math'
import type { ChartPeriod } from '../src/features/chart/chart-periods'

const sample = createPreviewData()
const routes = [
  ['research', '/?example=1'], ['overview', '/overview?symbol=600519'],
  ['levels', '/analysis/key-levels?symbol=600519'], ['patterns', '/analysis/patterns?symbol=600519'],
  ['future', '/analysis/future?symbol=600519'], ['ai', '/analysis/ai?symbol=600519'],
  ['chart', '/chart?symbol=600519'], ['library', '/knowledge?view=library'],
  ['notes', '/knowledge?view=notes'], ['samples', '/knowledge?view=samples'],
  ['evidence', '/knowledge?view=backtest'], ['rules', '/rules'],
  ['positions', '/trading/positions?symbol=600519'], ['ledger', '/trading/ledger?symbol=600519'],
  ['predictions', '/trading/predictions?symbol=600519'], ['statistics', '/trading/statistics?symbol=600519'],
  ['daily', '/review/daily'], ['trade', '/review/trade'], ['history', '/review/history'],
  ['backtest', '/review/backtest'], ['settings', '/settings'],
] as const

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url())
    if (url.pathname.startsWith('/api/sync/')) return route.fulfill({ json: { nextCursor: 0, changes: [], applied: true, cursor: 0 } })
    if (url.pathname.endsWith('/snapshot')) return route.fulfill({ json: sample.market })
    if (url.pathname.endsWith('/candles')) {
      const period = url.searchParams.get('period') as ChartPeriod
      const preview = await loadPreviewSeries('DEMO', period)
      return route.fulfill({ json: { ...preview, adjustment: url.searchParams.get('adjustment') ?? 'none', bars: period === 'day' ? aggregateCandles(sample.market.dailyCandles, period) : preview.bars } })
    }
    if (url.pathname.endsWith('/prediction')) return route.fulfill({ json: sample.prediction })
    return route.fulfill({ status: 503, json: { message: 'Isolated theme browser check' } })
  })
})

for (const theme of ['c', 'd'] as const) {
  test(`theme ${theme}: all pages, refresh and navigation`, async ({ page }, info) => {
    test.setTimeout(240_000)
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('/settings')
    await page.getByRole('button', { name: theme === 'c' ? /C · 清爽自然/ : /D · 深色科技/ }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    await page.reload()
    await expect(page.getByRole('button', { name: theme === 'c' ? /C · 清爽自然/ : /D · 深色科技/ })).toHaveAttribute('aria-pressed', 'true')
    for (const [name, path] of routes) {
      await page.goto(path)
      await expect(page.locator('main').first()).toBeVisible()
      await expect(page.locator('h1').first()).toBeVisible()
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      expect(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor)).toBe(theme === 'c' ? 'rgb(241, 245, 242)' : 'rgb(16, 25, 35)')
      if (theme === 'd') {
        const brightPanels = await page.locator('header, nav, main, section, article, aside').evaluateAll(elements => elements.filter(el => {
          const rect = el.getBoundingClientRect()
          if (rect.width < 100 || rect.height < 40 || !rect.width || !rect.height) return false
          const color = getComputedStyle(el).backgroundColor.match(/[\d.]+/g)?.map(Number) ?? []
          return color.length >= 3 && (color.length < 4 || color[3] > .7) && color.slice(0, 3).every(value => value > 220)
        }).map(el => el.className))
        expect(brightPanels, `${name} has bright panels in dark mode`).toEqual([])
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name} overflows`).toBe(true)
      await page.screenshot({ path: `artifacts/themes/${info.project.name}/${theme}-${name}.png` })
    }
    expect(errors).toEqual([])
  })
}

test('theme applies when preference storage is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    const getItem = Storage.prototype.getItem, setItem = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'stockcal-theme') throw new DOMException('Blocked', 'SecurityError')
      return setItem.call(this, key, value)
    }
    Storage.prototype.getItem = function (key) {
      if (key === 'stockcal-theme') throw new DOMException('Blocked', 'SecurityError')
      return getItem.call(this, key)
    }
  })
  await page.goto('/settings')
  await page.getByRole('button', { name: /D · 深色科技/ }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'd')
  await expect(page.getByRole('button', { name: /D · 深色科技/ })).toHaveAttribute('aria-pressed', 'true')
})

test('compact and landscape themes support keyboard and reduced motion', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/settings')
  for (const size of [{ width: 375, height: 812 }, { width: 812, height: 375 }]) {
    await page.setViewportSize(size)
    for (const theme of ['c', 'd']) {
      const button = page.getByRole('button', { name: theme === 'c' ? /C · 清爽自然/ : /D · 深色科技/ })
      await button.focus()
      await page.keyboard.press('Enter')
      await expect(button).toHaveAttribute('aria-pressed', 'true')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    }
    await page.screenshot({ path: `artifacts/themes/${info.project.name}/d-settings-${size.width}.png`, fullPage: true })
  }
})

test('blocked browser storage keeps settings and theme selection usable', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('Blocked', 'SecurityError') }
    Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'SecurityError') }
  })
  await page.goto('/settings')
  await expect(page.getByRole('button', { name: '登录同步', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /D · 深色科技/ }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'd')
  expect(errors).toEqual([])
})
