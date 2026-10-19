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

export type ExtractionModel = { provider: string; model: string; baseUrl?: string; apiKey?: string; bin?: string }
export function extract(model: ExtractionModel, source: string): Promise<Extraction>
export function extractDualModels(models: ExtractionModel[], source: string, identity: { id: string; sourceHash: string }): Promise<import('../src/features/knowledge/note-tags').DualTagResult>
export function assembleDualResult(outcomes: PromiseSettledResult<Extraction>[], names: string[], identity: { id: string; sourceHash: string }): import('../src/features/knowledge/note-tags').DualTagResult
export function extractCodexBatch(model: ExtractionModel, documents: Array<{file: string; source: string}>): Promise<{results: Array<{file: string; result: Extraction}>; usage: unknown}>
