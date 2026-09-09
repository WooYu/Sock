import { expect, test, type Page } from '@playwright/test'

const symbol = '600519'
type CandleFixture = { day: string; open: number; high: number; low: number; close: number; volume: number }

const predictionDays = [
  {
    day: '2026-08-31',
    open: 118.1,
    high: 121.4,
    low: 117.2,
    close: 120.8,
    rangeLow: 116.5,
    rangeHigh: 122.2,
    confidence: 0.71,
    ma5: 117.8,
    ma10: 116.9,
    ma20: 115.4,
    bollUpper: 122.7,
    bollMiddle: 116.3,
    bollLower: 109.9,
  },
  {
    day: '2026-09-01',
    open: 120.9,
    high: 124.6,
    low: 119.8,
    close: 123.7,
    rangeLow: 118.9,
    rangeHigh: 125.5,
    confidence: 0.82,
    ma5: 119.6,
    ma10: 117.8,
    ma20: 116.1,
    bollUpper: 124.9,
    bollMiddle: 117.2,
    bollLower: 109.5,
  },
  {
    day: '2026-09-02',
    open: 123.5,
    high: 126.8,
    low: 121.7,
    close: 125.9,
    rangeLow: 120.6,
    rangeHigh: 127.4,
    confidence: 0.93,
    ma5: 121.7,
    ma10: 118.9,
    ma20: 116.8,
    bollUpper: 127.1,
    bollMiddle: 118.4,
    bollLower: 109.7,
  },
] as const

function weekdayCandles(): CandleFixture[] {
  const candles: CandleFixture[] = []
  const date = new Date(Date.UTC(2026, 6, 6))
  while (candles.length < 40) {
    const weekday = date.getUTCDay()
    if (weekday !== 0 && weekday !== 6) {
      const index = candles.length
      const open = 101 + index * 0.4 + (index % 3) * 0.15
      const close = open + (index % 2 === 0 ? 0.85 : -0.35)
      candles.push({
        day: date.toISOString().slice(0, 10),
        open,
        high: Math.max(open, close) + 1.1,
        low: Math.min(open, close) - 0.9,
        close,
        volume: 1_000_000 + index * 12_500,
      })
    }
    date.setUTCDate(date.getUTCDate() + 1)
  }
  return candles
}

async function mockChartApi(page: Page) {
  const candles = weekdayCandles()
  await page.route('**/api/market/stocks/*/snapshot', (route) => {
    const requestedSymbol = new URL(route.request().url()).pathname.split('/').at(-2) ?? symbol
    return route.fulfill({ json: {
      quote: {
        security: { code: requestedSymbol, name: requestedSymbol === symbol ? '贵州茅台' : '测试股票', exchange: 'SH' },
        price: candles.at(-1)!.close,
        previousClose: candles.at(-2)!.close,
        open: candles.at(-1)!.open,
        high: candles.at(-1)!.high,
        low: candles.at(-1)!.low,
        volume: candles.at(-1)!.volume,
      },
      dailyCandles: candles,
      source: {
        name: 'TEST',
        fetchedAt: '2026-08-28T07:00:00.000Z',
        state: 'READY',
        online: true,
      },
    } })
  })
  await page.route('**/api/market/stocks/*/prediction?*', (route) => {
    const requestedSymbol = new URL(route.request().url()).pathname.split('/').at(-2) ?? symbol
    return route.fulfill({ json: {
      symbol: requestedSymbol,
      period: 'day',
      generatedAt: '2026-08-28T07:01:00.000Z',
      modelVersion: 'test-e2e-v1',
      days: predictionDays,
    } })
  })
  await page.route('**/api/knowledge/rules', (route) => route.fulfill({ json: [] }))
}

async function openHorizontalLineTool(page: Page, toolbarLabel: string) {
  const toolbar = page.getByLabel(toolbarLabel)
  const line = toolbar.getByRole('button', { name: '水平线', exact: true })
  if (await line.isVisible()) {
    await line.click()
    return
  }

  await toolbar.locator('summary[aria-label="更多绘图工具"]').click()
  await line.click()
}

