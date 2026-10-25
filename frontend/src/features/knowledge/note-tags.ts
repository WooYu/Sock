export type TagDimension = 'kind' | 'topic' | 'purpose' | 'timeframe' | 'scope' | 'data' | 'computability'
export type TagEvidence = { tagId: string; startLine: number; endLine: number; quote: string; method: 'dictionary' | 'catalog' | 'manual' | 'ai'; reason: string }
export type SourceReference = Pick<TagEvidence, 'startLine' | 'endLine' | 'quote'>
export type TagExtraction = { models: string[]; note: string; disagreements: Array<{ tagId: string; model: string }>; generatedAt?: string; promptHash?: string }
export type AIOriginalTags = { id: string; sourceHash: string; tags: string[]; evidence: TagEvidence[]; extraction: TagExtraction }
export type DualTagResult = {
  id: string; sourceHash: string
  models: Array<{ name: string; tags?: string[]; evidence?: TagEvidence[]; note?: string; error?: string }>
  candidate: AIOriginalTags | null
}
export interface NoteTagRecord {
  supplement?: string; supplementEvidence?: SupplementEvidence[]
  sourceReferences?: SourceReference[]; extraction?: TagExtraction
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
export type SupplementEvidence = { tagId: string; quote: string; reason: string }
export type TagSuggestion = SupplementEvidence & { action: 'add' | 'remove'; conflict: string }
export type TagRevisionDraft = { tags: string[]; reason: string; evidence: Pick<TagEvidence, 'startLine' | 'endLine' | 'quote'>; supplement?: string; supplementEvidence?: SupplementEvidence[] }
import taxonomy from './note-tag-taxonomy.json'
import legacyTaxonomy from './note-tag-taxonomy-legacy.json'
import noteTitles from './note-titles.json'

function localizedTitle(record: NoteTagRecord): NoteTagRecord {
  const title = (noteTitles as Record<string, string>)[record.file]
  return title && record.title === record.file.replace(/\.md$/, '') ? { ...record, title } : record
}

// Retain retired labels for historical records, but exclude them from active controls.
export const TAG_DIMENSIONS = taxonomy as Array<{ id: TagDimension; label: string; options: Array<{ id: string; label: string }> }>
export const LEGACY_TAG_DIMENSIONS = legacyTaxonomy as typeof TAG_DIMENSIONS
export const TAG_LABELS = Object.fromEntries([...legacyTaxonomy, ...taxonomy].flatMap((dimension) => dimension.options.map((tag) => [tag.id, tag.label]))) as Record<string, string>
export const ACTIVE_TAG_LABELS = Object.fromEntries(TAG_DIMENSIONS.flatMap(dimension => dimension.options.map(tag => [tag.id, tag.label]))) as Record<string, string>
const TAG_ALIASES: Record<string, string> = {
  'kind.formula': 'topic.formula', 'purpose.screen': 'kind.screen', 'purpose.explain': 'kind.review',
  'purpose.risk': 'topic.risk', 'topic.ma5': 'topic.ma', 'topic.ma10': 'topic.ma', 'topic.ma20': 'topic.ma',
}
const activeTagId = (id: string): string | null => Object.hasOwn(ACTIVE_TAG_LABELS, id) ? id : TAG_ALIASES[id] ?? null

/** Project old IDs into the current vocabulary without rewriting stored versions or source evidence. */
export function activeTagRecord(record: NoteTagRecord): NoteTagRecord {
  const tags = [...new Set(record.tags.flatMap(id => activeTagId(id) ?? []))]
  const convertEvidence = <T extends { tagId: string }>(items: T[]) => items.flatMap(item => {
    const tagId = activeTagId(item.tagId)
    return tagId ? [{ ...item, tagId }] : []
  })
  return { ...record, tags, evidence: convertEvidence(record.evidence),
    sourceReferences: [...new Map([...(record.sourceReferences ?? []), ...record.evidence].map(({ startLine, endLine, quote }) => [JSON.stringify([startLine, endLine, quote]), { startLine, endLine, quote }])).values()],
    supplementEvidence: record.supplementEvidence ? convertEvidence(record.supplementEvidence) : undefined,
    extraction: record.extraction ? { ...record.extraction, disagreements: [...new Map(convertEvidence(record.extraction.disagreements).map(item => [JSON.stringify([item.tagId, item.model]), item])).values()] } : undefined,
    status: record.tags.join('|') === tags.join('|') ? record.status : 'candidate' }
}
export const NOTE_TAG_STORAGE_KEY = 'stockcal.note-tags.v1'
export const tagVersionKey = (record: NoteTagRecord) => `${record.id}@${record.sourceHash}@${record.version}`

export function applyAIOriginalTags(catalog: NoteCatalog, results: AIOriginalTags[]): NoteCatalog {
  return { ...catalog, documents: catalog.documents.map(record => {
    const result = results.find(item => item.id === record.id && item.sourceHash === record.sourceHash)
    if (!result) return record
    const sourceReferences = [...new Map(record.evidence.map(({ startLine, endLine, quote }) => [JSON.stringify([startLine, endLine, quote]), { startLine, endLine, quote }])).values()]
    return { ...record, tags: [...result.tags], evidence: result.evidence.map(item => ({ ...item })), sourceReferences, extraction: result.extraction,
      status: 'candidate' as const, revisionReason: 'DeepSeek 与本地 Codex 从原文独立提取，仅保留一致的核心标签；分歧待核对。' }
  }) }
}

export function mergeTagVersions(initial: NoteTagRecord[], local: NoteTagRecord[]): NoteTagRecord[] {
  return [...new Map([...initial, ...local].map((record) => [tagVersionKey(record), record])).values()].map(localizedTitle)
}

export function currentTagRecords(initial: NoteTagRecord[], local: NoteTagRecord[]): NoteTagRecord[] {
  const current = new Map(initial.map((record) => [record.id, record]))
  for (const record of local) {
    const base = current.get(record.id)
    if (base && base.sourceHash === record.sourceHash && base.version < record.version
      && base.file === record.file && base.sourceExcerpt === record.sourceExcerpt) current.set(record.id, record)
  }
  return [...current.values()].map(localizedTitle)
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
  if (!Array.isArray(r.tags) || (!r.tags.length && r.status !== 'candidate') || !r.tags.every((tag) => typeof tag === 'string' && Object.hasOwn(TAG_LABELS, tag)) || new Set(r.tags).size !== r.tags.length) return false
  if (!Array.isArray(r.gaps) || !r.gaps.every((gap) => typeof gap === 'string') || !Array.isArray(r.evidence)) return false
  if (!r.evidence.every((e) => e && typeof e === 'object' && typeof e.tagId === 'string' && Object.hasOwn(TAG_LABELS, e.tagId)
    && typeof e.quote === 'string' && e.quote.trim() && typeof e.reason === 'string' && e.reason.trim()
    && ['dictionary', 'catalog', 'manual', 'ai'].includes(e.method) && Number.isInteger(e.startLine) && e.startLine >= 1 && Number.isInteger(e.endLine) && e.endLine >= e.startLine)) return false
  if (r.sourceReferences !== undefined && (!Array.isArray(r.sourceReferences) || !r.sourceReferences.every((e) => e && typeof e.quote === 'string' && e.quote.trim() && Number.isInteger(e.startLine) && e.startLine >= 1 && Number.isInteger(e.endLine) && e.endLine >= e.startLine))) return false
  if (r.extraction !== undefined) {
    const extraction = r.extraction as TagExtraction
    if (!extraction || !Array.isArray(extraction.models) || !extraction.models.every(model => typeof model === 'string') || typeof extraction.note !== 'string' || !Array.isArray(extraction.disagreements) || !extraction.disagreements.every(item => item && Object.hasOwn(TAG_LABELS, item.tagId) && typeof item.model === 'string')) return false
  }
  if (r.supplement !== undefined && typeof r.supplement !== 'string') return false
  if (r.supplementEvidence !== undefined && (!Array.isArray(r.supplementEvidence) || !r.supplementEvidence.every((e) => e && typeof e.tagId === 'string' && Object.hasOwn(TAG_LABELS, e.tagId) && typeof e.quote === 'string' && e.quote.trim() && typeof e.reason === 'string' && e.reason.trim() && typeof r.supplement === 'string' && r.supplement.includes(e.quote)))) return false
  return r.tags.every((tag) => (r.evidence as TagEvidence[]).some((e) => e.tagId === tag) || (r.supplementEvidence as SupplementEvidence[] | undefined)?.some((e) => e.tagId === tag))
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
  if (!tags.every((tag) => Object.hasOwn(ACTIVE_TAG_LABELS, tag))) throw new Error('请选择有效标签。')
  const added = tags.filter((tag) => !previous.tags.includes(tag))
  const supplement = (draft.supplement ?? previous.supplement ?? '').trim()
  const supplementEvidence = (draft.supplementEvidence ?? previous.supplementEvidence ?? []).filter((e) => tags.includes(e.tagId)).map((e) => ({ ...e }))
  if (supplementEvidence.some((e) => !Object.hasOwn(TAG_LABELS, e.tagId) || !e.quote.trim() || !supplement.includes(e.quote) || !e.reason.trim())) throw new Error('补充说明依据已变化，请重新生成并确认建议。')
  const sourceAdded = added.filter((tag) => !supplementEvidence.some((e) => e.tagId === tag))
  if (sourceAdded.length && ![...previous.evidence, ...(previous.sourceReferences ?? [])].some((e) => e.startLine === draft.evidence?.startLine && e.endLine === draft.evidence?.endLine && e.quote === draft.evidence?.quote)) throw new Error('新增标签必须引用已有原文证据。')
  const evidence = previous.evidence.filter((e) => tags.includes(e.tagId)).map((e) => ({ ...e }))
  for (const tagId of sourceAdded) evidence.push({ tagId, startLine: draft.evidence.startLine, endLine: draft.evidence.endLine,
    quote: draft.evidence.quote, method: 'manual', reason: draft.reason.trim() })
  return { ...previous, tags, evidence, supplement, supplementEvidence, gaps: [...previous.gaps], status: 'candidate', version: previous.version + 1,
    previousVersion: previous.version, createdAt, revisionReason: draft.reason.trim() }
}

export function reviewTags(previous: NoteTagRecord, createdAt: string): NoteTagRecord {
  if (!previous.tags.length) throw new Error('尚无可确认标签，请先核对原文或补充说明。')
  if (previous.status === 'reviewed') throw new Error('标签已核对。')
  return { ...previous, tags: [...previous.tags], evidence: previous.evidence.map((e) => ({ ...e })), gaps: [...previous.gaps],
    status: 'reviewed', version: previous.version + 1, previousVersion: previous.version, createdAt, revisionReason: '人工核对标签；不代表效果已验证。' }
}
