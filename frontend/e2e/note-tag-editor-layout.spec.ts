import { expect, test } from '@playwright/test'

test('supplement is discoverable and editor actions stay visible while scrolling', async ({ page }) => {
  await page.goto('/knowledge?view=notes')
  const detail = page.getByRole('region', { name: '标签详情' })
  await detail.getByRole('button', { name: '补充说明', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '修订笔记标签' })
  await expect(dialog.getByLabel('补充说明', { exact: true })).toBeFocused()
  await expect(dialog.getByLabel('补充说明', { exact: true })).toBeInViewport()
  const cancel = dialog.getByRole('button', { name: '取消标签编辑' })
  const save = dialog.getByRole('button', { name: '保存标签新版本' })
  for (const end of [true, false]) {
    await dialog.locator('.nt-editor-body').evaluate((body, bottom) => {
      body.scrollTop = bottom ? body.scrollHeight : 0
    }, end)
    await expect(cancel).toBeInViewport({ ratio: 1 })
    await expect(save).toBeInViewport({ ratio: 1 })
    await expect(dialog.getByRole('heading')).toBeInViewport({ ratio: 1 })
  }
  await page.screenshot({ path: test.info().outputPath('editor.png') })
  await cancel.click()
  await expect(dialog).toHaveCount(0)
})
