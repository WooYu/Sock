import type { Page } from './test'

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
  await page.getByRole('button', { name: '绘图', exact: true }).click()
  await page.getByRole('navigation', { name: '绘图工具', exact: true }).getByRole('button', { name: tool, exact: true }).click()
}
