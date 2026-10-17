import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { captureScenarioInputs } from './capture-scenario-inputs.mjs'

const fixture = period => ({ symbol: '603533', period, adjustment: 'none', kind: 'candles', limitedHistory: false,
  source: { name: 'synthetic test only', fetchedAt: '2026-10-12T16:00:00+08:00', online: true, state: 'TEST' },
  bars: [{ day: period === 'day' ? '2026-10-12' : '2026-10-12T15:00:00+08:00', open: 10, high: 11, low: 9, close: 10.5, volume: 100 }] })
async function inDirectory(run) { const dir = await mkdtemp(join(tmpdir(), 'scenario-capture-')); try { await run(dir) } finally { await rm(dir, { recursive: true, force: true }) } }
const apiBase = 'http://127.0.0.1:3000'
test('rejects remote API bases before issuing requests', async () => {
  await assert.rejects(captureScenarioInputs({ apiBase: 'https://example.com', outputDir: '/tmp/unused', fetchImpl: () => { throw new Error('must not fetch') } }), /loopback/)
})
test('rejects wrong symbol response without preserving it as market evidence', () => inDirectory(async outputDir => {
  const manifest = await captureScenarioInputs({ apiBase, outputDir, fetchImpl: async url => ({ ok: true,
    json: async () => ({ ...fixture(new URL(url).searchParams.get('period')), symbol: '000001' }) }) })
  assert.equal(manifest.status, 'failed')
  assert.ok(manifest.periods.every(p => p.status === 'failed' && /symbol/.test(p.error)))
  await assert.rejects(readFile(join(outputDir, 'day.json')), /ENOENT/)
}))
test('partial failure preserves successful periods with reproducible hashes and closed cutoff', () => inDirectory(async outputDir => {
  const manifest = await captureScenarioInputs({ apiBase, outputDir, fetchImpl: async url => {
    const period = new URL(url).searchParams.get('period')
    return period === '30m' ? { ok: false, status: 502 } : { ok: true, json: async () => fixture(period) }
  } })
  assert.equal(manifest.status, 'partial')
  for (const p of manifest.periods.filter(p => p.status === 'captured')) {
    const bytes = await readFile(join(outputDir, p.file))
    assert.equal(p.sha256, createHash('sha256').update(bytes).digest('hex'))
    assert.equal(p.lastClosedAt, '2026-10-12T15:00:00+08:00')
    assert.equal(p.closedCount, 1)
  }
  assert.match(manifest.periods.find(p => p.period === '30m').error, /502/)
}))
test('does not overwrite a frozen capture', () => inDirectory(async outputDir => {
  await writeFile(join(outputDir, 'manifest.json'), 'frozen')
  await assert.rejects(captureScenarioInputs({ apiBase, outputDir, fetchImpl: () => { throw new Error('must not fetch') } }), /frozen/)
  assert.equal(await readFile(join(outputDir, 'manifest.json'), 'utf8'), 'frozen')
}))
test('rejects mixed price adjustments and invalid OHLC', () => inDirectory(async outputDir => {
  const manifest = await captureScenarioInputs({ apiBase, outputDir, fetchImpl: async url => {
    const data = fixture(new URL(url).searchParams.get('period'))
    if (data.period === 'day') data.adjustment = 'qfq'
    else data.bars[0].high = 8
    return { ok: true, json: async () => data }
  } })
  assert.equal(manifest.status, 'failed')
  assert.ok(manifest.periods.every(p => p.status === 'failed'))
}))
