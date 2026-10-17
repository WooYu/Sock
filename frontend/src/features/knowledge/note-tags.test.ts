import { describe, expect, it } from 'vitest'
import { currentTagRecords, filterTagRecords, parseTagLedger, reviseTags, reviewTags, type NoteTagRecord } from './note-tags'

export const taggedNote: NoteTagRecord = {
  id: 'note:选股总结.md', level: 'document', file: '选股总结.md', title: '选股总结',
  sourceHash: 'a'.repeat(64), sourceUrl: 'https://github.com/WooYu/Sock/blob/abc/notes/note.md',
  summary: '均线位置与候选过滤。', sourceExcerpt: '20日线和5日线以上的个股',
  tags: ['topic.ma5', 'topic.ma20', 'purpose.screen', 'computability.definition'],
  evidence: [{ tagId: 'topic.ma5', startLine: 6, endLine: 6, quote: '20日线和5日线以上的个股', method: 'dictionary', reason: '原文提到5日线。' },
    { tagId: 'topic.ma20', startLine: 6, endLine: 6, quote: '20日线和5日线以上的个股', method: 'dictionary', reason: '原文提到20日线。' },
    { tagId: 'purpose.screen', startLine: 6, endLine: 6, quote: '20日线和5日线以上的个股', method: 'catalog', reason: '旧目录分类；待核对。' },
    { tagId: 'computability.definition', startLine: 6, endLine: 6, quote: '20日线和5日线以上的个股', method: 'catalog', reason: '需补充定义。' }],
  gaps: ['沿着均线攀升尚缺定义。'], version: 1, status: 'candidate', createdAt: '2026-10-14T00:00:00Z',
  revisionReason: '自动候选标签',
}

describe('note tag revisions', () => {
  it('combines facet filters and searches tag labels without matching another stock by implication', () => {
    const other = { ...taggedNote, id: 'note:估值.md', title: '估值', tags: ['topic.valuation'] }
    expect(filterTagRecords([taggedNote, other], { query: 'MA5', facets: { purpose: 'purpose.screen' } })).toEqual([taggedNote])
    expect(filterTagRecords([taggedNote], { query: '掌阅科技' })).toEqual([])
    expect(filterTagRecords([taggedNote], { facets: { purpose: 'purpose.screen', topic: 'topic.valuation' } })).toEqual([])
  })

  it('appends a manual revision with evidence while preserving the original and its computation gaps', () => {
    const reviewed = reviewTags(taggedNote, '2026-10-14T01:00:00Z')
    const next = reviseTags(reviewed, {
      tags: [...reviewed.tags, 'timeframe.daily'], reason: '确认采用日线；仍需明确攀升条件。',
      evidence: { startLine: 6, endLine: 6, quote: taggedNote.sourceExcerpt },
    }, '2026-10-14T02:00:00Z')
    expect(next).toMatchObject({ version: 3, previousVersion: 2, status: 'candidate', sourceHash: taggedNote.sourceHash, sourceExcerpt: taggedNote.sourceExcerpt, gaps: taggedNote.gaps })
    expect(next.evidence.find((item) => item.tagId === 'timeframe.daily')).toMatchObject({ method: 'manual', quote: taggedNote.sourceExcerpt })
    expect(taggedNote.version).toBe(1)
    expect(taggedNote.tags).not.toContain('timeframe.daily')
    expect(next).not.toHaveProperty('tradingEnabled')
  })

  it('requires a reason and original evidence for new tags', () => {
    expect(() => reviseTags(taggedNote, { tags: ['topic.ma5'], reason: '', evidence: taggedNote.evidence[0] }, '2026-10-14T01:00:00Z')).toThrow('原因')
    expect(() => reviseTags(taggedNote, { tags: ['topic.ma5', 'timeframe.daily'], reason: '补充周期', evidence: { startLine: 6, endLine: 6, quote: '杜撰原文' } }, '2026-10-14T01:00:00Z')).toThrow('原文')
  })

  it('assigns a newly selected tag its own evidence when the picker returns a complete existing citation', () => {
    const next = reviseTags(taggedNote, { tags: [...taggedNote.tags, 'timeframe.weekly'], reason: '另按周线研究。', evidence: taggedNote.evidence[0] }, '2026-10-14T01:00:00Z')
    expect(next.evidence.find((evidence) => evidence.tagId === 'timeframe.weekly')?.quote).toBe(taggedNote.sourceExcerpt)
    expect(parseTagLedger(JSON.stringify({ schemaVersion: 1, records: [next] }))).toHaveLength(1)
  })

  it('rejects damaged storage and duplicate versions instead of replacing saved tags', () => {
    expect(parseTagLedger(null)).toEqual([])
    expect(parseTagLedger(JSON.stringify({ schemaVersion: 1, records: [taggedNote] }))).toEqual([taggedNote])
    expect(() => parseTagLedger('{bad')).toThrow()
    expect(() => parseTagLedger(JSON.stringify({ schemaVersion: 1, records: [taggedNote, taggedNote] }))).toThrow('重复')
    expect(() => parseTagLedger(JSON.stringify({ schemaVersion: 1, records: [{ ...taggedNote, tags: ['unknown.tag'] }] }))).toThrow()
  })

  it('does not apply annotations to changed source bytes and retains separate historical versions', () => {
    const edited = reviewTags(taggedNote, '2026-10-14T01:00:00Z')
    expect(currentTagRecords([taggedNote], [edited])[0].version).toBe(2)
    const refreshed = { ...taggedNote, sourceHash: 'b'.repeat(64) }
    expect(currentTagRecords([refreshed], [edited])[0]).toEqual(refreshed)
  })
})
