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
    await login.getByLabel('手机号').focus()
    await expect(login.getByLabel('手机号')).toHaveCSS('outline-color', primary)
    await expect(login.getByRole('button', { name: '确认登录' })).toHaveCSS('background-color', primary)
    await login.screenshot({ path: `artifacts/theme-overlays/${info.project.name}/${theme}-login.png` })
    await page.keyboard.press('Escape')

    await page.goto('/trading/ledger?symbol=600519')
  await page.getByRole('button', { name: '记录交易', exact: true }).click()
    // Start recording only when requested.
    await expect(page.getByRole('dialog', { name: '新增交易' })).toBeVisible()
    const trade = page.getByRole('dialog', { name: '新增交易' })
    await expect(trade).toHaveCSS('background-color', surface)
    await expect(trade.getByRole('button', { name: '保存交易' })).toHaveCSS('background-color', primary)
    await trade.screenshot({ path: `artifacts/theme-overlays/${info.project.name}/${theme}-trade.png` })
    await page.keyboard.press('Escape')

    await page.goto('/knowledge?view=notes')
    await page.getByRole('button', { name: '编辑笔记', exact: true }).click()
    await page.getByRole('region', { name: '标签详情' }).getByRole('button', { name: '标签与补充说明', exact: true }).click()
    const editor = page.getByRole('dialog', { name: '修订笔记标签' })
    await expect(editor).toHaveCSS('background-color', surface)
    expect(await editor.getByLabel('补充说明', { exact: true }).evaluate(el => getComputedStyle(el).fontFamily)).toContain(font)
    await editor.screenshot({ path: `artifacts/theme-overlays/${info.project.name}/${theme}-note-editor.png` })
    await editor.getByRole('button', { name: '取消标签编辑' }).click()
  })

  test(`theme ${theme}: rule import focus uses the theme accent`, async ({ page }) => {
    await setTheme(page, theme)
    await page.goto('/rules')
    await page.locator('.sc-page-disclosure > summary').filter({ hasText: '导入股票笔记' }).click()
    const field = page.getByRole('textbox', { name: '粘贴 Markdown', exact: true })
    await field.focus()
    const soft = theme === 'c' ? 'rgb(228, 242, 233)' : 'rgb(32, 62, 73)'
    await expect.poll(() => field.evaluate(el => getComputedStyle(el).boxShadow)).toContain(soft)
  })

  test(`theme ${theme}: inline forecast follows appearance and keeps curve keys`, async ({ page }, info) => {
    test.setTimeout(90_000)
    await setTheme(page, theme)
    await page.goto('/?example=1')
    const chart = page.getByRole('img', { name: 'K线主图', exact: true })
    await expect(chart).toBeVisible({ timeout: 60_000 })
    await chart.scrollIntoViewIfNeeded()
    const target = page.getByRole('button', { name: /^查看预测/ }).first()
    await target.click()
    const values = page.locator('.rs-inline-forecast-details')
    await expect(values).toBeVisible()
    expect(await values.evaluate(element => getComputedStyle(element).fontFamily)).toContain(theme === 'c' ? 'DengXian' : 'Microsoft YaHei')
    await expect(values.locator('[data-indicator=ma5]')).toHaveCSS('color', 'rgb(196, 122, 8)')
    await expect(page.locator('.rs-workbench')).toHaveCSS('background-color', theme === 'c' ? 'rgb(252, 254, 252)' : 'rgb(24, 36, 49)')
    await values.screenshot({ path: `artifacts/theme-overlays/${info.project.name}/${theme}-forecast.png` })
  })
}
