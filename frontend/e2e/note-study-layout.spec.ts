import { expect, test } from './fixtures/test'

test('study directory stays readable and opens the selected detail', async ({ page }, info) => {
  await page.goto('/knowledge?view=notes')
  await expect(page.getByRole('button', { name: '导出标签与历史', exact: true })).toBeEnabled({ timeout: 30000 })
  await page.getByRole('button', { name: '逐篇学习建议', exact: true }).click()
  const directory = page.getByRole('region', { name: '逐篇学习目录' })
  const records = directory.getByRole('button')
  await expect(records).toHaveCount(146, { timeout: 30000 })
  const first = await records.nth(0).boundingBox()
  const second = await records.nth(1).boundingBox()
  expect(second!.y).toBeGreaterThanOrEqual(first!.y + first!.height - 1)
  const detail = page.getByRole('region', { name: '逐篇学习详情' })
  if (info.project.name === 'desktop') {
    const box = await detail.boundingBox()
    expect(box!.x).toBeGreaterThan(first!.x + first!.width)
    expect(Math.abs(box!.y - (await directory.boundingBox())!.y)).toBeLessThan(5)
  }
  await records.nth(1).click()
  await expect(records.nth(1)).toHaveAttribute('aria-pressed', 'true')
  await expect(detail.getByRole('heading', { name: '02-ma-death-cross.md', exact: true })).toBeVisible()
  await page.getByRole('textbox', { name: '搜索逐篇学习' }).fill('无匹配笔记abcdef')
  await expect(directory).toContainText('没有匹配的研究笔记')
  await expect(detail).toHaveCount(0)
  await page.getByRole('textbox', { name: '搜索逐篇学习' }).fill('')
  await expect(records).toHaveCount(146)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
})
