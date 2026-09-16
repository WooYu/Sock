import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ExperienceWorkbench } from './experience-workbench'
import {
  KNOWLEDGE_STORAGE_KEY, createManualVersion, isExpired, parseLedger,
  reviewVersion, reviseSourceInterpretation, validateManualDraft, type ExperienceEntry, type KnowledgePackage,
} from './knowledge-types'

const sourceEntry: ExperienceEntry = {
  id: 'ma5-source', version: 1, type: 'principle', title: '五日线底线',
  originalText: '破五出局。', interpretation: '五日线破位后退出；破位口径尚需明确。',
  sourceType: 'github', status: 'unreviewed', scope: ['日线'], createdAt: '2026-09-16T00:00:00Z',
  gaps: ['需要明确盘中还是收盘破位。'], caveats: ['趋势持有与两日短做分别记录。'],
  references: [{ file: '买股原则.md', startLine: 18, endLine: 18, quote: '破五出局。', url: 'https://github.com/example/notes/blob/abc/note.md#L18' }],
}
const fixture: KnowledgePackage = {
  generatedAt: '2026-09-16T00:00:00Z', docCount: 46, sourceCommit: '707f4fe0032ff44f309e7f374ba68f16d9e065af',
  sourceRepository: 'https://github.com/example/notes', entries: [sourceEntry],
  backtest: {
    start: '2023-09-15', end: '2026-09-15', sessions: 728, holdoutStart: '2025-09-16',
    models: [
      { horizon: 3, id: 'baseline', label: '收盘不变基线', mape: 3.1, direction: 49.2, samples: 230 },
      { horizon: 3, id: 'rules', label: '经验规则代理', mape: 4.3, direction: 47.8, samples: 230 },
      { horizon: 4, id: 'baseline', label: '收盘不变基线', mape: 3.6, direction: null, samples: 229 },
    ],
    findings: ['经验规则代理尚未显示稳定优势。'], methodology: ['按时间顺序留出测试集，预测时不读取未来价格。'],
    sourceQuality: ['公开历史日K，采用固定复权口径。'],
  },
}
const draft = { title: '观察量能', originalText: '突破时观察量能。', interpretation: '', type: 'experience' as const }

beforeEach(() => { localStorage.clear() })
afterEach(() => { vi.restoreAllMocks() })

