import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { MarkdownImportPanel } from './markdown-import-panel'

describe('MarkdownImportPanel', () => {
  test('uploads multiple markdown files as sources', async () => {
    const user = userEvent.setup()
    const importSource = vi.fn(async (path: string, content: string) => ({ id: path, path, title: path, contentHash: 'hash', originalContent: content, importedAt: new Date().toISOString() }))
    const extractSource = vi.fn(async () => [])
    render(<MarkdownImportPanel importSource={importSource} extractSource={extractSource} />)

    await user.upload(screen.getByLabelText('导入 Markdown'), [
      new File(['# 买股原则\n站上 MA5'], '买股原则.md', { type: 'text/markdown' }),
      new File(['# 五日线\n回踩不破'], '五日线.md', { type: 'text/markdown' }),
    ])

    expect(await screen.findByText('已提交 2 个 Markdown 来源')).toBeInTheDocument()
    expect(importSource).toHaveBeenCalledTimes(2)
    expect(extractSource).toHaveBeenCalledTimes(2)
  })

  test('submits pasted markdown and natural language through the same source flow', async () => {
    const user = userEvent.setup()
    const importSource = vi.fn(async (path: string, content: string) => ({ id: path, path, title: path, contentHash: 'hash', originalContent: content, importedAt: new Date().toISOString() }))
    const extractSource = vi.fn(async () => [])
    render(<MarkdownImportPanel importSource={importSource} extractSource={extractSource} />)

    await user.type(screen.getByLabelText('来源名称'), '我的经验.md')
    await user.type(screen.getByLabelText('粘贴 Markdown'), '# 五日线\n回踩不破')
    await user.click(screen.getByRole('button', { name: '识别粘贴内容' }))
    expect(await screen.findByText('已提交 1 个 Markdown 来源')).toBeInTheDocument()

    await user.type(screen.getByLabelText('自然语言经验'), '短线回踩 MA5 不破再观察')
    await user.click(screen.getByRole('button', { name: '识别自然语言' }))
    expect(await screen.findByText('已提交 1 条自然语言经验')).toBeInTheDocument()
    expect(importSource).toHaveBeenNthCalledWith(2, '自然语言经验.md', '短线回踩 MA5 不破再观察')
    expect(extractSource).toHaveBeenCalledTimes(2)
  })
})
