import 'server-only'
import { assembleDualResult, bindSource, extract, loadModels } from '../../../scripts/note-tag-extraction.mjs'
import { getAIConfiguration } from '@/lib/ai-config'
import type { DualTagResult, NoteTagRecord } from '@/features/knowledge/note-tags'

export async function extractNoteTags(record: NoteTagRecord, fullText: string): Promise<DualTagResult> {
  const { source } = bindSource(Buffer.from(fullText), record.sourceHash)
  const config = getAIConfiguration()
  const models = loadModels({ AI_API_KEY: config.apiKey, STOCKCAL_AI_BASE_URL: config.baseUrl,
    STOCKCAL_AI_MODEL: config.tagModel || config.model, STOCKCAL_CODEX_MODEL: config.codexModel, STOCKCAL_CODEX_BIN: config.codexBin })
  const names = [`DeepSeek · ${models[0].model}`, `Codex · ${models[1].model === 'local-config-default' ? '本地配置' : models[1].model}`]
  const outcomes = await Promise.allSettled(models.map(model => extract(model, source)))
  return assembleDualResult(outcomes, names, { id: record.id, sourceHash: record.sourceHash })
}
