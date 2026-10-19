import { expect, test } from '@playwright/test'
import catalog from '../src/features/knowledge/note-tag-catalog.json'

test('previews independent model results and saves only after explicit adoption', async ({ page }) => {
  await page.route('**/api/note-tag-extraction', async route => {
    const input = route.request().postDataJSON()
    const record = catalog.documents.find(item => item.id === input.id)!
    const evidence = [{ ...record.evidence[0], tagId: 'topic.ma', method: 'ai', reason: '本次双模型共识' }]
    await route.fulfill({ json: { ...input, models: [
      { name: 'DeepSeek', tags: ['topic.ma', 'purpose.trend'], evidence, note: '主要研究均线' },
      { name: 'Codex', tags: ['topic.ma'], evidence, note: '只保留核心主题' },
    ], candidate: { ...input, tags: ['topic.ma'], evidence, extraction: { models: ['DeepSeek', 'Codex'], note: '本次双模型提取', disagreements: [{ tagId: 'purpose.trend', model: 'DeepSeek' }] } } } })
  })
  await page.goto('/knowledge?view=notes')
  await page.getByRole('button', { name: '双 AI 重新提取标签', exact: true }).click()
  const preview = page.getByRole('region', { name: '双 AI 重新提取', exact: true })
  await expect(preview).toContainText('模型分歧（未采用）')
  await preview.scrollIntoViewIfNeeded()
  await page.screenshot({ path: test.info().outputPath('dual-ai-preview.png') })
  await preview.getByRole('button', { name: '采用本次结果并编辑' }).click()
  const editor = page.getByRole('dialog', { name: '修订笔记标签' })
  await expect(editor.getByRole('checkbox', { name: '均线', exact: true })).toBeChecked()
  await editor.locator('.nt-editor-body').evaluate(body => { body.scrollTop = body.scrollHeight })
  await expect(editor.getByRole('button', { name: '取消标签编辑' })).toBeInViewport({ ratio: 1 })
  await expect(editor.getByRole('button', { name: '保存标签新版本' })).toBeInViewport({ ratio: 1 })
  await page.screenshot({ path: test.info().outputPath('dual-ai-editor.png') })
  await editor.getByRole('button', { name: '保存标签新版本' }).click()
  await expect(editor).toHaveCount(0)
  await expect(page.getByRole('region', { name: '标签详情' })).toContainText('本次双模型提取')
  await page.reload()
  await expect(page.getByRole('region', { name: '标签详情' })).toContainText('本次双模型提取')
})
