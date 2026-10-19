// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { bindSource, codexCommand, compareExtractions, loadModels, locateEvidence, parseCodexBatch, parseCodexOutput, validateExtraction } from '../../../scripts/reextract-note-tags.mjs'
import { extract, extractDualModels } from '../../../scripts/note-tag-extraction.mjs'

const source = '当5日均线从下方向上穿越20日均线时，形成金叉。\n成交量温和放大时才确认。'
const tag = (tagId: string, quote = '形成金叉', startLine = 1, endLine = 1) => ({ tagId, quote, startLine, endLine, reason: '原文主要讨论金叉' })
const extraction = (tags = [tag('topic.ma5')]) => ({ tags, note: '只保留核心主题' })

describe('conservative independent model extraction', () => {
  it('returns explicitly single-model candidates when cloud Codex is disabled', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: JSON.stringify(extraction()) } }] }))
    vi.stubGlobal('fetch', fetchMock)
    try {
      const result = await extractDualModels([{ provider: 'api', model: 'deepseek-chat', baseUrl: 'https://api.test', apiKey: 'test' }, { provider: 'codex', model: 'unused', enabled: false }], source, { id: 'note:test.md', sourceHash: 'a'.repeat(64) })
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(result.models).toHaveLength(1)
      expect(result.candidate?.tags).toEqual(['topic.ma5'])
      expect(result.candidate?.extraction.models).toEqual(['DeepSeek · deepseek-chat'])
      expect(result.candidate?.extraction.disagreements).toEqual([])
    } finally { vi.unstubAllGlobals() }
  })
  it('reports missing cloud Codex configuration immediately instead of spawning an unavailable CLI', async () => {
    await expect(extract({ provider: 'codex', model: 'local-config-default', enabled: false }, source)).rejects.toThrow('CODEX_NOT_CONFIGURED')
  })
  it('accepts Windows checkout line endings but refuses actual source edits', () => {
    const expectedHash = createHash('sha256').update('第一行\n第二行\n').digest('hex')
    const bound = bindSource(Buffer.from('第一行\r\n第二行\r\n'), expectedHash)
    expect(bound.sourceHash).toBe(expectedHash)
    expect(bound.worktreeHash).not.toBe(expectedHash)
    expect(bound.source).toBe('第一行\n第二行\n')
    expect(() => bindSource(Buffer.from('第一行\r\n改过的第二行\r\n'), expectedHash)).toThrow('内容已变化')
  })
  it('accepts grounded core tags and allows abstention without placeholder labels', () => {
    expect(validateExtraction(extraction(), source).tags).toHaveLength(1)
    expect(validateExtraction(extraction([]), '![原图](image.png)').tags).toEqual([])
    expect(() => validateExtraction(extraction([tag('topic.unknown')]), source)).toThrow()
    expect(() => validateExtraction(extraction([tag('computability.direct')]), source)).toThrow()
  })
  it('rejects fabricated quotes, wrong line numbers and non-body evidence', () => {
    expect(() => validateExtraction(extraction([tag('topic.ma5', '原文未提到')]), source)).toThrow()
    expect(() => validateExtraction(extraction([tag('topic.ma5', '形成金叉', 2, 2)]), source)).toThrow()
    expect(() => validateExtraction(extraction([tag('topic.ma5', '形成金叉', 0, 1)]), source)).toThrow()
    expect(() => validateExtraction(extraction([tag('topic.ma5', 'MA5')]), '![MA5](image.png)')).toThrow()
    expect(() => validateExtraction(extraction([tag('topic.ma5', 'MA5', 2, 2)]), '---\ntitle: MA5\n---\n正文')).toThrow()
    expect(() => validateExtraction(extraction([tag('topic.ma5', 'MA5', 1, 4)]), '---\ntitle: MA5\n---\n正文')).toThrow('元数据')
    expect(() => validateExtraction(extraction([tag('topic.turtle', '海龟')]), '[海龟.m4a](../audio.m4a)')).toThrow()
    expect(validateExtraction(extraction([tag('purpose.risk', '下跌趋势')]), '![插图](image.png)下跌趋势应避免。').tags).toHaveLength(1)
    expect(() => validateExtraction(extraction([tag('purpose.risk', 'image.png')]), '![插图](image.png)下跌趋势应避免。')).toThrow('附件')
  })
  it('rejects redundant parents and more than one primary purpose', () => {
    expect(() => validateExtraction(extraction([tag('topic.ma5'), tag('topic.ma')]), source)).toThrow('上下位')
    expect(() => validateExtraction(extraction([tag('purpose.trend'), tag('purpose.screen')]), source)).toThrow('维度')
    expect(() => validateExtraction(extraction([tag('topic.ma5'), tag('topic.ma5')]), source)).toThrow()
  })
  it('can derive exact line numbers from unique quotations without accepting paraphrases', () => {
    const located = locateEvidence(extraction([tag('topic.ma5', '形成金叉', 2, 2)]), source)
    expect(located.lineNumbersCorrected).toBe(true)
    expect(validateExtraction(located, source).tags[0].startLine).toBe(1)
    expect(() => validateExtraction(locateEvidence(extraction([tag('topic.ma5', '出现金叉')]), source), source)).toThrow('引用无效')
    expect(locateEvidence(extraction([tag('topic.ma5', '重复', 9, 9)]), '重复\n重复').lineNumbersCorrected).toBe(false)
  })
  it('keeps model agreement, exposes disagreements, and never unions extra tags', () => {
    const result = compareExtractions(extraction([tag('topic.ma5'), tag('purpose.trend')]), extraction([tag('topic.ma5'), tag('topic.volume')]), ['topic.ma5', 'topic.ma', 'scope.unknown'])
    expect(result.tags).toEqual(['topic.ma5'])
    expect(result.onlyFirst).toEqual(['purpose.trend'])
    expect(result.onlySecond).toEqual(['topic.volume'])
    expect(result.removed).toEqual(['topic.ma', 'scope.unknown'])
    expect(result.needsReview).toBe(true)
    expect(compareExtractions(extraction([]), extraction([]), []).needsReview).toBe(true)
  })
  it('uses DeepSeek and local Codex and does not require an API key for Codex', () => {
    expect(loadModels({}).map(model => model.provider)).toEqual(['api', 'codex'])
    expect(loadModels({ AI_API_KEY: 'test' }).map(model => model.model)).toEqual(['deepseek-chat', 'local-config-default'])
    expect(loadModels({ STOCKCAL_CODEX_MODEL: 'local-model' })[1].model).toBe('local-model')
    expect(() => loadModels({ AI_API_KEY: 'test', STOCKCAL_AI_BASE_URL: 'https://user:password@example.com' })).toThrow('凭据')
  })
  it('reads structured Codex output and refuses failed turns or invalid quotes', () => {
    const events = (result: unknown) => [
      { type: 'thread.started', thread_id: 'test' },
      { type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify(result) } },
      { type: 'turn.completed', usage: { input_tokens: 123, output_tokens: 45 } },
    ].map(event => JSON.stringify(event)).join('\n')
    expect(parseCodexOutput(events(extraction()), source).tags).toHaveLength(1)
    expect(parseCodexOutput(events(extraction()), source).usage).toEqual({ input_tokens: 123, output_tokens: 45 })
    expect(() => parseCodexOutput('{"type":"turn.failed"}', source)).toThrow('未完成')
    expect(() => parseCodexOutput(events(extraction([tag('topic.ma5', '不存在的原文')])), source)).toThrow('引用无效')
  })
  it('invokes native executables without shell interpolation', () => {
    expect(codexCommand('/usr/bin/codex', {}, 'linux')).toEqual({ command: '/usr/bin/codex', args: [] })
    expect(codexCommand(undefined, {}, 'linux')).toEqual({ command: 'codex', args: [] })
    expect(codexCommand('some codex.js', {}, 'linux').command).toBe(process.execPath)
  })
  it('validates every batch item against its own file and refuses omissions or cross-file quotes', () => {
    const documents = [{ file: 'first.md', source }, { file: 'second.md', source: '仓位管理' }]
    const items = [{ file: 'first.md', ...extraction() }, { file: 'second.md', ...extraction([tag('topic.position', '仓位管理')]) }]
    const stream = (records: unknown) => JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify({ documents: records }) } })
    expect(parseCodexBatch(stream(items), documents).results).toHaveLength(2)
    expect(() => parseCodexBatch(stream([items[0]]), documents)).toThrow('缺少')
    expect(() => parseCodexBatch(stream([items[0], items[0]]), documents)).toThrow('重复')
    expect(() => parseCodexBatch(stream([items[0], { ...items[1], tags: [tag('topic.ma5')] }]), documents)).toThrow('引用无效')
  })
})
