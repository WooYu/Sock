export type StudyQuote = { startLine: number; endLine: number; quote: string }
export type StudyClaim = { claimId: string; name: string; kind: string; formula: string | null; periods: string[]; inputs: string[]; applicability: string[]; invalidation: string[]; gaps: string[]; computability: 'direct' | 'needs_definition' | 'needs_data' | 'reference'; evaluationStatus: 'untested'; evidence: StudyQuote[] }
export type SemanticStudy = {
  file: string; sourceHash: string; sourceUrl: string; studyRevisionId: string; status: 'ai_candidate'; summary: string; tags: string[]; roles: string[]
  evidence: Array<StudyQuote & { tagId: string; reason: string }>; claims: StudyClaim[]; gaps: string[]; userRuleConflicts: string[]
  attachments: { present: boolean; status: 'none' | 'not_inspected'; note: string }; readCoverage: { fromLine: number; throughLine: number }
}
export type NoteStudyProposal = { sourceText: string; study: SemanticStudy }
export type StudyIndexEntry = { file: string; title: string; sourceHash: string; studyRevisionId: string; summary: string; tags: string[]; roles: string[]; claimCount: number; attachmentStatus: string }
export type NoteStudyIndex = { documentCount: number; claimCount: number; uninspectedAttachmentCount: number; entries: StudyIndexEntry[] }
