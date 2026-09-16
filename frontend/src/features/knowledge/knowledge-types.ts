export type ExperienceType = 'experience' | 'principle' | 'hint'

export interface ExperienceEntry {
  id: string
  version: number
  type: ExperienceType
  title: string
  originalText: string
  interpretation: string
  sourceType: 'github' | 'manual'
  status: 'unreviewed' | 'reviewed'
  scope: string[]
  stock?: string
  expiresOn?: string
  createdAt: string
  previousVersion?: number
  gaps: string[]
  caveats: string[]
  references: Array<{ file: string; startLine: number; endLine: number; quote: string; url: string }>
  researchTest?: string
}

export interface KnowledgePackage {
  generatedAt: string
  docCount: number
  sourceCommit: string
  sourceRepository: string
  entries: ExperienceEntry[]
  backtest: {
    start: string
    end: string
    sessions: number
    holdoutStart: string
    models: Array<{ horizon: number; id: string; label: string; mape: number; direction: number | null; samples: number }>
    findings: string[]
    methodology: string[]
    sourceQuality: string[]
  }
}

export interface ManualEntryDraft {
  type: ExperienceType
  title: string
  originalText: string
  interpretation: string
  stock?: string
  expiresOn?: string
  gaps?: string[]
  caveats?: string[]
  scope?: string[]
}

export const KNOWLEDGE_STORAGE_KEY = 'stockcal.knowledge.v1'
export const TYPE_LABELS: Record<ExperienceType, string> = { experience: '经验', principle: '交易原则', hint: '临时提示' }

export function shanghaiToday(now = new Date()): string {
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function isExpired(entry: ExperienceEntry, today: string): boolean {
  return entry.type === 'hint' && Boolean(entry.expiresOn && entry.expiresOn < today)
}

export function validateManualDraft(draft: ManualEntryDraft, today: string): Partial<Record<keyof ManualEntryDraft, string>> {
  const errors: Partial<Record<keyof ManualEntryDraft, string>> = {}
  if (!draft.title.trim()) errors.title = '请填写标题。'
  else if (draft.title.trim().length > 120) errors.title = '标题请控制在 120 字以内。'
  if (!draft.originalText.trim()) errors.originalText = '请保留原始经验或提示内容。'
  else if (draft.originalText.length > 20000) errors.originalText = '单条原文请控制在 20,000 字以内。'
  if (!Object.hasOwn(TYPE_LABELS, draft.type)) errors.type = '请选择记录类型。'
  if ((draft.stock?.length ?? 0) > 60) errors.stock = '股票名称或代码请控制在 60 字以内。'
  if (draft.type === 'hint' && draft.expiresOn) {
    if (!isDate(draft.expiresOn)) errors.expiresOn = '请填写有效日期。'
    else if (draft.expiresOn < today) errors.expiresOn = '有效期不能早于今天；历史提示仍可保留回看。'
  }
  return errors
}

export function createManualVersion(draft: ManualEntryDraft, id: string, createdAt: string, previous?: ExperienceEntry): ExperienceEntry {
  const errors = validateManualDraft(draft, shanghaiToday(new Date(createdAt)))
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0])
  if (previous && (previous.id !== id || previous.sourceType !== 'manual')) throw new Error('只能为同一手工记录建立新版本。')
  const interpretation = draft.interpretation.trim()
  const gaps = draft.gaps?.map((value) => value.trim()).filter(Boolean) ?? []
  return {
    id, version: previous ? previous.version + 1 : 1, type: draft.type,
    title: draft.title.trim(), originalText: draft.originalText.trim(), interpretation,
    sourceType: 'manual', status: 'unreviewed', createdAt,
    ...(previous ? { previousVersion: previous.version } : {}),
    ...(draft.stock?.trim() ? { stock: draft.stock.trim() } : {}),
    ...(draft.type === 'hint' && draft.expiresOn ? { expiresOn: draft.expiresOn } : {}),
    scope: [...(draft.scope ?? previous?.scope ?? [])],
    gaps: interpretation ? gaps : [...new Set(['尚未填写解释，原始内容暂不能计算。', ...gaps])],
    caveats: [...(draft.caveats ?? previous?.caveats ?? [])], references: [...(previous?.references ?? [])],
    ...(previous?.researchTest ? { researchTest: '旧版本研究仅供参照，当前版本需重新检验。' } : {}),
  }
}

