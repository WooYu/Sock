import { expect, test, type Page } from './fixtures/test'

async function setTheme(page: Page, theme: 'c' | 'd') {
  await page.goto('/settings')
  await page.getByRole('button', { name: theme === 'c' ? /C · 清爽自然/ : /D · 深色科技/ }).click()
}

for (const theme of ['c', 'd'] as const) {
  test(`theme ${theme}: dialogs, inputs and primary actions`, async ({ page }, info) => {
    test.setTimeout(120_000)
    await page.route('**/api/sync/**', route => route.fulfill({ json: { nextCursor: 0, changes: [], applied: true, cursor: 0 } }))
    await setTheme(page, theme)
    const surface = theme === 'c' ? 'rgb(252, 254, 252)' : 'rgb(24, 36, 49)'
    const primary = theme === 'c' ? 'rgb(23, 107, 82)' : 'rgb(103, 220, 232)'
    const font = theme === 'c' ? 'DengXian' : 'Microsoft YaHei'
    await page.getByRole('button', { name: '登录同步', exact: true }).click()
    const login = page.getByRole('dialog', { name: '登录 StockCal' })
    await expect(login).toHaveCSS('background-color', surface)
    expect(await login.evaluate(el => getComputedStyle(el).fontFamily)).toContain(font)
    await expect(login.getByLabel('手机号')).toHaveCSS('background-color', surface)
    await expect(login.getByLabel('手机号')).toHaveCSS('outline-color', primary)
    await expect(login.getByRole('button', { name: '确认登录' })).toHaveCSS('background-color', primary)
    await login.screenshot({ path: `artifacts/theme-overlays/${info.project.name}/${theme}-login.png` })
    await page.keyboard.press('Escape')

    await page.goto('/trading/ledger?symbol=600519')
    // An empty ledger opens its first-trade dialog automatically.
    await expect(page.getByRole('dialog', { name: '新增交易' })).toBeVisible()
    const trade = page.getByRole('dialog', { name: '新增交易' })
    await expect(trade).toHaveCSS('background-color', surface)
    await expect(trade.getByRole('button', { name: '保存交易' })).toHaveCSS('background-color', primary)
    await trade.screenshot({ path: `artifacts/theme-overlays/${info.project.name}/${theme}-trade.png` })
    await page.keyboard.press('Escape')

    await page.goto('/knowledge?view=notes')
    await page.getByRole('region', { name: '标签详情' }).getByRole('button', { name: '补充说明', exact: true }).click()
    const editor = page.getByRole('dialog', { name: '修订笔记标签' })
    await expect(editor).toHaveCSS('background-color', surface)
    expect(await editor.getByLabel('补充说明', { exact: true }).evaluate(el => getComputedStyle(el).fontFamily)).toContain(font)
    await editor.screenshot({ path: `artifacts/theme-overlays/${info.project.name}/${theme}-note-editor.png` })
    await editor.getByRole('button', { name: '取消标签编辑' }).click()
  })

  test(`theme ${theme}: rule import focus uses the theme accent`, async ({ page }) => {
    await setTheme(page, theme)
    await page.goto('/rules')
    const field = page.getByRole('textbox', { name: '粘贴 Markdown', exact: true })
    await field.focus()
    const soft = theme === 'c' ? 'rgb(228, 242, 233)' : 'rgb(32, 62, 73)'
    expect(await field.evaluate(el => getComputedStyle(el).boxShadow)).toContain(soft)
  })

  test(`theme ${theme}: forecast tooltip follows appearance and keeps curve keys`, async ({ page }, info) => {
    test.setTimeout(90_000)
    await setTheme(page, theme)
    await page.goto('/?example=1')
    const chart = page.getByRole('img', { name: 'K线主图', exact: true })
    await expect(chart).toBeVisible({ timeout: 60_000 })
    await chart.scrollIntoViewIfNeeded()
    const target = page.getByRole('button', { name: /^查看预测/ }).first()
    if (info.project.name === 'mobile') {
      await target.dispatchEvent('click')
      const sheet = page.getByTestId('chart-mobile-sheet')
      await expect(sheet).toBeVisible()
      await expect(sheet).toHaveCSS('background-color', theme === 'c' ? 'rgb(252, 254, 252)' : 'rgb(24, 36, 49)')
      expect(await sheet.evaluate(el => getComputedStyle(el).fontFamily)).toContain(theme === 'c' ? 'DengXian' : 'Microsoft YaHei')
      await sheet.screenshot({ path: `artifacts/theme-overlays/${info.project.name}/${theme}-forecast-sheet.png` })
      return
    }
    await target.focus()
    const tooltip = page.getByTestId('projection-tooltip')
    await expect(tooltip).toBeVisible()
    await expect(tooltip.locator('.sc-chart-tooltip-bg')).toHaveCSS('fill', theme === 'c' ? 'rgb(252, 254, 252)' : 'rgb(24, 36, 49)')
    await expect(tooltip.locator('text').nth(1)).toHaveCSS('fill', theme === 'c' ? 'rgb(32, 60, 50)' : 'rgb(230, 237, 245)')
    expect(await tooltip.locator('text').first().evaluate(el => getComputedStyle(el).fontFamily)).toContain(theme === 'c' ? 'DengXian' : 'Microsoft YaHei')
    await expect(tooltip.locator('[data-indicator=ma5]')).toHaveAttribute('fill', '#c47a08')
    await chart.screenshot({ path: `artifacts/theme-overlays/${info.project.name}/${theme}-forecast.png` })
  })
}
