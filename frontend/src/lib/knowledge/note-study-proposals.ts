import 'server-only'
import seedData from '@/server/note-study-seed.json'
import noteTitles from '@/features/knowledge/note-titles.json'
import type { NoteStudyIndex, NoteStudyProposal } from '@/features/knowledge/note-study-types'
import type { NoteBindingInput, StudyImport } from '@/features/scenario/scenario-record-types'

const seed = seedData as unknown as { index: NoteStudyIndex; records: NoteStudyProposal[] }
const byFile = new Map(seed.records.map(record => [record.study.file, record]))
export function listProposals(): NoteStudyIndex {
  return { ...seed.index, entries: seed.index.entries.map(entry => ({ ...entry, title: (noteTitles as Record<string, string>)[entry.file] ?? entry.title })) }
}
export function getProposal(file: string): NoteStudyProposal | null { return byFile.get(file) ?? null }
export function legacyStudyImport(binding: NoteBindingInput): StudyImport | null {
  const key = binding.legacyKey, version = binding.inlineVersion
  if (!key || !version || binding.revisionId || key.legacyRecordId !== version.id || key.level !== version.level || key.tagVersion !== version.version
    || key.sourceHash !== version.sourceHash || binding.sourceHash !== version.sourceHash || key.channel !== 'legacy') return null
  const original = getProposal(version.file)
  if (!original || original.study.sourceHash !== version.sourceHash) return null
  return { sourceFile: version.file, sourceHash: version.sourceHash, sourceText: original.sourceText, sourceUrl: version.sourceUrl, channel: 'legacy', parentRevisionId: null,
    legacyKey: key, payload: { ...version } }
}