export function reviseSourceInterpretation(previous: ExperienceEntry, revision: Pick<ManualEntryDraft, 'originalText' | 'interpretation' | 'gaps'>, createdAt: string): ExperienceEntry {
  if (previous.sourceType !== 'github') throw new Error('原文解释修正只适用于 GitHub 来源。')
  if (revision.originalText !== previous.originalText) throw new Error('来源原文不能修改；请仅修正解释和缺失定义。')
  if (!revision.interpretation.trim()) throw new Error('请填写修正后的解释。')
  return {
    ...previous, version: previous.version + 1, previousVersion: previous.version,
    createdAt, status: 'unreviewed', interpretation: revision.interpretation.trim(),
    gaps: revision.gaps?.map((gap) => gap.trim()).filter(Boolean) ?? [...previous.gaps],
    scope: [...previous.scope], caveats: [...previous.caveats], references: previous.references.map((reference) => ({ ...reference })),
    ...(previous.researchTest ? { researchTest: '旧版本研究仅供参照，当前版本需重新检验。' } : {}),
  }
}

export function reviewVersion(entry: ExperienceEntry, createdAt: string): ExperienceEntry {
  if (!entry.interpretation.trim()) throw new Error('请先填写或补充解释，再确认其含义。')
  if (entry.status === 'reviewed') throw new Error('当前版本的解释已经确认。')
  return { ...entry, version: entry.version + 1, previousVersion: entry.version, status: 'reviewed', createdAt,
    scope: [...entry.scope], gaps: [...entry.gaps], caveats: [...entry.caveats], references: [...entry.references] }
}

function isRecord(value: unknown): value is ExperienceEntry {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  const strings = ['id', 'title', 'originalText', 'interpretation', 'createdAt']
  if (!strings.every((key) => typeof record[key] === 'string')) return false
  if (!record.id || !record.title || !Number.isFinite(Date.parse(record.createdAt as string))) return false
  if (!Number.isInteger(record.version) || (record.version as number) < 1) return false
  if (!['experience', 'principle', 'hint'].includes(String(record.type))) return false
  if (!['github', 'manual'].includes(String(record.sourceType)) || !['unreviewed', 'reviewed'].includes(String(record.status))) return false
  if (!['scope', 'gaps', 'caveats'].every((key) => Array.isArray(record[key]) && (record[key] as unknown[]).every((item) => typeof item === 'string'))) return false
  if (record.previousVersion !== undefined && (!Number.isInteger(record.previousVersion) || record.previousVersion !== (record.version as number) - 1)) return false
  if (record.expiresOn !== undefined && (typeof record.expiresOn !== 'string' || !isDate(record.expiresOn))) return false
  if (record.stock !== undefined && typeof record.stock !== 'string') return false
  if (record.researchTest !== undefined && typeof record.researchTest !== 'string') return false
  return Array.isArray(record.references) && record.references.every((reference) => reference && typeof reference === 'object'
    && ['file', 'quote', 'url'].every((key) => typeof reference[key] === 'string')
    && Number.isInteger(reference.startLine) && reference.startLine >= 1 && Number.isInteger(reference.endLine) && reference.endLine >= reference.startLine)
}

export function parseLedger(raw: string | null): ExperienceEntry[] {
  if (raw === null) return []
  const ledger: unknown = JSON.parse(raw)
  if (!ledger || typeof ledger !== 'object' || !('schemaVersion' in ledger) || ledger.schemaVersion !== 1
    || !('records' in ledger) || !Array.isArray(ledger.records) || !ledger.records.every(isRecord)) {
    throw new Error('本地记录格式或版本无法识别，现有内容未被覆盖。')
  }
  const keys = ledger.records.map((entry) => `${entry.id}@${entry.version}`)
  if (new Set(keys).size !== keys.length) throw new Error('本地记录包含重复版本，现有内容未被覆盖。')
  return ledger.records
}

export function mergeVersions(initial: ExperienceEntry[], local: ExperienceEntry[]): ExperienceEntry[] {
  const versions = new Map<string, ExperienceEntry>()
  for (const entry of [...initial, ...local]) versions.set(`${entry.id}@${entry.version}`, entry)
  return [...versions.values()]
}

export function latestEntries(records: ExperienceEntry[]): ExperienceEntry[] {
  const latest = new Map<string, ExperienceEntry>()
  for (const record of records) if (!latest.has(record.id) || latest.get(record.id)!.version < record.version) latest.set(record.id, record)
  return [...latest.values()]
}
