import { expect, test, type Page } from './fixtures/test'
import { openResearch } from './fixtures/chart-workbench'
import fixture from './fixtures/scenario-series.json'
import { loadPreviewSeries } from '../src/features/research/preview-data'

async function installScenarioApi(page: Page, fail30m = false) {
  await page.clock.setFixedTime(new Date('2026-09-22T08:00:00Z'))
  const source = { name: '合成浏览器验收行情', fetchedAt: '2026-09-22T08:00:00Z', online: true, state: 'TEST' }
  await page.route('**/api/market/stocks/*/candles?*', async route => {
    const url = new URL(route.request().url()), symbol = url.pathname.split('/').at(-2)!
    const period = url.searchParams.get('period') as 'day' | '60m' | '30m'
    if (fail30m && period === '30m') return route.fulfill({ status: 503, json: { message: '30分钟暂缺' } })
    return route.fulfill({ json: { symbol, period, adjustment: 'none', kind: 'candles', bars: fixture[period] ?? (await loadPreviewSeries('DEMO', period)).bars, source, limitedHistory: false } })
  })
  await page.route('**/api/market/stocks/*/snapshot', route => {
    const symbol = new URL(route.request().url()).pathname.split('/').at(-2)!
    return route.fulfill({ json: { quote: { security: { code: symbol, name: symbol === '603533' ? '掌阅科技' : '平安银行', exchange: 'SH' }, price: 11, previousClose: 10, open: 10, high: 11.2, low: 9.8, volume: 1000 }, dailyCandles: fixture.day, source } })
  })
  await page.route('**/api/market/stocks/*/prediction?*', route => route.fulfill({ status: 503, json: { message: '本测试核对情景参数' } }))
  await page.route('**/api/knowledge/rules', route => route.fulfill({ json: [] }))
  await page.route('**/api/market/search?*', route => route.fulfill({ json: [{ code: '000001', name: '平安银行', exchange: 'SZ' }] }))
}
test.describe('multi-period scenario analysis', () => {
  test('merges_three_periods_within_one_percent_to_the_mean_and_reloads_the_frozen_summary', async ({ page }, info) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => {
      if (!['error', 'warning'].includes(message.type())) return
      // Isolated saves retain the snapshot locally; cloud retry/export is tested separately.
      if (message.text().includes('503') && (message.location().url.includes('/prediction?') || message.location().url.endsWith('/api/scenario-records'))) return
      errors.push(message.text())
    })
    await installScenarioApi(page)
    await page.route('**/api/market/stocks/*/candles?*', async route => {
      const url = new URL(route.request().url()), period = url.searchParams.get('period') as 'day' | '60m' | '30m'
      const close = period === 'day' ? 10 : period === '60m' ? 10.01 : 10.08
      await route.fulfill({ json: { symbol: '603533', period, adjustment: 'none', kind: 'candles', limitedHistory: false,
        bars: (fixture[period] ?? (await loadPreviewSeries('DEMO', period)).bars).map(bar => ({ ...bar, open: close, close, low: close - 0.1, high: close + 0.1 })),
        source: { name: '合成1%平均价验收', fetchedAt: '2026-09-22T08:00:00Z', online: true, state: 'TEST' } } })
    })
    await page.route('**/api/market/stocks/*/snapshot', route => route.fulfill({ json: { quote: { security: { code: '603533', name: '掌阅科技', exchange: 'SH' }, price: 10, previousClose: 10 }, dailyCandles: fixture.day.map(bar => ({ ...bar, open: 10, close: 10, low: 9.9, high: 10.1 })), source: { name: '合成1%平均价验收', fetchedAt: '2026-09-22T08:00:00Z', online: true, state: 'TEST' } } }))
    await page.goto('/?symbol=603533', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveTitle(/StockCal/)
    await openResearch(page)
    await page.getByRole('tab', { name: '多周期分析', exact: true }).click()

    await page.getByRole('button', { name: '开始多周期分析' }).click()
    const panel = page.getByRole('region', { name: '多周期情景分析', exact: true })
    const summary = panel.getByRole('region', { name: '跨周期综合结果', exact: true })
    await expect(summary).toContainText('本次采用：日线')
    await expect(summary.getByRole('button', { name: '汇总三个周期' })).toHaveCount(0)
    await panel.getByRole('button', { name: '看1小时' }).click()
    await expect(panel.getByRole('table', { name: '1小时 MA/BOLL参考位' })).toBeVisible()
    await panel.getByRole('button', { name: '继续看30分钟' }).click()
    await expect(summary).toContainText('本次采用：日线 / 1小时 / 30分钟')
    await expect(summary.getByRole('article', { name: /^上方参考价/ })).toHaveCount(1)
    await expect(summary.getByRole('article', { name: /^下方参考价/ })).toHaveCount(0)
    await expect(summary.getByRole('article', { name: '上方参考价1', exact: true })).toContainText('10.03')
    await expect(summary.getByRole('article', { name: '上方参考价1', exact: true })).toContainText('+0.30%')
    await expect(summary.getByLabel('每侧价位数', { exact: true })).toHaveCount(0)
    await expect(summary).not.toContainText('等分补位')
    await summary.getByLabel('单日涨跌幅规则', { exact: true }).selectOption('0.2')
    await expect(summary.getByRole('article', { name: /^上方参考价/ })).toHaveCount(1)
    await expect(summary).toContainText('8.00～12.00')
    await summary.getByText('查看全部原始合并价位 · 1组', { exact: true }).click()
    const originalGroup = summary.getByRole('article', { name: '综合参考价组1', exact: true })
    await expect(originalGroup).toContainText('10.03')
    await expect(originalGroup).toContainText('54个参考位')
    await summary.getByText('查看原始价位与来源', { exact: true }).click()
    await expect(summary.getByRole('listitem')).toHaveCount(54)
    await expect(summary.getByRole('list')).toContainText('30分钟 MA5 · 未来第3根')
    await summary.getByText('查看原始价位与来源', { exact: true }).click()
    await summary.getByText('查看全部原始合并价位 · 1组', { exact: true }).click()
    await panel.getByLabel('计算方法', { exact: true }).selectOption('rolling_close')
    await expect(summary).toContainText('收盘情景滚动重算')
    await expect(panel.getByText('笔记来源已加载')).toBeVisible()
    await panel.getByRole('button', { name: '保存分析快照' }).click()
    await expect(panel.getByText('已保存分析版本1')).toBeVisible()
    const downloadEvent = page.waitForEvent('download')
    await panel.getByRole('button', { name: '导出分析与历史' }).click()
    const file = '/tmp/stockcal-price-summary-' + info.project.name + '.json'
    await (await downloadEvent).saveAs(file)
    const { readFile } = await import('node:fs/promises')
    const exported = JSON.parse(await readFile(file, 'utf8')).records[0]
    expect(exported.consolidation).toMatchObject({ tolerance: 0.01, aggregation: 'arithmetic_mean', method: 'rolling_close' })
    expect(exported.mergedLevels).toHaveLength(1)
    expect(exported.mergedLevels[0].value).toBeCloseTo(10.03, 10)
    expect(exported.dailyPriceLadder).toMatchObject({ definitionVersion: 'daily-close-levels-v2', selection: { limit: { source: 'manual', ratio: 0.2 } },
      anchor: { close: 10 }, band: { lower: 8, upper: 12 } })
    expect(exported.dailyPriceLadder.selection).not.toHaveProperty('count')
    expect(exported.dailyPriceLadder.up).toHaveLength(1)
    expect(exported.dailyPriceLadder.down).toHaveLength(0)
    for (const level of [...exported.dailyPriceLadder.up, ...exported.dailyPriceLadder.down]) {
      expect(level.value).toBeGreaterThanOrEqual(8); expect(level.value).toBeLessThanOrEqual(12)
      expect(level.changeRatio).toBeCloseTo(level.value / 10 - 1)
    }
    await page.reload()
    await openResearch(page)
    await page.getByRole('tab', { name: '多周期分析', exact: true }).click()

    await page.getByRole('button', { name: '开始多周期分析' }).click()
    await panel.getByText('分析历史 · 1个版本', { exact: true }).click()
    await panel.getByRole('button', { name: '查看分析版本1' }).click()
    await expect(summary).toContainText('本次采用：日线 / 1小时 / 30分钟')
    await expect(summary.getByRole('article', { name: '上方参考价1', exact: true })).toContainText('10.03')
    await expect(summary.getByLabel('每侧价位数', { exact: true })).toHaveCount(0)
    await expect(summary.getByLabel('单日涨跌幅规则', { exact: true })).toBeDisabled()
    await expect(summary.getByLabel('单日涨跌幅规则', { exact: true })).toHaveValue('0.2')
    await expect(panel.getByLabel('计算方法', { exact: true })).toBeDisabled()
    await expect(panel.getByLabel('计算方法', { exact: true })).toHaveValue('rolling_close')
    await summary.evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }))
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await expect(page.locator('nextjs-portal').getByText(/Runtime Error|Build Error|Application error/)).toHaveCount(0)
    expect(errors).toEqual([])
    await page.screenshot({ path: '/tmp/stockcal-price-summary-' + info.project.name + '.png', fullPage: false })
    await summary.locator('.sa-daily-ladder').screenshot({ path: '/tmp/stockcal-daily-ladder-' + info.project.name + '.png' })
  })
  test('requires_a_rule_for_special_status_and_keeps_out_of_band_prices_out_of_the_ladder', async ({ page }) => {
    await installScenarioApi(page)
    const source = { name: '特殊状态合成验收', fetchedAt: '2026-09-22T08:00:00Z', online: true, state: 'TEST' }
    await page.route('**/api/market/stocks/*/snapshot', route => route.fulfill({ json: {
      quote: { security: { code: '603533', name: '*ST样例', exchange: 'SH' }, price: 10, previousClose: 10 }, dailyCandles: fixture.day.map(bar => ({ ...bar, open: 10, close: 10, low: 9.9, high: 10.1 })), source,
    } }))
    await page.route('**/api/market/stocks/*/candles?*', async route => {
      const period = new URL(route.request().url()).searchParams.get('period') as 'day' | '60m' | '30m'
      const close = period === 'day' ? 10 : 15
      return route.fulfill({ json: { symbol: '603533', period, adjustment: 'none', kind: 'candles', limitedHistory: false, source,
        bars: (fixture[period] ?? (await loadPreviewSeries('DEMO', period)).bars).map(bar => ({ ...bar, open: close, close, low: close - 0.1, high: close + 0.1 })) } })
    })
    await page.goto('/?symbol=603533', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: '*ST样例', exact: true })).toBeVisible()
    await openResearch(page)
    await page.getByRole('tab', { name: '多周期分析', exact: true }).click()

    await page.getByRole('button', { name: '开始多周期分析' }).click()
    const summary = page.getByRole('region', { name: '跨周期综合结果', exact: true })
    await expect(summary).toContainText('请选择适用的涨跌幅规则')
    await expect(summary.getByRole('article', { name: /^上方参考价/ })).toHaveCount(0)
    await page.getByRole('button', { name: '看1小时' }).click()
    await expect(page.getByRole('table', { name: '1小时 MA/BOLL参考位' })).toBeVisible()
    await summary.getByLabel('单日涨跌幅规则', { exact: true }).selectOption('0.05')
    await expect(summary).toContainText('9.50～10.50')
    await expect(summary).toContainText('1组原始合并价超出单日区间')
    await expect(summary.getByRole('article', { name: /^上方参考价/ })).toHaveCount(0)
    await expect(summary.getByRole('article', { name: /^下方参考价/ })).toHaveCount(0)
    await expect(summary).toContainText('本侧暂无范围内的计算价位')
    await summary.getByLabel('单日涨跌幅规则', { exact: true }).selectOption('unverified')
    await expect(summary.getByRole('article', { name: /^上方参考价/ })).toHaveCount(0)
  })
  test('clear_daily_stops_then_allows_one_hour_check_and_saves_immutable_evidence', async ({ page }, info) => {
    const errors: string[] = []
    const requestedPeriods: string[] = []
    page.on('request', request => { const url = new URL(request.url()); if (url.pathname.endsWith('/candles')) requestedPeriods.push(url.searchParams.get('period') ?? '') })
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => {
      if (!['error', 'warning'].includes(message.type())) return
      // Prediction and cloud writes are intentionally unavailable in this local-save fixture.
      if (message.text().includes('503') && (message.location().url.includes('/prediction?') || message.location().url.endsWith('/api/scenario-records'))) return
      errors.push(message.text())
    })
    await installScenarioApi(page)
    await page.goto('/?symbol=603533', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveTitle(/StockCal/)
    await openResearch(page)
    await page.getByRole('tab', { name: '多周期分析', exact: true }).click()

    await page.getByRole('button', { name: '开始多周期分析' }).click()
    const panel = page.getByRole('region', { name: '多周期情景分析', exact: true })
    await expect(panel).toBeVisible()
    await panel.scrollIntoViewIfNeeded()
    await expect(panel.getByText('笔记来源已加载')).toBeVisible()
    await expect(panel.getByRole('region', { name: '跨周期综合结果' })).toContainText('本次采用：日线')
    expect(requestedPeriods).toContain('60m') // Main forecast now precomputes unclear lower periods automatically.
    await panel.getByRole('button', { name: '核对形态与模式' }).click()
    await panel.getByLabel('趋势方向', { exact: true }).selectOption('rising')
    await panel.getByLabel('上涨形态', { exact: true }).selectOption('climbing')
    await panel.getByLabel('持仓状态', { exact: true }).selectOption('held')
    await panel.getByLabel('葛起点', { exact: true }).selectOption(fixture.day.at(-1)!.day)
    await panel.getByLabel('确认日线大阳线', { exact: true }).check()
    await panel.getByLabel('确认依据', { exact: true }).fill('固定合成案例：确认日线趋势与起点，核对多周期计算。')
    await panel.getByRole('button', { name: '保存本次人工确认' }).click()
    await expect(panel.getByText('人工确认已记录')).toBeVisible()
    await expect(panel.getByLabel('计算方法', { exact: true })).toHaveValue('rolling_close')
    await expect(panel.getByRole('region', { name: '周期判断与停止' })).toContainText('日线规律已确认')
    await expect(panel.getByRole('button', { name: '继续看30分钟' })).toBeDisabled()
    expect(requestedPeriods).toContain('60m') // Main forecast now precomputes unclear lower periods automatically.
    await panel.getByRole('button', { name: '看1小时' }).click()
    await expect(page.getByLabel('更多K线周期', { exact: true })).toHaveValue('60m')
    await expect(panel.getByRole('table', { name: '1小时 MA/BOLL参考位' })).toBeVisible()
    await panel.getByLabel('趋势方向', { exact: true }).selectOption('rising')
    await panel.getByLabel('上涨形态', { exact: true }).selectOption('climbing')
    await panel.getByLabel('确认依据', { exact: true }).fill('人工确认小时趋势，日线模式与底线继续保留。')
    await panel.getByRole('button', { name: '保存本次人工确认' }).click()
    await expect(panel.getByRole('region', { name: '交易原则与风险参考' })).toContainText('1小时 MA5')
    await expect(panel.getByRole('button', { name: '继续看30分钟' })).toBeDisabled()
    expect(requestedPeriods).toContain('60m') // Manual snapshot scope remains independent of automatic requests.
    await panel.getByRole('heading', { name: '按需逐级分析', exact: true }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: '/tmp/stockcal-scenario-' + info.project.name + '-states.png', fullPage: false })
    const risk = panel.getByRole('region', { name: '交易原则与风险参考' })
    await expect(risk).toContainText('日线 MA5')
    await expect(risk).toContainText('10.20')
    await panel.getByRole('button', { name: '保存分析快照' }).click()
    await expect(panel.getByText('已保存分析版本1')).toBeVisible()
    await page.reload()
    await openResearch(page)
    await page.getByRole('tab', { name: '多周期分析', exact: true }).click()

    await page.getByRole('button', { name: '开始多周期分析' }).click()
    await panel.scrollIntoViewIfNeeded()
    await panel.getByText('分析历史 · 1个版本', { exact: true }).click()
    await panel.getByRole('button', { name: '查看分析版本1' }).click()
    await expect(panel.getByText(/历史快照，只读/)).toBeVisible()
    await risk.getByText(/本次采用与忽略的笔记/).click()
    await risk.getByText(/已采用 · 攀升中的已选日线底线/).click()
    await expect(risk.getByRole('link', { name: /查看笔记原文/ }).first()).toHaveAttribute('href', /github\.com\/WooYu\/Sock\/blob\//)
    const downloadEvent = page.waitForEvent('download')
    await panel.getByRole('button', { name: '导出分析与历史' }).click()
    const download = await downloadEvent
    const artifact = '/tmp/stockcal-scenario-' + info.project.name + '.json'
    await download.saveAs(artifact)
    const { readFile } = await import('node:fs/promises')
    const exported = JSON.parse(await readFile(artifact, 'utf8'))
    expect(exported.records[0].input.symbol).toBe('603533')
    expect(exported.records[0].input.periods['30m']).toBeUndefined()
    expect(exported.records[0].annotations.periodSelections.day.bottom.period).toBe('day')
    expect(exported.records[0].annotations.periodSelections['60m'].bottom.period).toBe('60m')
    expect(exported.records[0].scenarios.length).toBeGreaterThan(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    expect(errors).toEqual([])
    await expect(page.locator('nextjs-portal').getByText(/Runtime Error|Build Error|Application error/)).toHaveCount(0)
    await panel.scrollIntoViewIfNeeded()
    await page.screenshot({ path: '/tmp/stockcal-scenario-' + info.project.name + '.png', fullPage: false })
  })
  test('failed_30m_keeps_day_and_hour_evidence', async ({ page }) => {
    await installScenarioApi(page, true)
    await page.goto('/?symbol=603533', { waitUntil: 'domcontentloaded' })
    await openResearch(page)
    await page.getByRole('tab', { name: '多周期分析', exact: true }).click()

    await page.getByRole('button', { name: '开始多周期分析' }).click()
    const panel = page.getByRole('region', { name: '多周期情景分析', exact: true })
    await panel.scrollIntoViewIfNeeded()
    await expect(panel.getByText('笔记来源已加载')).toBeVisible()
    await panel.getByRole('button', { name: '看1小时' }).click()
    await expect(panel.getByRole('table', { name: '1小时 MA/BOLL参考位' })).toBeVisible()
    await panel.getByRole('button', { name: '继续看30分钟' }).click()
    await expect(panel.getByRole('button', { name: '重试30分钟' })).toBeVisible()
    await expect(panel.getByRole('region', { name: '日线状态' })).toContainText('10.20')
    await expect(panel.getByRole('region', { name: '1小时状态' })).toContainText('10.20')
    await expect(panel.getByRole('region', { name: '跨周期综合结果' })).toContainText('本次采用：日线 / 1小时')
    await expect(panel.getByRole('region', { name: '跨周期综合结果' })).toContainText('30分钟读取失败或数据不足')
  })
  test('switching_stock_rejects_late_old_stock_series', async ({ page }, info) => {
    await installScenarioApi(page)
    let release!: () => void, started!: () => void
    const pending = new Promise<void>(resolve => { release = resolve })
    const requested = new Promise<void>(resolve => { started = resolve })
    await page.route('**/api/market/stocks/603533/candles?*', async route => {
      if (new URL(route.request().url()).searchParams.get('period') !== '60m') return route.fallback()
      started(); await pending
      try { await route.fulfill({ json: { symbol: '603533', period: '60m', adjustment: 'none', kind: 'candles', bars: fixture['60m'], source: { name: '旧股票延迟响应', fetchedAt: '2026-09-22T08:00:00Z', online: true, state: 'TEST' } } }) } catch { /* The old request may already be aborted. */ }
    })
    await page.goto('/?symbol=603533', { waitUntil: 'domcontentloaded' })
    await openResearch(page)
    await page.getByRole('tab', { name: '多周期分析', exact: true }).click()

    await page.getByRole('button', { name: '开始多周期分析' }).click()
    await page.getByRole('button', { name: '看1小时' }).click()
    await requested
    if (info.project.name === 'mobile') await page.getByRole('button', { name: '选择对象', exact: true }).click()
    await page.getByRole('combobox', { name: '搜索 A 股' }).fill('平安')
    await page.getByRole('option', { name: /平安银行/ }).click()
    const panel = page.getByRole('region', { name: '多周期情景分析', exact: true })
    await expect(panel.getByText('000001', { exact: true })).toBeVisible()
    release()
    await panel.getByRole('button', { name: '看1小时' }).click()
    await expect(panel.getByRole('region', { name: '1小时状态' })).toContainText('10.20')
    await expect(panel).not.toContainText('旧股票延迟响应')
    await expect(panel).not.toContainText('掌阅科技 · 603533')
  })
})
