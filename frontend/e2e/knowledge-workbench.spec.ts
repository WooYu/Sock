import { expect, test } from './fixtures/test'
import researchPackage from '../src/features/knowledge/research-package.json'

test.describe('current knowledge workspace', () => {
  test('shows source-backed comparisons and changes the forecast horizon', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('/knowledge?view=backtest')
    const table = page.getByRole('region', { name: '模型误差对照表' })
    await expect(table).toContainText('5.90%')
    await expect(table).toContainText('5.80%')
    await page.getByRole('button', { name: '未来 4 日', exact: true }).click()
    await expect(table).toContainText('6.85%')
    await expect(table).toContainText('6.67%')
    await expect(page.getByText('725', { exact: false }).first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    expect(errors).toEqual([])
  })

  test('legacy experience links open note tags while preserving original saved versions', async ({ page }) => {
    const ledger = JSON.stringify({ schemaVersion: 1, records: [researchPackage.entries[0]] })
    await page.addInitScript(raw => localStorage.setItem('stockcal.knowledge.v1', raw), ledger)
    await page.goto('/knowledge?view=library')
    await expect(page.getByRole('heading', { name: '笔记标签', exact: true, level: 1 })).toBeVisible()
    await expect(page.getByRole('button', { name: '新增记录', exact: true })).toHaveCount(0)
    const navigation = page.getByRole('navigation', { name: '研究工作台导航' })
    await expect(navigation.getByRole('link', { name: '经验原则', exact: true })).toHaveCount(0)
    await navigation.getByRole('link', { name: '回测证据', exact: true }).click()
    await expect(page.getByRole('region', { name: '模型误差对照表' })).toBeVisible()
    await page.reload()
    expect(await page.evaluate(() => localStorage.getItem('stockcal.knowledge.v1'))).toBe(ledger)
  })

  test('knowledge links and browser history restore the selected active view', async ({ page }) => {
    await page.goto('/knowledge?view=notes')
    const navigation = page.getByRole('navigation', { name: '研究工作台导航' })
    await navigation.getByRole('link', { name: '回测证据', exact: true }).click()
    await expect(page).toHaveURL(/view=backtest/)
    await expect(page.getByRole('region', { name: '模型误差对照表' })).toBeVisible()
    await page.goBack()
    await expect(page.getByRole('heading', { name: '笔记标签', exact: true, level: 1 })).toBeVisible()
    await expect(navigation.getByRole('link', { name: '笔记标签', exact: true })).toHaveAttribute('aria-current', 'page')
  })
})
