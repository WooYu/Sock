import { expect, type Page } from './test'

export async function openResearch(page: Page) {
  const section = page.locator('.rs-workbench-research')
  if (!await section.evaluate(element => (element as HTMLDetailsElement).open)) await section.locator(':scope > summary').click()
}

export async function openRecords(page: Page) {
  const section = page.locator('.rs-workbench-records')
  if (!await section.evaluate(element => (element as HTMLDetailsElement).open)) await section.locator(':scope > summary').click()
}

export async function chooseBasis(page: Page, basis: string) {
  await page.getByRole('button', { name: '图表设置', exact: true }).click()
  await page.getByLabel('价格复权方式').selectOption(basis)
  await page.getByRole('button', { name: '关闭图表设置', exact: true }).click()
}

export async function startDrawing(page: Page, tool: string) {
  const drawMode = page.getByRole('button', { name: '绘图', exact: true })
  const toolbar = page.getByRole('navigation', { name: '绘图工具', exact: true })
  await expect(async () => {
    if (await drawMode.getAttribute('aria-pressed') !== 'true') await drawMode.click()
    await expect(toolbar).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 15000 })
  const direct = toolbar.getByRole('button', { name: tool, exact: true })
  if (await direct.count()) await direct.click()
  else {
    await toolbar.getByRole('button', { name: ['买入点', '卖出点', '目标位', '止损位'].includes(tool) ? '标记' : '更多', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: tool, exact: true }).click()
  }
}
