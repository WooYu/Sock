import { expect, test } from '@playwright/test'
import taxonomy from '../src/features/knowledge/note-tag-taxonomy.json'
import { MA_COLORS } from '../src/features/chart/chart-periods'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/sync/**', route => route.fulfill({ json: { nextCursor: 0, changes: [], applied: true, cursor: 0 } }))
})

test('filters and editor contain exactly the new taxonomy', async ({ page }) => {
  await page.goto('/knowledge?view=notes')
  await expect(page.getByRole('heading', { name: '笔记标签目录' })).toBeVisible({ timeout: 60_000 })
  for (const dimension of taxonomy) {
    const select = page.getByRole('combobox', { name: dimension.label, exact: true })
    await expect(select.locator('option')).toHaveText(['全部', ...dimension.options.map(item => item.label)])
  }
  for (const label of ['使用目的', '周期', '适用范围', '数据依赖', '可计算性']) {
    await expect(page.getByRole('combobox', { name: label, exact: true })).toHaveCount(0)
  }
  await page.getByRole('button', { name: '编辑标签', exact: true }).click()
  const editor = page.getByRole('dialog')
  await expect(editor.locator('fieldset')).toHaveCount(2)
  await expect(editor.getByRole('checkbox')).toHaveCount(27)
  for (const dimension of taxonomy) {
    await expect(editor.locator('fieldset').filter({ has: page.getByText(dimension.label, { exact: true }) }).getByRole('checkbox')).toHaveCount(dimension.options.length)
  }
  await page.screenshot({ path: test.info().outputPath('taxonomy.png') })
  await editor.getByRole('button', { name: '取消标签编辑' }).click()
})

test('prediction popup rows match their chart curves', async ({ page }) => {
  await page.goto('/?example=1')
  const chart = page.getByRole('img', { name: 'K线主图', exact: true })
  await expect(chart).toBeVisible({ timeout: 90_000 })
  await chart.scrollIntoViewIfNeeded()
  const date = page.getByRole('button', { name: /^查看预测/ }).first()
  await expect(date).toBeVisible({ timeout: 90_000 })
  await date.dispatchEvent('click')
  const tooltip = page.getByTestId('projection-tooltip')
  const mobile = (page.viewportSize()?.width ?? 1000) <= 720
  if (!mobile) await expect(tooltip).toBeVisible()
  for (const [key, color] of Object.entries(MA_COLORS)) {
    await expect(tooltip.locator(`[data-indicator="${key}"]`)).toHaveAttribute('fill', color)
    await expect(page.locator(`[data-chart-layer="indicator"] [data-indicator="${key}"] path`).first()).toHaveAttribute('stroke', color)
  }
  await expect(tooltip.locator('[data-indicator="bollUpper"]')).toHaveAttribute('fill', '#6f7fd8')
  await expect(tooltip.locator('[data-indicator="bollMiddle"]')).toHaveAttribute('fill', MA_COLORS.ma20)
  await expect(tooltip.locator('[data-indicator="bollLower"]')).toHaveAttribute('fill', '#6f7fd8')
  const details = page.getByRole('region', { name: '指标预测详情' })
  if (mobile) {
    await expect(details.locator('[data-indicator=ma5]').last()).toHaveCSS('color', 'rgb(196, 122, 8)')
    await details.scrollIntoViewIfNeeded()
  } else await tooltip.scrollIntoViewIfNeeded()
  await page.screenshot({ path: test.info().outputPath('popup-colors.png') })
})
