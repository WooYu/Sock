// @vitest-environment node
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { buildNoteCatalog } from '../../../scripts/build-note-tags.mjs'

const root = resolve(import.meta.dirname, '../../../..')
const catalog = buildNoteCatalog({ root, commit: '0014c94a6225dd23f8313d9b166cacae2e633df3', generatedAt: '2026-10-14T00:00:00Z' })

describe('source-backed note catalog', () => {
  it('keeps MA periods distinct and retains an explicit pending reason for bodyless notes', () => {
    const temporary = mkdtempSync(resolve(tmpdir(), 'stockcal-note-tags-'))
    try {
      mkdirSync(resolve(temporary, 'notes'))
      mkdirSync(resolve(temporary, 'research/2026-09-16-xinyisheng'), { recursive: true })
      writeFileSync(resolve(temporary, 'research/2026-09-16-xinyisheng/knowledge-catalog.json'), JSON.stringify({ documents: [], rules: [] }))
      writeFileSync(resolve(temporary, 'notes/periods.md'), '二十日线；120日线；15日线。')
      writeFileSync(resolve(temporary, 'notes/bodyless.md'), '---\ncreated: 2025-01-01\n---\n')
      const sample = buildNoteCatalog({ root: temporary, commit: 'abc', generatedAt: '2026-10-14T00:00:00Z' })
      const periods = sample.documents.find((record) => record.file === 'periods.md')!
      expect(periods.tags).toContain('topic.ma20')
      expect(periods.tags).not.toContain('topic.ma5')
      expect(periods.tags).not.toContain('topic.ma10')
      expect(sample.documents.find((record) => record.file === 'bodyless.md')?.gaps.join(' ')).toContain('缺少可解析正文')
    } finally { rmSync(temporary, { recursive: true, force: true }) }
  })

  it('covers every Markdown file, including the six notes absent from the older research', () => {
    const files = readdirSync(resolve(root, 'notes')).filter((file) => file.endsWith('.md')).sort()
    expect(catalog.documents.map((record) => record.file).sort()).toEqual(files)
    expect(catalog.documents).toHaveLength(files.length)
    expect(catalog.documents.find((record) => record.file === '01-ma-golden-cross.md')?.tags).toContain('topic.ma5')
    expect(catalog.fragments.some((record) => record.file === '01-ma-golden-cross.md')).toBe(true)
  })

  it('binds every automatic tag to inspectable current source evidence or an explicit missing-definition reason', () => {
    for (const record of [...catalog.documents, ...catalog.fragments]) {
      const bytes = readFileSync(resolve(root, 'notes', record.file))
      const lines = bytes.toString('utf8').split(/\r?\n/)
      expect(record.sourceHash).toBe(createHash('sha256').update(bytes).digest('hex'))
      expect(record.status).toBe('candidate')
      expect(record.tags.length).toBeGreaterThan(0)
      for (const tag of record.tags) {
        const evidence = record.evidence.filter((item) => item.tagId === tag)
        expect(evidence.length, `${record.file} ${tag}`).toBeGreaterThan(0)
        for (const item of evidence) {
          expect(item.startLine).toBeGreaterThan(0)
          expect(item.endLine).toBeGreaterThanOrEqual(item.startLine)
          expect(lines.slice(item.startLine - 1, item.endLine).join('\n'), `${record.file}:${item.startLine}`).toContain(item.quote)
          expect(item.reason.length).toBeGreaterThan(0)
        }
      }
    }
    expect(catalog.audit.sourceQuotesRejected).toBe(0)
  })
})
