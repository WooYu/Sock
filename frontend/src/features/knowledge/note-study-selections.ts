import type { NoteStudyRevision } from '../scenario/scenario-record-types'
export const NOTE_STUDY_SELECTION_KEY = 'stockcal.note-study-selections.v1'
export type StudySelection = { revisionId: string; sourceFile: string; sourceHash: string; channel: string; selectedAt: string }
type Ledger = { schemaVersion: 1; scopes: Record<string, StudySelection[]> }
function read(): Ledger {
  const raw = localStorage.getItem(NOTE_STUDY_SELECTION_KEY)
  if (!raw) return { schemaVersion: 1, scopes: {} }
  const data = JSON.parse(raw) as Ledger
  if (data?.schemaVersion !== 1 || !data.scopes || Array.isArray(data.scopes)) throw new Error('研究选择记录损坏，原值已保留')
  for (const values of Object.values(data.scopes)) if (!Array.isArray(values) || values.some(v => !/^[a-f0-9-]{36}$/i.test(v.revisionId) || !/^[a-f0-9]{64}$/.test(v.sourceHash) || !v.sourceFile || !v.channel || !Number.isFinite(Date.parse(v.selectedAt)))) throw new Error('研究选择版本无效，原值已保留')
  return data
}
export function loadStudySelections(identityScope: string): StudySelection[] { return structuredClone(read().scopes[identityScope] ?? []) }
export function saveStudySelection(identityScope: string, revision: NoteStudyRevision): StudySelection[] {
  if (!identityScope || !/^[a-f0-9-]{36}$/i.test(revision.id) || !/^[a-f0-9]{64}$/.test(revision.sourceHash) || !revision.sourceFile || !revision.channel) throw new Error('请先保存并核对服务器研究回执')
  const ledger = read(), previous = ledger.scopes[identityScope] ?? []
  ledger.scopes[identityScope] = [...previous.filter(v => v.sourceFile !== revision.sourceFile || v.channel !== revision.channel),
    { revisionId: revision.id, sourceFile: revision.sourceFile, sourceHash: revision.sourceHash, channel: revision.channel, selectedAt: new Date().toISOString() }]
  localStorage.setItem(NOTE_STUDY_SELECTION_KEY, JSON.stringify(ledger)); return loadStudySelections(identityScope)
}