describe('immutable knowledge records', () => {
  it('keeps manually saved text uninterpreted until a person supplies an interpretation', () => {
    const entry = createManualVersion(draft, 'manual-1', '2026-09-16T01:00:00Z')
    expect(entry).toMatchObject({ id: 'manual-1', version: 1, status: 'unreviewed', interpretation: '', sourceType: 'manual' })
    expect(entry.gaps.length).toBeGreaterThan(0)
    expect(entry.previousVersion).toBeUndefined()
  })

  it('edits into a new version, preserves the original and requires another review', () => {
    const first = createManualVersion({ ...draft, interpretation: '成交量只作为辅助观察。' }, 'manual-1', '2026-09-16T01:00:00Z')
    const reviewed = reviewVersion(first, '2026-09-16T02:00:00Z')
    const edited = createManualVersion({ ...draft, title: '修订量能观察' }, 'manual-1', '2026-09-16T03:00:00Z', reviewed)
    expect(first.version).toBe(1)
    expect(first.status).toBe('unreviewed')
    expect(reviewed).toMatchObject({ version: 2, previousVersion: 1, status: 'reviewed' })
    expect(edited).toMatchObject({ version: 3, previousVersion: 2, status: 'unreviewed', title: '修订量能观察' })
    expect(first.title).toBe('观察量能')
  })

  it('retains unresolved definitions after review and refuses review of unstructured text', () => {
    const reviewed = reviewVersion(sourceEntry, '2026-09-16T01:00:00Z')
    expect(reviewed.gaps).toEqual(sourceEntry.gaps)
    expect(() => reviewVersion(createManualVersion(draft, 'raw', '2026-09-16T01:00:00Z'), '2026-09-16T02:00:00Z')).toThrow('解释')
  })

  it('invalidates older research when the content is edited while keeping the old result intact', () => {
    const first = { ...createManualVersion(draft, 'manual-1', '2026-09-16T01:00:00Z'), researchTest: '旧版 3 日误差 5.9%。' }
    const edited = createManualVersion({ ...draft, originalText: '新判断需要重新验证。' }, first.id, '2026-09-16T02:00:00Z', first)
    expect(first.researchTest).toBe('旧版 3 日误差 5.9%。')
    expect(edited.researchTest).toBe('旧版本研究仅供参照，当前版本需重新检验。')
    expect(edited.researchTest).not.toContain('5.9')
  })

  it('corrects an AI interpretation as a new version while protecting the exact GitHub original', () => {
    const previous = { ...sourceEntry, status: 'reviewed' as const, researchTest: '旧解释的研究结果。' }
    const revised = reviseSourceInterpretation(previous, { originalText: previous.originalText, interpretation: '修正：五日线按收盘判断。', gaps: ['撮合时点待定义。'] }, '2026-09-16T02:00:00Z')
    expect(revised).toMatchObject({ version: 2, previousVersion: 1, status: 'unreviewed', sourceType: 'github', originalText: sourceEntry.originalText })
    expect(revised.references).toEqual(sourceEntry.references)
    expect(revised.interpretation).toBe('修正：五日线按收盘判断。')
    expect(revised.researchTest).toBe('旧版本研究仅供参照，当前版本需重新检验。')
    expect(previous.interpretation).toBe(sourceEntry.interpretation)
    expect(() => reviseSourceInterpretation(previous, { originalText: '悄悄改动来源', interpretation: '新解释', gaps: [] }, '2026-09-16T02:00:00Z')).toThrow('原文')
  })

  it('validates required text and real expiry dates without making expired tips active', () => {
    expect(validateManualDraft({ ...draft, title: ' ', originalText: '' }, '2026-09-16')).toMatchObject({ title: expect.any(String), originalText: expect.any(String) })
    expect(validateManualDraft({ ...draft, type: 'hint', expiresOn: '2026-02-30' }, '2026-09-16')).toHaveProperty('expiresOn')
    expect(validateManualDraft({ ...draft, type: 'hint', expiresOn: '2026-09-15' }, '2026-09-16')).toHaveProperty('expiresOn')
    expect(validateManualDraft({ ...draft, type: 'hint', expiresOn: '2026-09-16' }, '2026-09-16')).toEqual({})
    const hint = { ...sourceEntry, type: 'hint' as const, expiresOn: '2026-09-16' }
    expect(isExpired(hint, '2026-09-16')).toBe(false)
    expect(isExpired(hint, '2026-09-17')).toBe(true)
    expect(isExpired({ ...hint, type: 'principle' }, '2026-09-17')).toBe(false)
  })

  it('rejects damaged or unsupported local ledgers instead of silently discarding records', () => {
    expect(parseLedger(null)).toEqual([])
    expect(parseLedger(JSON.stringify({ schemaVersion: 1, records: [sourceEntry] }))).toEqual([sourceEntry])
    expect(() => parseLedger('{bad')).toThrow()
    expect(() => parseLedger(JSON.stringify({ schemaVersion: 2, records: [] }))).toThrow()
    expect(() => parseLedger(JSON.stringify({ schemaVersion: 1, records: [{ ...sourceEntry, version: 0 }] }))).toThrow()
    expect(() => parseLedger(JSON.stringify({ schemaVersion: 1, records: [sourceEntry, sourceEntry] }))).toThrow()
  })
})

