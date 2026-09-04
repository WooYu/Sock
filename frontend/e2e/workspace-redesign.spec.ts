import { expect, test } from '@playwright/test'

test.describe('mixed workspace redesign', () => {
  test('keeps the approved five-workspace shell on desktop', async ({ page }) => {
    await page.goto('/overview')

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
  })

  test('opens chart tools from the mobile chart workspace', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/chart?symbol=002475')
    await page.getByRole('button', { name: '工具' }).click()
    await expect(page.getByRole('dialog', { name: 'K线工具' })).toBeVisible()
  })
})