async function clickRenderedDrawingLine(page: Page) {
  const point = await page.getByTestId('drawing-visible-line').evaluate((element) => {
    const line = element as SVGLineElement
    const matrix = line.getScreenCTM()
    const svg = line.ownerSVGElement
    if (!matrix || !svg) throw new Error('Drawing line has no rendered SVG transform')
    const midpoint = svg.createSVGPoint()
    midpoint.x = (line.x1.baseVal.value + line.x2.baseVal.value) / 2
    midpoint.y = (line.y1.baseVal.value + line.y2.baseVal.value) / 2
    const screenPoint = midpoint.matrixTransform(matrix)
    return { x: screenPoint.x, y: screenPoint.y }
  })
  await page.mouse.click(point.x, point.y)
}

test.describe('unified workspace redesign', () => {
  test.beforeEach(async ({ page }) => {
    await mockChartApi(page)
  })

  test('keeps the unified five-workspace shell on desktop', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Desktop navigation is intentionally hidden on mobile')
    await page.goto('/overview')

    await expect(page.getByTestId('app-shell')).toHaveClass(/sc-shell-unified/)
    const navigation = page.getByTestId('desktop-primary-nav')
    await expect(navigation).toBeVisible()
    await expect(navigation.getByRole('link')).toHaveCount(5)
    await expect(navigation.getByRole('link', { name: '首页' })).toBeVisible()
    await expect(navigation.getByRole('link', { name: '设置' })).toBeVisible()

    await page.goto('/analysis/key-levels?symbol=002475')
    await expect(page.getByRole('region', { name: '规则结论' })).toBeVisible()
  })

  test('keeps rules and review usable at a phone viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/rules')
    await expect(page.getByRole('searchbox', { name: '搜索规则' })).toBeVisible()
    await expect(page.getByTestId('mobile-primary-nav').getByRole('link')).toHaveCount(5)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)

    await page.goto('/review/daily')
    await expect(page.getByLabel('市场判断')).toBeVisible()
    await expect(page.getByLabel('执行情况')).toBeVisible()
    await expect(page.getByLabel('改进点')).toBeVisible()
    await expect(page.getByRole('button', { name: '保存复盘' })).toBeVisible()
  })

  test('edits, persists, deletes, restores, and isolates a drawing while linking prediction selection', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Desktop editor workflow')
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.goto(`/chart?symbol=${symbol}`)

    await expect(page.getByText('数据源：TEST')).toBeVisible()
    const predictionCandles = page.getByTestId('prediction-candle')
    await expect(predictionCandles).toHaveCount(3)
    const desktopPredictionDetails = page.locator('.sc-prediction-desktop-table')
    await expect(desktopPredictionDetails.getByRole('table', { name: '未来三日推演详情' })).toBeVisible()
    await expect(desktopPredictionDetails.getByText('test-e2e-v1', { exact: true })).toBeVisible()
    await expect(desktopPredictionDetails.getByText('2026-08-28T07:01:00.000Z', { exact: true })).toBeVisible()
    await expect(desktopPredictionDetails.getByText('推演数据，不是实际行情', { exact: true })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('chart-desktop.png') })

    await openHorizontalLineTool(page, '桌面绘图工具')
    await page.getByRole('img', { name: 'K线主图' }).click({ position: { x: 500, y: 180 } })
    await expect(page.getByTestId('annotation-horizontal-line')).toHaveCount(1)

    const inspector = page.getByRole('region', { name: '对象属性' })
    const price = inspector.getByLabel('控制点 1 价格')
    await expect(price).toBeVisible()
    await price.fill('118.25')
    await expect(price).toHaveValue('118.25')

    await page.reload()
    await expect(page.getByText('数据源：TEST')).toBeVisible()
    await expect(page.getByTestId('annotation-horizontal-line')).toHaveCount(1)
    await expect(page.getByTestId('drawing-price-label')).toHaveText('118.25')
    await clickRenderedDrawingLine(page)
    await expect(page.getByRole('region', { name: '对象属性' }).getByLabel('控制点 1 价格')).toHaveValue('118.25')

    const storedPointBeforeViewChanges = await page.evaluate(() => {
      const raw = localStorage.getItem('stockcal:chart-workspace:600519:day')
      return raw ? JSON.parse(raw).drawings[0]?.points[0] : null
    })
    const desktopTools = page.getByLabel('桌面绘图工具')
    await page.getByRole('button', { name: '放大', exact: true }).click()
    await desktopTools.locator('button[data-tool="pan"]').click()
    const chartBox = await page.getByRole('img', { name: 'K线主图' }).boundingBox()
    expect(chartBox).not.toBeNull()
    await page.mouse.move(chartBox!.x + 600, chartBox!.y + 180)
    await page.mouse.down()
    await page.mouse.move(chartBox!.x + 640, chartBox!.y + 180)
    await page.mouse.up()
    await page.setViewportSize({ width: 1180, height: 820 })
    const storedPointAfterViewChanges = await page.evaluate(() => {
      const raw = localStorage.getItem('stockcal:chart-workspace:600519:day')
      return raw ? JSON.parse(raw).drawings[0]?.points[0] : null
    })
    expect(storedPointAfterViewChanges).toEqual(storedPointBeforeViewChanges)

    page.once('dialog', (dialog) => dialog.dismiss())
    await page.getByRole('region', { name: '对象属性' }).getByRole('button', { name: '删除对象' }).click()
    await expect(page.getByTestId('annotation-horizontal-line')).toHaveCount(1)

    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('region', { name: '对象属性' }).getByRole('button', { name: '删除对象' }).click()
    await expect(page.getByTestId('annotation-horizontal-line')).toHaveCount(0)
    await page.getByRole('button', { name: '撤销', exact: true }).click()
    await expect(page.getByTestId('annotation-horizontal-line')).toHaveCount(1)

    const details = page.getByRole('table', { name: '未来三日推演详情' })
    await details.getByRole('button', { name: /第2日/ }).click()
    await expect(predictionCandles.nth(1)).toHaveAttribute('data-active', 'true')
    await predictionCandles.nth(2).focus()
    await predictionCandles.nth(2).press('Enter')
    await expect(details.getByRole('button', { name: /第3日/ })).toHaveAttribute('aria-pressed', 'true')

    await page.getByRole('tab', { name: '周线' }).click()
    await expect(page.getByTestId('annotation-horizontal-line')).toHaveCount(0)
    await page.getByRole('tab', { name: '日线' }).click()
    await expect(page.getByTestId('annotation-horizontal-line')).toHaveCount(1)

    const persistedPoint = await page.evaluate(() => {
      const raw = localStorage.getItem('stockcal:chart-workspace:600519:day')
      return raw ? JSON.parse(raw).drawings[0]?.points[0] : null
    })
    expect(persistedPoint).toMatchObject({ price: 118.25 })
    expect(persistedPoint).toHaveProperty('time')
    expect(persistedPoint).not.toHaveProperty('x')
    expect(persistedPoint).not.toHaveProperty('y')
    expect(pageErrors).toEqual([])
  })

  test('uses the mobile prediction and object sheets without covering fixed navigation', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'Mobile editor workflow')
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.goto(`/chart?symbol=${symbol}`)

    await expect(page.getByText('数据源：TEST')).toBeVisible()
    const mobilePredictionCandles = page.getByTestId('prediction-candle')
    await expect(mobilePredictionCandles).toHaveCount(3)
    const forecastBox = await mobilePredictionCandles.nth(2).boundingBox()
    const chartViewportBox = await page.locator('.sc-kline-chart-scroll').boundingBox()
    expect(forecastBox).not.toBeNull()
    expect(chartViewportBox).not.toBeNull()
    expect(forecastBox!.x + forecastBox!.width).toBeGreaterThan(chartViewportBox!.x)
    expect(forecastBox!.x).toBeLessThan(chartViewportBox!.x + chartViewportBox!.width)
    const actions = page.getByTestId('chart-mobile-toolbar')
    await expect(actions).toBeVisible()
    await expect(actions.getByRole('button')).toHaveCount(5)
    for (const name of ['选择', '趋势线', '水平线', '标记', '更多']) {
      await expect(actions.getByRole('button', { name, exact: true })).toBeVisible()
    }

    const mobileContext = page.locator('.sc-chart-mobile-context')
    await mobileContext.getByRole('button', { name: '预测详情' }).click()
    const predictionSheet = page.getByRole('dialog', { name: '预测详情' })
    await expect(predictionSheet).toBeVisible()
    await expect(predictionSheet.getByText('test-e2e-v1', { exact: true })).toBeVisible()
    await expect(predictionSheet.getByText('2026-08-28T07:01:00.000Z', { exact: true })).toBeVisible()
    await expect(predictionSheet.getByText('推演数据，不是实际行情', { exact: true })).toBeVisible()
    const expectedCloses = ['120.80', '123.70', '125.90']
    for (let index = 0; index < predictionDays.length; index += 1) {
      await predictionSheet.getByRole('tab', { name: new RegExp(`第${index + 1}日`) }).click()
      await expect(predictionSheet.getByText(expectedCloses[index], { exact: true })).toBeVisible()
    }
    await page.screenshot({ path: testInfo.outputPath('chart-mobile-prediction.png') })

    const selectedValue = predictionSheet.getByText(expectedCloses[2], { exact: true })
    await expect(selectedValue).toBeVisible()
    const selectedValueBox = await selectedValue.boundingBox()
    const actionsBox = await actions.boundingBox()
    expect(selectedValueBox).not.toBeNull()
    expect(actionsBox).not.toBeNull()
    const predictionOverlap = selectedValueBox!.x < actionsBox!.x + actionsBox!.width
      && selectedValueBox!.x + selectedValueBox!.width > actionsBox!.x
      && selectedValueBox!.y < actionsBox!.y + actionsBox!.height
      && selectedValueBox!.y + selectedValueBox!.height > actionsBox!.y
    expect(predictionOverlap).toBe(false)
    await page.keyboard.press('Escape')
    await expect(predictionSheet).toBeHidden()

    await actions.getByRole('button', { name: '水平线', exact: true }).click()
    await page.getByRole('img', { name: 'K线主图' }).click({ position: { x: 280, y: 180 } })
    await expect(page.getByTestId('annotation-horizontal-line')).toHaveCount(1)
    await mobileContext.getByRole('button', { name: '对象属性' }).click()
    const objectSheet = page.getByRole('dialog', { name: '对象属性' })
    await expect(objectSheet).toBeVisible()
    await expect(objectSheet.getByLabel('控制点 1 价格')).toBeVisible()

    const layout = await page.evaluate(() => {
      const actionBar = document.querySelector('[data-testid="chart-mobile-toolbar"]')?.getBoundingClientRect()
      const primaryNav = document.querySelector('[data-testid="mobile-primary-nav"]')?.getBoundingClientRect()
      return {
        noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
        actionBarAboveNav: Boolean(actionBar && primaryNav && actionBar.bottom <= primaryNav.top + 1),
      }
    })
    expect(layout.noHorizontalOverflow).toBe(true)
    expect(layout.actionBarAboveNav).toBe(true)
    expect(pageErrors).toEqual([])
    await page.keyboard.press('Escape')
    await expect(objectSheet).toBeHidden()
    await page.locator('.sc-kline-chart-panel').scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath('chart-mobile.png') })
  })

  for (const route of ['/overview', '/analysis/key-levels?symbol=002475', `/chart?symbol=${symbol}`, '/rules', '/trading/positions', '/review/daily', '/settings']) {
    test(`does not overflow at 390px: ${route}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto(route)
      await expect(page.getByTestId('mobile-primary-nav')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
      const smallestPrimaryTarget = await page.getByTestId('mobile-primary-nav').getByRole('link').evaluateAll((links) => Math.min(...links.map((link) => link.getBoundingClientRect().height)))
      expect(smallestPrimaryTarget).toBeGreaterThanOrEqual(44)
    })
  }
})
