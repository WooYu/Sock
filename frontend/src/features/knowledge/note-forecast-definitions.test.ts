import { describe, expect, it } from 'vitest'
import { parseTagLedger, reviseTags, type NoteTagRecord } from './note-tags'
import { reviseForecastDefinition, type ForecastDefinition } from './note-forecast-definitions'
import { mergeSharedData } from '../records/shared-data-sync'
import { classifyNoteForForecast, forecastRegistryForRecords } from './note-forecast-classification'

const note: NoteTagRecord = {
  id: 'note:test', level: 'document', file: 'test.md', title: '测试笔记', sourceHash: 'a'.repeat(64),
  sourceUrl: 'https://example.com/test', sourceExcerpt: '均线向上', summary: '', tags: ['topic.ma'],
  evidence: [{ tagId: 'topic.ma', quote: '均线向上', startLine: 1, endLine: 1, method: 'manual', reason: '原文' }],
  gaps: [], version: 2, previousVersion: 1, status: 'reviewed', createdAt: '2026-10-25T00:00:00Z', revisionReason: '核对标签',
}
const draft: ForecastDefinition = { role: 'target', condition: '参考 BOLL 上轨', timeframe: '', scope: '', invalidation: '', openQuestions: '周期待补充', state: 'draft' }
const time = '2026-10-25T01:00:00Z'
const ledger = (record: NoteTagRecord) => JSON.stringify({ schemaVersion: 1, records: [record] })

describe('versioned forecast definitions', () => {
  it('reads old records and persists a draft without changing tag review or source data', () => {
    expect(parseTagLedger(ledger(note))[0].forecastDefinitions).toBeUndefined()
    const previous = JSON.stringify(note)
    const next = reviseForecastDefinition(note, draft, '补充压力参考', time)
    expect(next.version).toBe(3)
    expect(next.previousVersion).toBe(2)
    expect(next.status).toBe('reviewed')
    expect(next.sourceHash).toBe(note.sourceHash)
    expect(JSON.stringify(note)).toBe(previous)
    expect(parseTagLedger(ledger(next))[0].forecastDefinitions).toEqual([draft])
  })
  it('requires complete ready definitions and leaves validation to a separate process', () => {
    expect(() => reviseForecastDefinition(note, { ...draft, state: 'ready' }, '整理定义', time)).toThrow('适用周期')
    const complete = { ...draft, timeframe: '日线', scope: '上涨阶段', invalidation: '收盘跌破中轨', openQuestions: '', state: 'ready' as const }
    const next = reviseForecastDefinition(note, complete, '补齐条件', time)
    expect(next.forecastDefinitions?.[0].state).toBe('ready')
    expect(next.forecastDefinitions?.[0]).not.toHaveProperty('validated')
    expect(() => reviseForecastDefinition(note, { ...complete, openQuestions: '尚不明确' }, '补齐条件', time)).toThrow('待补问题')
  })
  it('rejects empty drafts, missing reasons, invalid roles and corrupted persisted values', () => {
    expect(() => reviseForecastDefinition(note, { ...draft, condition: '', openQuestions: '' }, '补充', time)).toThrow('至少')
    expect(() => reviseForecastDefinition(note, draft, ' ', time)).toThrow('修订说明')
    for (const value of [{ ...draft, role: 'unknown' }, { ...draft, role: ['target'] }, { ...draft, state: 'validated' }, { ...draft, condition: 7 }, { ...draft, state: 'ready' }]) {
      expect(() => parseTagLedger(ledger({ ...note, forecastDefinitions: [value] } as NoteTagRecord))).toThrow()
    }
    expect(() => parseTagLedger(ledger({ ...note, forecastDefinitions: [draft, draft] }))).toThrow()
  })
  it('replaces only the edited role and preserves definitions across later label revisions', () => {
    const first = reviseForecastDefinition(note, draft, '补充', time)
    const second = reviseForecastDefinition(first, { ...draft, role: 'context' }, '补充场景', time)
    const third = reviseForecastDefinition(second, { ...draft, condition: '修正参考' }, '修正', time)
    expect(third.forecastDefinitions).toHaveLength(2)
    expect(first.forecastDefinitions?.[0].condition).toBe(draft.condition)
    const tags = reviseTags(third, { tags: note.tags, evidence: note.evidence[0], reason: '调整说明' }, time)
    expect(tags.forecastDefinitions).toEqual(third.forecastDefinitions)
  })
  it('retains versioned definitions through shared merges without enabling forecast execution', () => {
    const next = reviseForecastDefinition(note, draft, '补充定义', time)
    const merged = mergeSharedData({ schemaVersion: 1, records: [note] }, { schemaVersion: 1, records: [next] })
    expect(parseTagLedger(JSON.stringify(merged))).toEqual([note, next])
    expect(classifyNoteForForecast(next, [])).not.toContainEqual(expect.objectContaining({ status: 'defined' }))
    expect(forecastRegistryForRecords([next], [])).toEqual([])
  })
})
