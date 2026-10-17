import { expect, test } from '@playwright/test'

test('keeps research entry labels and positions stable when switching panels', async ({ page }) => {
  await page.goto('/?example=1')
  await expect(page.getByRole('region', { name: '自动 MA/BOLL 预测', exact: true }).getByRole('button', { name: '30分钟', exact: true })).toBeEnabled()
  const tabs = page.getByRole('tablist', { name: '研究依据类型' })
  await tabs.scrollIntoViewIfNeeded()
  const names = ['走势依据', '笔记规则', '历史相似', '多周期分析']
  await expect(tabs.getByRole('tab')).toHaveText(names)
  const initial = await tabs.boundingBox()
  const body = page.locator('.rs-evidence-body')
  const initialHeight = (await body.boundingBox())!.height
  for (const name of ['历史相似', '笔记规则', '多周期分析', '走势依据']) {
    const tab = tabs.getByRole('tab', { name, exact: true })
    await tab.click()
    await expect(tab).toHaveAttribute('aria-selected', 'true')
    await expect(tabs.getByRole('tab')).toHaveText(names)
    await expect(page.getByRole('tabpanel', { name, exact: true })).toBeVisible()
    expect(Math.abs((await tabs.boundingBox())!.y - initial!.y)).toBeLessThan(2)
    expect((await body.boundingBox())!.height).toBe(initialHeight)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