describe('experience workbench', () => {
  it('saves a manual entry, edits a new version and makes the old text inspectable after reload', async () => {
    const user = userEvent.setup()
    const view = render(<ExperienceWorkbench data={fixture} />)
    await user.click(screen.getByRole('button', { name: '新增记录' }))
    const form = screen.getByRole('dialog', { name: '新增记录' })
    await user.type(within(form).getByLabelText('标题'), '手工量能记录')
    await user.type(within(form).getByLabelText('原始内容'), '原始判断不自动变成交易规则。')
    await user.click(within(form).getByRole('button', { name: '保存记录' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    let persisted = parseLedger(localStorage.getItem(KNOWLEDGE_STORAGE_KEY))
    expect(persisted).toHaveLength(1)
    expect(persisted[0].interpretation).toBe('')
    await user.click(screen.getByRole('button', { name: '编辑记录' }))
    const edit = screen.getByRole('dialog', { name: '编辑为新版本' })
    await user.clear(within(edit).getByLabelText('原始内容'))
    await user.type(within(edit).getByLabelText('原始内容'), '修订后的观察。')
    await user.click(within(edit).getByRole('button', { name: '保存新版本' }))
    persisted = parseLedger(localStorage.getItem(KNOWLEDGE_STORAGE_KEY))
    expect(persisted.map((entry) => entry.version)).toEqual([1, 2])
    expect(persisted[0].originalText).toBe('原始判断不自动变成交易规则。')
    view.unmount()
    render(<ExperienceWorkbench data={fixture} />)
    await user.click(await screen.findByRole('button', { name: /查看记录：手工量能记录/ }))
    await user.click(screen.getByText('版本历史 · 2 个版本'))
    await user.click(screen.getByRole('button', { name: '查看 v1' }))
    expect(screen.getByText('原始判断不自动变成交易规则。')).toBeInTheDocument()
    expect(screen.getByText('历史版本，只读')).toBeInTheDocument()
  })

  it('records review without clearing gaps or claiming trading activation', async () => {
    const user = userEvent.setup()
    render(<ExperienceWorkbench data={fixture} />)
    await user.click(screen.getByRole('button', { name: '确认解释' }))
    const records = parseLedger(localStorage.getItem(KNOWLEDGE_STORAGE_KEY))
    expect(records.at(-1)).toMatchObject({ status: 'reviewed', version: 2, gaps: sourceEntry.gaps })
    expect(screen.getByText('仅供参考 · 定义待补充')).toBeInTheDocument()
    expect(screen.queryByText('已启用交易')).not.toBeInTheDocument()
  })

  it('allows AI corrections in the UI, retaining a read-only source and a reviewable history', async () => {
    const user = userEvent.setup()
    render(<ExperienceWorkbench data={fixture} />)
    await user.click(screen.getByRole('button', { name: '修正解释' }))
    const form = screen.getByRole('dialog', { name: '修正 AI 解释' })
    expect(within(form).getByLabelText('原始内容')).toHaveAttribute('readonly')
    await user.clear(within(form).getByLabelText('修正后的解释'))
    await user.type(within(form).getByLabelText('修正后的解释'), '按收盘破位判断，下一日执行。')
    await user.click(within(form).getByRole('button', { name: '保存新版本' }))
    const records = parseLedger(localStorage.getItem(KNOWLEDGE_STORAGE_KEY))
    expect(records.map((entry) => entry.version)).toEqual([1, 2])
    expect(records[1]).toMatchObject({ sourceType: 'github', originalText: sourceEntry.originalText, interpretation: '按收盘破位判断，下一日执行。', status: 'unreviewed' })
    expect(records[0].interpretation).toBe(sourceEntry.interpretation)
  })

  it('surfaces write errors and leaves the edit form and previous stored state intact', async () => {
    const user = userEvent.setup()
    render(<ExperienceWorkbench data={fixture} />)
    await user.click(screen.getByRole('button', { name: '新增记录' }))
    const form = screen.getByRole('dialog', { name: '新增记录' })
    await user.type(within(form).getByLabelText('标题'), '不能静默丢失')
    await user.type(within(form).getByLabelText('原始内容'), '保存失败时保留输入。')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError') })
    await user.click(within(form).getByRole('button', { name: '保存记录' }))
    expect(screen.getByRole('alert')).toHaveTextContent('保存失败')
    expect(within(form).getByLabelText('原始内容')).toHaveValue('保存失败时保留输入。')
    expect(localStorage.getItem(KNOWLEDGE_STORAGE_KEY)).toBeNull()
  })

  it('shows data-backed horizon comparisons and source details', async () => {
    const user = userEvent.setup()
    render(<ExperienceWorkbench data={fixture} />)
    await user.click(screen.getByRole('tab', { name: '回测证据' }))
    expect(screen.getByText('经验规则代理尚未显示稳定优势。')).toBeInTheDocument()
    expect(screen.getByText('3.10%')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '未来 4 日' }))
    expect(screen.getByText('3.60%')).toBeInTheDocument()
    expect(screen.queryByText('4.30%')).not.toBeInTheDocument()
    expect(screen.getByText(/2025-09-16/)).toBeInTheDocument()
  })

  it('keeps invalid local records visible as an error and blocks accidental overwrite', async () => {
    localStorage.setItem(KNOWLEDGE_STORAGE_KEY, '{broken')
    render(<ExperienceWorkbench data={fixture} />)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('读取失败'))
    expect(screen.getByRole('button', { name: '新增记录' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '确认解释' }))
    expect(localStorage.getItem(KNOWLEDGE_STORAGE_KEY)).toBe('{broken')
  })
})
