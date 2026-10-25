import { createHash } from 'node:crypto'
import { readFileSync, existsSync, mkdirSync, writeFileSync, renameSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { homedir } from 'node:os'
import { parseEnv } from 'node:util'
import { fileURLToPath } from 'node:url'
import { PROMPT, bindSource, validateExtraction, compareExtractions, loadModels, extract, extractCodexBatch } from './note-tag-extraction.mjs'
export { PROMPT, bindSource, validateExtraction, locateEvidence, compareExtractions, loadModels, codexCommand, EXTRACTION_SCHEMA, parseCodexOutput, parseCodexBatch, extract, extractCodexBatch } from './note-tag-extraction.mjs'
const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = resolve(frontend, '..')
const hash = value => createHash('sha256').update(value).digest('hex')

function saveReport(destination, report) {
  mkdirSync(dirname(destination), { recursive: true })
  writeFileSync(`${destination}.tmp`, JSON.stringify(report, null, 2) + '\n')
  renameSync(`${destination}.tmp`, destination)
}

export function publishExtractions(report, catalog) {
  if (report.schemaVersion !== 1 || report.records.length !== catalog.documents.length) throw new Error('只有全部整篇笔记完成双模型提取后才能发布')
  const models = report.models.map(item => item.provider === 'codex' ? `Codex · ${item.configuredModel || item.model}` : `DeepSeek · ${item.model}`)
  const records = catalog.documents.map(document => {
    const item = report.records.find(record => record.id === document.id && record.sourceHash === document.sourceHash)
    if (!item || !item.comparison || item.results.length !== 2 || item.results.some(result => !result.result)) throw new Error(`尚未完成双模型核对：${document.file}`)
    const { source } = bindSource(readFileSync(resolve(root, 'notes', document.file)), document.sourceHash)
    item.results.forEach(result => validateExtraction(result.result, source))
    const comparison = compareExtractions(item.results[0].result, item.results[1].result, document.tags)
    return { id: document.id, sourceHash: document.sourceHash, tags: comparison.tags, evidence: comparison.evidence,
      extraction: { models, note: item.results.map((result, i) => `${models[i]}：${result.result.note}`).join('\n'), disagreements: [
        ...comparison.onlyFirst.map(tagId => ({ tagId, model: models[0] })), ...comparison.onlySecond.map(tagId => ({ tagId, model: models[1] })),
      ] },
    }
  })
  return { schemaVersion: 1, generatedAt: report.generatedAt, promptHash: report.promptHash, models, records }
}

export async function main(args = process.argv.slice(2)) {
  // Existing process settings win; frontend settings override root fallbacks.
  const config = {}
  for (const envFile of [resolve(root, '.env.local'), resolve(frontend, '.env.local')]) {
    if (existsSync(envFile)) Object.assign(config, parseEnv(readFileSync(envFile, 'utf8')))
  }
  for (const [key, value] of Object.entries(config)) if (process.env[key] === undefined) process.env[key] = value
  const models = loadModels(process.env)
  const catalog = JSON.parse(readFileSync(resolve(frontend, 'src/features/knowledge/note-tag-catalog.json'), 'utf8'))
  let destination = resolve(root, '.planning/tag-reextract/deepseek-codex.json'), limit = Infinity, file, batchSize = 6, only = 'both', mergeFile, publish = false
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' && args[i + 1]) destination = resolve(args[++i])
    else if (args[i] === '--file' && args[i + 1]) file = args[++i]
    else if (args[i] === '--limit' && args[i + 1]) { limit = Number(args[++i]); if (!Number.isInteger(limit) || limit < 1) throw new Error('--limit 必须是正整数') }
    else if (args[i] === '--codex-batch-size' && args[i + 1]) { batchSize = Number(args[++i]); if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 12) throw new Error('--codex-batch-size 必须是 1–12') }
    else if (args[i] === '--only' && args[i + 1]) { only = args[++i]; if (!['both', 'deepseek', 'codex'].includes(only)) throw new Error('--only 必须为 both/deepseek/codex') }
    else if (args[i] === '--merge' && args[i + 1]) mergeFile = resolve(args[++i])
    else if (args[i] === '--publish') publish = true
    else throw new Error(`未知或缺少参数：${args[i]}`)
  }
  const documents = catalog.documents.filter(record => !file || record.file === file).slice(0, limit)
  if (!documents.length) throw new Error('没有匹配的笔记')
  const codexConfig = resolve(process.env.CODEX_HOME || resolve(homedir(), '.codex'), 'config.toml')
  const codexConfigText = existsSync(codexConfig) ? readFileSync(codexConfig, 'utf8') : ''
  const configuredModel = codexConfigText.split(/^\s*\[/m)[0].match(/^\s*model\s*=\s*"([^"\r\n]+)"/m)?.[1]
  const identity = { promptHash: hash(PROMPT), models: models.map(({ provider, model, baseUrl }) => ({ provider, model, ...(baseUrl ? { baseUrl } : { configuredModel: configuredModel || 'unknown', configHash: hash(codexConfigText) }) })) }
  let report = { schemaVersion: 1, ...identity, generatedAt: new Date().toISOString(), records: [], summary: {} }
  if (existsSync(destination)) {
    report = JSON.parse(readFileSync(destination, 'utf8'))
    if (report.schemaVersion !== 1 || report.promptHash !== identity.promptHash || JSON.stringify(report.models) !== JSON.stringify(identity.models)) throw new Error('已有比较文件的模型或提示词不同，请指定新的 --output 文件')
  }
  if (mergeFile) {
    if (mergeFile === destination) throw new Error('不能将报告合并到自身')
    const imported = JSON.parse(readFileSync(mergeFile, 'utf8'))
    if (imported.schemaVersion !== 1 || imported.promptHash !== identity.promptHash || JSON.stringify(imported.models) !== JSON.stringify(identity.models)) throw new Error('不能合并模型或提示词不同的报告')
    for (const incoming of imported.records) {
      const previous = report.records.find(record => record.id === incoming.id && record.sourceHash === incoming.sourceHash)
      if (previous) previous.results = models.map((_, i) => previous.results[i]?.result ? previous.results[i] : incoming.results[i])
      else report.records.push(incoming)
    }
    report.codexBatches = [...new Map([...(report.codexBatches ?? []), ...(imported.codexBatches ?? [])].map(batch => [batch.id, batch])).values()]
  }
  const persist = () => {
    const completed = report.records.filter(item => item.comparison)
    report.generatedAt = new Date().toISOString()
    report.summary = { completed: completed.length, failed: report.records.length - completed.length, perModelCompleted: models.map((model, i) => ({ provider: model.provider, model: model.model, completed: report.records.filter(item => item.results[i]?.result).length })), oldTags: completed.reduce((sum, item) => sum + item.oldTags.length, 0), proposedTags: completed.reduce((sum, item) => sum + item.comparison.tags.length, 0), needsReview: completed.filter(item => item.comparison.needsReview).length }
    saveReport(destination, report)
  }
  const inputs = documents.map(document => {
    try { return { ...document, ...bindSource(readFileSync(resolve(root, 'notes', document.file)), document.sourceHash) } }
    catch { throw new Error(`原文已变化，请先核对目录来源：${document.file}`) }
  })
  const pendingCodex = inputs.filter(document => !report.records.some(record => record.id === document.id && record.sourceHash === document.sourceHash && record.results[1]?.result))
  for (let offset = 0; offset < pendingCodex.length && batchSize > 1 && only !== 'deepseek'; offset += batchSize) {
    const batch = pendingCodex.slice(offset, offset + batchSize)
    try {
      const extracted = await extractCodexBatch(models[1], batch)
      const batchId = hash(JSON.stringify(batch.map(document => [document.file, document.sourceHash]))).slice(0, 16)
      report.codexBatches = [...(report.codexBatches ?? []), { id: batchId, files: batch.map(document => document.file), usage: extracted.usage }]
      for (const document of batch) {
        const previous = report.records.find(record => record.id === document.id && record.sourceHash === document.sourceHash)
        const record = { id: document.id, file: document.file, sourceHash: document.sourceHash, worktreeHash: document.worktreeHash, oldTags: document.tags,
          results: [previous?.results[0] ?? { provider: 'api', model: models[0].model, error: 'DeepSeek 尚未提取' }, { provider: 'codex', model: models[1].model, batchId, result: extracted.results.find(item => item.file === document.file).result }],
        }
        report.records = [...report.records.filter(existing => existing.id !== record.id), record]
      }
      persist()
      console.log(`Codex 已提取 ${batch.length} 篇：${batch.map(document => document.file).join('、')}`)
    } catch (error) { console.log(`Codex 批次未完成，将逐篇重试：${error.message}`) }
  }
  let nextDocument = 0
  await Promise.all(Array.from({ length: Math.min(only === 'codex' ? 1 : 3, documents.length) }, async () => {
    while (nextDocument < documents.length) {
    const document = documents[nextDocument++]
    const bytes = readFileSync(resolve(root, 'notes', document.file))
    let bound
    try { bound = bindSource(bytes, document.sourceHash) } catch { throw new Error(`原文已变化，请先核对目录来源：${document.file}`) }
    const { source, sourceHash, worktreeHash } = bound
    const cached = report.records.find(record => record.id === document.id && record.sourceHash === sourceHash)
    const results = await Promise.allSettled(models.map(async (model, index) => {
      if (cached?.results[index]?.result) {
        validateExtraction(cached.results[index].result, source)
        return cached.results[index].result
      }
      if ((only === 'deepseek' && index === 1) || (only === 'codex' && index === 0)) throw new Error('本次仅提取另一侧，等待续跑或合并')
      return extract(model, source)
    }))
    const record = { id: document.id, file: document.file, sourceHash, worktreeHash, oldTags: document.tags, results: results.map((result, i) => ({ provider: models[i].provider, model: models[i].model, ...(result.status === 'fulfilled' ? { result: result.value } : { error: result.reason instanceof Error ? result.reason.message : '提取失败' }) })) }
    if (results.every(result => result.status === 'fulfilled')) record.comparison = compareExtractions(results[0].value, results[1].value, document.tags)
    report.records = [...report.records.filter(existing => existing.id !== record.id), record]
    persist()
    console.log(`${document.file}: ${record.comparison ? `${document.tags.length} → ${record.comparison.tags.length}，${record.comparison.needsReview ? '有分歧／待核对' : '双模型一致'}` : record.results.map(item => `${item.provider === 'codex' ? 'Codex' : 'DeepSeek'}：${item.result ? `${item.result.tags.length} 个标签` : item.error}`).join('；')}`)
    }
  }))
  console.log(`已保存比较报告：${destination}`)
  if (publish) {
    const published = publishExtractions(report, catalog)
    const publishedPath = resolve(frontend, 'src/features/knowledge/note-tag-ai-results.json')
    saveReport(publishedPath, published)
    console.log(`已更新 ${published.records.length} 篇笔记的 AI 原始标签（保留独立原始目录及人工修订历史）。`)
  }
  if (only === 'both' ? report.summary.failed : report.records.some(record => !record.results[only === 'deepseek' ? 0 : 1]?.result)) process.exitCode = 1
  return report
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
