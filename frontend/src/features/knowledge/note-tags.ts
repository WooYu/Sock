export type TagDimension = 'kind' | 'topic' | 'purpose' | 'timeframe' | 'scope' | 'data' | 'computability'
export type TagEvidence = { tagId: string; startLine: number; endLine: number; quote: string; method: 'dictionary' | 'catalog' | 'manual'; reason: string }
export interface NoteTagRecord {
  id: string; level: 'document' | 'fragment'; file: string; title: string; parentId?: string
  sourceHash: string; sourceUrl: string; sourceExcerpt: string; summary: string
  tags: string[]; evidence: TagEvidence[]; gaps: string[]
  version: number; previousVersion?: number; status: 'candidate' | 'reviewed'; createdAt: string; revisionReason: string
}
export interface NoteCatalog {
  schemaVersion: number; generatedAt: string; sourceCommit: string; sourceRepository: string
  documents: NoteTagRecord[]; fragments: NoteTagRecord[]
  audit: { sourceQuotesRejected: number; legacyDocumentCount: number; addedFiles: string[]; rejectedQuotes: string[] }
}
export type TagRevisionDraft = { tags: string[]; reason: string; evidence: Pick<TagEvidence, 'startLine' | 'endLine' | 'quote'> }
import taxonomy from './note-tag-taxonomy.json'

export const TAG_DIMENSIONS = taxonomy as Array<{ id: TagDimension; label: string; options: Array<{ id: string; label: string }> }>
export const TAG_LABELS = Object.fromEntries(TAG_DIMENSIONS.flatMap((dimension) => dimension.options.map((tag) => [tag.id, tag.label]))) as Record<string, string>
export const NOTE_TAG_STORAGE_KEY = 'stockcal.note-tags.v1'
export const tagVersionKey = (record: NoteTagRecord) => `${record.id}@${record.sourceHash}@${record.version}`

export function mergeTagVersions(initial: NoteTagRecord[], local: NoteTagRecord[]): NoteTagRecord[] {
  return [...new Map([...initial, ...local].map((record) => [tagVersionKey(record), record])).values()]
}

export function currentTagRecords(initial: NoteTagRecord[], local: NoteTagRecord[]): NoteTagRecord[] {
  const current = new Map(initial.map((record) => [record.id, record]))
  for (const record of local) {
    const base = current.get(record.id)
    if (base && base.sourceHash === record.sourceHash && base.version < record.version
      && base.file === record.file && base.sourceExcerpt === record.sourceExcerpt) current.set(record.id, record)
  }
  return [...current.values()]
}

export function filterTagRecords(records: NoteTagRecord[], filters: { query?: string; facets?: Partial<Record<TagDimension, string>> }): NoteTagRecord[] {
  const query = filters.query?.trim().toLocaleLowerCase() ?? ''
  const tags = Object.values(filters.facets ?? {}).filter(Boolean)
  return records.filter((record) => tags.every((tag) => record.tags.includes(tag))
    && (!query || [record.file, record.title, record.summary, record.sourceExcerpt, ...record.tags.map((tag) => TAG_LABELS[tag] ?? tag)].join(' ').toLocaleLowerCase().includes(query)))
}

function isTagRecord(value: unknown): value is NoteTagRecord {
  if (!value || typeof value !== 'object') return false
  const r = value as Record<string, unknown>
  if (!['id', 'file', 'title', 'sourceHash', 'sourceUrl', 'sourceExcerpt', 'summary', 'createdAt', 'revisionReason'].every((key) => typeof r[key] === 'string')) return false
  if (!r.id || !/^[a-f0-9]{64}$/.test(String(r.sourceHash)) || !Number.isFinite(Date.parse(String(r.createdAt)))) return false
  if (!['document', 'fragment'].includes(String(r.level)) || !['candidate', 'reviewed'].includes(String(r.status))) return false
  if (!Number.isInteger(r.version) || (r.version as number) < 1 || (r.previousVersion !== undefined && r.previousVersion !== (r.version as number) - 1)) return false
  if (!Array.isArray(r.tags) || !r.tags.length || !r.tags.every((tag) => typeof tag === 'string' && Object.hasOwn(TAG_LABELS, tag)) || new Set(r.tags).size !== r.tags.length) return false
  if (!Array.isArray(r.gaps) || !r.gaps.every((gap) => typeof gap === 'string') || !Array.isArray(r.evidence)) return false
  if (!r.evidence.every((e) => e && typeof e === 'object' && typeof e.tagId === 'string' && Object.hasOwn(TAG_LABELS, e.tagId)
    && typeof e.quote === 'string' && e.quote.trim() && typeof e.reason === 'string' && e.reason.trim()
    && ['dictionary', 'catalog', 'manual'].includes(e.method) && Number.isInteger(e.startLine) && e.startLine >= 1 && Number.isInteger(e.endLine) && e.endLine >= e.startLine)) return false
  return r.tags.every((tag) => (r.evidence as TagEvidence[]).some((e) => e.tagId === tag))
}

export function parseTagLedger(raw: string | null): NoteTagRecord[] {
  if (raw === null) return []
  const ledger: unknown = JSON.parse(raw)
  if (!ledger || typeof ledger !== 'object' || !('schemaVersion' in ledger) || ledger.schemaVersion !== 1
    || !('records' in ledger) || !Array.isArray(ledger.records) || !ledger.records.every(isTagRecord)) throw new Error('标签记录格式损坏或版本不支持，原有记录未被覆盖。')
  const keys = ledger.records.map(tagVersionKey)
  if (new Set(keys).size !== keys.length) throw new Error('标签记录包含重复版本，原有记录未被覆盖。')
  return ledger.records
}

export function reviseTags(previous: NoteTagRecord, draft: TagRevisionDraft, createdAt: string): NoteTagRecord {
  if (!draft.reason.trim()) throw new Error('请填写修订原因。')
  const tags = [...new Set(draft.tags)]
  if (!tags.length || !tags.every((tag) => Object.hasOwn(TAG_LABELS, tag))) throw new Error('请选择有效标签。')
  const added = tags.filter((tag) => !previous.tags.includes(tag))
  if (added.length && !previous.evidence.some((e) => e.startLine === draft.evidence.startLine && e.endLine === draft.evidence.endLine && e.quote === draft.evidence.quote)) throw new Error('新增标签必须引用已有原文证据。')
  const evidence = previous.evidence.filter((e) => tags.includes(e.tagId)).map((e) => ({ ...e }))
  for (const tagId of added) evidence.push({ tagId, startLine: draft.evidence.startLine, endLine: draft.evidence.endLine,
    quote: draft.evidence.quote, method: 'manual', reason: draft.reason.trim() })
  return { ...previous, tags, evidence, gaps: [...previous.gaps], status: 'candidate', version: previous.version + 1,
    previousVersion: previous.version, createdAt, revisionReason: draft.reason.trim() }
}

export function reviewTags(previous: NoteTagRecord, createdAt: string): NoteTagRecord {
  if (previous.status === 'reviewed') throw new Error('标签已核对。')
  return { ...previous, tags: [...previous.tags], evidence: previous.evidence.map((e) => ({ ...e })), gaps: [...previous.gaps],
    status: 'reviewed', version: previous.version + 1, previousVersion: previous.version, createdAt, revisionReason: '人工核对标签；不代表效果已验证。' }
}
