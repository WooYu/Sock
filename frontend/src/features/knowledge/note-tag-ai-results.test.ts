// @vitest-environment node
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import catalogData from './note-tag-catalog.json'
import results from './note-tag-ai-results.json'
import { applyAIOriginalTags, parseTagLedger, type AIOriginalTags, type NoteCatalog } from './note-tags'

it('binds the complete reduced baseline to exact source evidence and keeps it serializable', () => {
  const catalog = catalogData as NoteCatalog
  expect(results.records).toHaveLength(catalog.documents.length)
  expect(new Set(results.models).size).toBe(2)
  for (const record of results.records) {
    const original = catalog.documents.find(item => item.id === record.id)!
    const source = readFileSync(resolve(import.meta.dirname, '../../../../notes', original.file), 'utf8').replace(/\r\n/g, '\n')
    expect(createHash('sha256').update(source).digest('hex')).toBe(record.sourceHash)
    expect(record.tags.length).toBeLessThanOrEqual(5)
    expect(record.evidence.map(item => item.tagId)).toEqual(record.tags)
    for (const item of record.evidence) {
      expect(item.method).toBe('ai')
      expect(item.tagId).toMatch(/^(topic|purpose|kind|timeframe)\./)
      expect(item.tagId).not.toMatch(/\.unknown$/)
      expect(source.split('\n').slice(item.startLine - 1, item.endLine).join('\n')).toContain(item.quote)
    }
  }
  const applied = applyAIOriginalTags(catalog, results.records as AIOriginalTags[])
  expect(applied.documents.reduce((sum, record) => sum + record.tags.length, 0)).toBeLessThan(catalog.documents.reduce((sum, record) => sum + record.tags.length, 0))
  expect(parseTagLedger(JSON.stringify({ schemaVersion: 1, records: applied.documents }))).toHaveLength(catalog.documents.length)
})
