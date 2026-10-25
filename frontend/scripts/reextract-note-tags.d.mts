export type ExtractionTag = { tagId: string; quote: string; startLine: number; endLine: number; reason: string }
export type Extraction = { tags: ExtractionTag[]; note: string }
export const PROMPT: string
export function bindSource(bytes: Uint8Array, expectedHash: string): { source: string; sourceHash: string; worktreeHash: string }
export function validateExtraction(value: unknown, source: string): Extraction
export function locateEvidence(value: Extraction, source: string): Extraction & { lineNumbersCorrected: boolean }
export function compareExtractions(first: Extraction, second: Extraction, oldTags: string[]): { tags: string[]; evidence: Array<ExtractionTag & { method: string }>; onlyFirst: string[]; onlySecond: string[]; removed: string[]; added: string[]; needsReview: boolean }
export function loadModels(env: Record<string, string | undefined>): Array<{ provider: string; model: string; baseUrl?: string; apiKey?: string; bin?: string }>
export function codexCommand(bin?: string, env?: Record<string, string | undefined>, platform?: string): { command: string; args: string[] }
export function parseCodexOutput(stdout: string, source: string): Extraction & { usage: unknown }
export function parseCodexBatch(stdout: string, documents: Array<{ file: string; source: string }>): { results: Array<{ file: string; result: Extraction }>; usage: unknown }
import type { AIOriginalTags, NoteCatalog } from '../src/features/knowledge/note-tags'
export function publishExtractions(report: unknown, catalog: NoteCatalog): { schemaVersion: number; generatedAt: string; promptHash: string; models: string[]; records: AIOriginalTags[] }
