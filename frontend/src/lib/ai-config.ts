import 'server-only'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseEnv } from 'node:util'

// Next.js loads frontend/.env.local; allow the same root fallback as notes:retag.
export function getAIConfiguration() {
  const config: Record<string, string> = {}
  for (const file of [resolve(process.cwd(), '../.env.local'), resolve(process.cwd(), '.env.local')]) {
    if (existsSync(file)) Object.assign(config, parseEnv(readFileSync(file, 'utf8')))
  }
  return {
    apiKey: process.env.AI_API_KEY ?? config.AI_API_KEY,
    baseUrl: process.env.STOCKCAL_AI_BASE_URL ?? config.STOCKCAL_AI_BASE_URL ?? 'https://api.deepseek.com',
    model: process.env.STOCKCAL_AI_MODEL ?? config.STOCKCAL_AI_MODEL ?? 'deepseek-chat',
    tagModel: process.env.STOCKCAL_TAG_MODEL_1 ?? config.STOCKCAL_TAG_MODEL_1,
    codexModel: process.env.STOCKCAL_CODEX_MODEL ?? config.STOCKCAL_CODEX_MODEL ?? 'local-config-default',
    codexBin: process.env.STOCKCAL_CODEX_BIN ?? config.STOCKCAL_CODEX_BIN,
  }
}
