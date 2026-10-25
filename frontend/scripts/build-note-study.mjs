import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..'), root = resolve(frontend, '..')
const research = resolve(root, 'research/zhangyue-scenario-v1/note-study-2026-10-16'), notes = resolve(root, 'notes')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const manifestBytes = await readFile(resolve(research, 'manifest.json')), studyBytes = await readFile(resolve(research, 'study-catalog.json'))
const manifest = JSON.parse(manifestBytes), catalog = JSON.parse(studyBytes)
const sourceCatalogBytes = await readFile(resolve(frontend, 'src/features/knowledge/note-tag-catalog.json'))
if (hash(sourceCatalogBytes) !== catalog.sourceCatalogSha256 || catalog.sourceCatalogSha256 !== manifest.sourceCatalogSha256) throw new Error('原标签目录已变化，请先核对逐篇研究来源')
// Frozen research uses the vocabulary recorded when it was created, not current UI options.
const taxonomy = JSON.parse(await readFile(resolve(frontend, 'src/features/knowledge/note-tag-taxonomy-legacy.json'), 'utf8'))
const allowed = new Set(taxonomy.flatMap(d => d.options.map(t => t.id)))
const originals = new Map(manifest.documents.map(d => [d.file, d]))
if (catalog.records.length !== originals.size || new Set(catalog.records.map(r => r.file)).size !== originals.size) throw new Error('逐篇研究覆盖清单不完整')
function checkQuotes(value, lines) {
  if (Array.isArray(value)) { value.forEach(v => checkQuotes(v, lines)); return }
  if (!value || typeof value !== 'object') return
  if ('quote' in value) {
    if (!Number.isInteger(value.startLine) || !Number.isInteger(value.endLine) || value.startLine < 1 || value.endLine < value.startLine || value.endLine > lines.length
      || !value.quote || !lines.slice(value.startLine - 1, value.endLine).join('\n').includes(value.quote)) throw new Error('逐篇研究引文与原文行不一致')
  }
  Object.values(value).forEach(v => checkQuotes(v, lines))
}
const records = []
for (const study of catalog.records) {
  const path = resolve(notes, study.file), expected = originals.get(study.file)
  if (!path.startsWith(notes + sep) || !expected) throw new Error('未知笔记路径')
  const bytes = await readFile(path), sourceText = bytes.toString('utf8')
  if (hash(bytes) !== study.sourceHash || hash(bytes) !== expected.sourceHash || hash(Buffer.from(sourceText)) !== study.sourceHash) throw new Error('原文哈希已变化：' + study.file)
  if (study.status !== 'ai_candidate' || study.tags.some(tag => !allowed.has(tag)) || study.claims.some(c => c.evaluationStatus !== 'untested')) throw new Error('研究标签或状态无效：' + study.file)
  checkQuotes(study, sourceText.split(/\r?\n/))
  records.push({ sourceText, study })
}
const titles = new Map(JSON.parse(sourceCatalogBytes).documents.map(d => [d.file, d.title]))
const index = { documentCount: records.length, claimCount: records.reduce((n, r) => n + r.study.claims.length, 0),
  uninspectedAttachmentCount: records.filter(r => r.study.attachments.status === 'not_inspected').length,
  entries: records.map(({ study: s }) => ({ file: s.file, title: titles.get(s.file) ?? s.file, sourceHash: s.sourceHash, studyRevisionId: s.studyRevisionId,
    summary: s.summary, tags: s.tags, roles: s.roles, claimCount: s.claims.length, attachmentStatus: s.attachments.status })) }
const seed = { schemaVersion: 1, definitionVersion: catalog.definitionVersion, manifestHash: hash(manifestBytes), studyCatalogHash: hash(studyBytes), index, records }
const outputs = [[resolve(frontend, 'src/server/note-study-seed.json'), JSON.stringify(seed, null, 2) + '\n'],
  [resolve(root, 'backend/src/main/resources/scenario/note-tag-ids.json'), JSON.stringify([...allowed].sort(), null, 2) + '\n']]
for (const [file, value] of outputs) {
  if (process.argv.includes('--check')) { if (await readFile(file, 'utf8') !== value) throw new Error('生成资源已过期：' + file) }
  else { await mkdir(dirname(file), { recursive: true }); await writeFile(file, value) }
}
console.log(`${process.argv.includes('--check') ? 'Verified' : 'Generated'} ${index.documentCount} note studies, ${index.claimCount} claims; source notes and original tags unchanged.`)
