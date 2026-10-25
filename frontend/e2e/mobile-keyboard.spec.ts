import { expect, test, type Page } from './fixtures/test'

async function openKeyboard(page: Page) {
  await page.evaluate(() => {
    const viewport = window.visualViewport!
    Object.defineProperty(viewport, 'height', { configurable: true, value: 360 })
    Object.defineProperty(viewport, 'offsetTop', { configurable: true, value: 60 })
    viewport.dispatchEvent(new Event('resize'))
  })
}

test('login remains usable above a keyboard that leaves the layout viewport unchanged', async ({ page }) => {
  await page.goto('/settings')
  await page.getByRole('button', { name: '登录同步', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '登录 StockCal' })
  await openKeyboard(page)
  await expect.poll(async () => {
    const box = (await dialog.boundingBox())!
    return box.y >= 59 && box.y + box.height <= 421
  }).toBe(true)
  await dialog.getByRole('button', { name: '获取验证码' }).click()
  await expect(dialog.getByRole('alert')).toContainText('11 位手机号')
  await dialog.getByRole('button', { name: '关闭登录' }).click()
  await expect(dialog).toHaveCount(0)
})

test('trade footer stays reachable while its fields scroll above the keyboard', async ({ page }) => {
  await page.goto('/trading/ledger?symbol=600519')
  await page.getByRole('button', { name: '记录交易', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '新增交易' })
  await expect(dialog).toBeVisible()
  await openKeyboard(page)
  await dialog.getByLabel('交易数量').fill('100')
  await dialog.getByLabel('成交价格').fill('1290')
  const save = dialog.getByRole('button', { name: '保存交易', exact: true })
  const box = (await save.boundingBox())!
  const cancel = (await dialog.getByRole('button', { name: '取消', exact: true }).boundingBox())!
  expect(Math.abs(cancel.y - box.y)).toBeLessThan(2)
  expect(box.y).toBeGreaterThanOrEqual(60)
  expect(box.y + box.height).toBeLessThanOrEqual(420)
  await save.click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('买入 100 股', { exact: true })).toBeVisible()
})

test('note editor keeps both actions visible while the keyboard is open', async ({ page }) => {
  await page.goto('/knowledge?view=notes')
  await page.locator('.nt-secondary-actions > summary').click()
  await page.getByRole('button', { name: '补充说明', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '修订笔记标签' })
  await openKeyboard(page)
  await dialog.getByLabel('补充说明', { exact: true }).fill('手机键盘布局核对')
  for (const name of ['取消标签编辑', '保存标签新版本']) {
    const box = (await dialog.getByRole('button', { name }).boundingBox())!
    expect(box.y).toBeGreaterThanOrEqual(60)
    expect(box.y + box.height).toBeLessThanOrEqual(420)
  }
  await dialog.getByRole('button', { name: '取消标签编辑' }).click()
  await expect(dialog).toHaveCount(0)
})
