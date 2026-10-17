// @vitest-environment node
import { expect, test } from 'vitest'
import { GET } from './route'
test('returns light index, exact one-note detail, and refuses arbitrary files', async () => {
  const index = await (await GET(new Request('http://test/api/note-study-proposals'))).json()
  expect(index.documentCount).toBe(146); expect(index.entries[0]).not.toHaveProperty('sourceText')
  const full = await (await GET(new Request('http://test/api/note-study-proposals?file=01-ma-golden-cross.md'))).json()
  expect(full.sourceText).toContain('5日均线'); expect(full.study.claims.length).toBeGreaterThan(0)
  expect((await GET(new Request('http://test/api/note-study-proposals?file=../../secret'))).status).toBe(404)
})
