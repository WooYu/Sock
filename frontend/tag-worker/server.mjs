import { createServer } from 'node:http'
import { readFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bindSource, extractDualModels, loadModels } from '../scripts/note-tag-extraction.mjs'

const directory = fileURLToPath(new URL('../', import.meta.url))
const catalog = JSON.parse(readFileSync(resolve(directory, 'src/features/knowledge/note-tag-catalog.json'), 'utf8'))
const seed = JSON.parse(readFileSync(resolve(directory, 'src/server/note-study-seed.json'), 'utf8'))
const sources = new Map(seed.records.map(record => [record.study.file, record]))
const models = loadModels(process.env)
const pending = new Map()
if (existsSync('/run/secrets/codex-config.toml')) {
  mkdirSync(process.env.CODEX_HOME, { recursive: true, mode: 0o700 })
  copyFileSync('/run/secrets/codex-config.toml', resolve(process.env.CODEX_HOME, 'config.toml'))
}
function respond(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}
createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/health') return respond(response, 200, { status: 'UP' })
  if (request.method !== 'POST' || request.url !== '/extract') return respond(response, 404, { message: 'Not found' })
  try {
    let body = ''
    for await (const chunk of request) {
      body += chunk
      if (Buffer.byteLength(body) > 4096) return respond(response, 413, { message: '输入过长' })
    }
    let input
    try { input = JSON.parse(body) } catch { return respond(response, 400, { message: '输入格式无效' }) }
    const record = catalog.documents.find(item => item.id === input?.id)
    if (!record) return respond(response, 404, { message: '未找到整篇笔记' })
    const proposal = sources.get(record.file)
    if (input.sourceHash !== record.sourceHash || proposal?.study.sourceHash !== record.sourceHash) return respond(response, 409, { message: '原文版本不一致，请刷新' })
    const key = `${record.id}@${record.sourceHash}`
    let task = pending.get(key)
    if (!task) {
      if (pending.size >= 2) return respond(response, 429, { message: '正在提取其他笔记，请稍后重试' })
      const { source } = bindSource(Buffer.from(proposal.sourceText), record.sourceHash)
      task = extractDualModels(models, source, { id: record.id, sourceHash: record.sourceHash }).finally(() => pending.delete(key))
      pending.set(key, task)
    }
    respond(response, 200, await task)
  } catch { respond(response, 502, { message: '双 AI 提取失败，当前标签未修改' }) }
}).listen(Number(process.env.PORT || 3010), '0.0.0.0')
