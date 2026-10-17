import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import catalogData from './note-tag-catalog.json'
import { NoteTagWorkbench } from './note-tag-workbench'
import { NOTE_TAG_STORAGE_KEY, parseTagLedger, type NoteCatalog } from './note-tags'

const complete = catalogData as NoteCatalog
const files = ['选股总结.md', '股票价格.md', '01-ma-golden-cross.md']
const fixture: NoteCatalog = { ...complete, documents: complete.documents.filter((record) => files.includes(record.file)), fragments: complete.fragments.filter((record) => files.includes(record.file)) }
beforeEach(() => localStorage.clear())

describe('note tagging workbench', () => {
  it('combines topic and usage filters and can inspect rule fragments', async () => {
    const user = userEvent.setup()
    render(<NoteTagWorkbench catalog={fixture} />)
    const list = screen.getByRole('region', { name: '笔记目录' })
    await user.selectOptions(screen.getByLabelText('分析主题'), 'topic.ma5')
    await user.selectOptions(screen.getByLabelText('使用目的'), 'purpose.screen')
    expect(within(list).getByRole('button', { name: '查看标签：选股总结' })).toBeInTheDocument()
    expect(within(list).queryByRole('button', { name: '查看标签：股票价格' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '重置标签筛选' }))
    await user.selectOptions(screen.getByLabelText('标注层级'), 'fragment')
    await user.type(screen.getByRole('textbox', { name: '搜索笔记与标签' }), '金叉')
    expect(within(list).getByRole('button', { name: '查看标签：01-ma-golden-cross' })).toBeInTheDocument()
  })

  it('saves tag revisions with reasons, restores them after reload and retains the old source and tags', async () => {
    const user = userEvent.setup()
    const view = render(<NoteTagWorkbench catalog={fixture} />)
    await user.click(screen.getByRole('button', { name: '查看标签：选股总结' }))
    const details = screen.getByRole('region', { name: '标签详情' })
    await user.click(within(details).getByRole('button', { name: '编辑标签' }))
    const editor = screen.getByRole('dialog', { name: '修订笔记标签' })
    await user.click(within(editor).getByRole('checkbox', { name: '周线' }))
    await user.type(within(editor).getByLabelText('修订原因'), '另按周线研究；保留原有日线解释。')
    await user.click(within(editor).getByRole('button', { name: '保存标签新版本' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const versions = parseTagLedger(localStorage.getItem(NOTE_TAG_STORAGE_KEY))
    expect(versions).toHaveLength(2)
    expect(versions[0].tags).not.toContain('timeframe.weekly')
    expect(versions[1].tags).toContain('timeframe.weekly')
    expect(versions[1].sourceHash).toBe(versions[0].sourceHash)
    expect(versions[1].sourceExcerpt).toBe(versions[0].sourceExcerpt)
    expect(versions[1].revisionReason).toContain('另按周线研究')
    view.unmount()
    render(<NoteTagWorkbench catalog={fixture} />)
    await user.click(screen.getByRole('button', { name: '查看标签：选股总结' }))
    expect(screen.getByRole('region', { name: '标签详情' })).toHaveTextContent('人工修订')
    await user.click(screen.getByText('标签历史 · 2 个版本'))
    await user.click(screen.getByRole('button', { name: '查看标签 v1' }))
    expect(screen.getByText('历史标签版本，只读')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: '标签详情' })).queryByRole('button', { name: '编辑标签' })).not.toBeInTheDocument()
  })

  it('preserves corrupt local records and disables writes until they can be recovered', async () => {
    localStorage.setItem(NOTE_TAG_STORAGE_KEY, '{broken')
    render(<NoteTagWorkbench catalog={fixture} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('未被覆盖')
    expect(screen.getByRole('button', { name: '编辑标签' })).toBeDisabled()
    expect(localStorage.getItem(NOTE_TAG_STORAGE_KEY)).toBe('{broken')
  })

  it('records tag review without upgrading computation readiness or clearing missing definitions', async () => {
    render(<NoteTagWorkbench catalog={fixture} />)
    await screen.findByRole('button', { name: '确认标签' })
    fireEvent.click(screen.getByRole('button', { name: '确认标签' }))
    const versions = parseTagLedger(localStorage.getItem(NOTE_TAG_STORAGE_KEY))
    expect(versions.at(-1)?.status).toBe('reviewed')
    expect(versions.at(-1)?.tags).toEqual(versions[0].tags)
    expect(versions.at(-1)?.gaps).toEqual(versions[0].gaps)
    expect(screen.getByText(/标签核对不代表计算定义或预测效果已验证/)).toBeInTheDocument()
  })
})
