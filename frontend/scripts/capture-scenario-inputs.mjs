import { access, mkdir, open, rm, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'

const periods = ['day', '60m', '30m']
const slots = { day: ['15:00'], '60m': ['10:30', '11:30', '14:00', '15:00'],
  '30m': ['10:00', '10:30', '11:00', '11:30', '13:30', '14:00', '14:30', '15:00'] }
function endAt(bar, period) { return period === 'day' ? bar.day + 'T15:00:00+08:00' : bar.day }
function validate(data, symbol, period) {
  if (!data || data.symbol !== symbol) throw new Error('response symbol mismatch')
  if (data.period !== period || data.adjustment !== 'none' || data.kind !== 'candles') throw new Error('response period/adjustment/kind mismatch')
  if (!data.source || typeof data.source.name !== 'string' || !Number.isFinite(Date.parse(data.source.fetchedAt))
    || typeof data.source.online !== 'boolean' || typeof data.source.state !== 'string') throw new Error('invalid source metadata')
  if (!Array.isArray(data.bars) || !data.bars.length) throw new Error('empty candle history')
  let previous = ''
  for (const b of data.bars) {
    const keyValid = period === 'day' ? /^\d{4}-\d{2}-\d{2}$/.test(b.day)
      : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+08:00$/.test(b.day) && slots[period].includes(b.day.slice(11, 16))
    if (!keyValid || !Number.isFinite(Date.parse(endAt(b, period))) || b.day <= previous
      || ![b.open, b.high, b.low, b.close].every(n => Number.isFinite(n) && n > 0)
      || !Number.isFinite(b.volume) || b.volume < 0 || b.low > Math.min(b.open, b.close) || b.high < Math.max(b.open, b.close)) throw new Error('invalid or unordered OHLC candle')
    previous = b.day
  }
}
async function exists(file) { try { await access(file); return true } catch (e) { if (e.code === 'ENOENT') return false; throw e } }
export async function captureScenarioInputs({ apiBase = 'http://127.0.0.1:3000', symbol = '603533', outputDir, fetchImpl = fetch }) {
  const base = new URL(apiBase)
  if (!['http:', 'https:'].includes(base.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)
    || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw new Error('apiBase must be a loopback service origin')
  if (!/^\d{6}$/.test(symbol)) throw new Error('invalid stock symbol')
  if (!outputDir) throw new Error('outputDir is required')
  await mkdir(outputDir, { recursive: true })
  for (const file of ['manifest.json', ...periods.map(p => p + '.json')]) if (await exists(join(outputDir, file))) throw new Error('frozen capture exists: ' + file)
  const lockFile = join(outputDir, '.capture.lock')
  const lock = await open(lockFile, 'wx')
  try {
    const manifest = { schemaVersion: 1, symbol, adjustment: 'none', apiBase: base.origin, startedAt: new Date().toISOString(),
      capturedAt: null, status: 'failed', calendar: null, periods: [] }
    for (const period of periods) {
      const requestPath = `/api/market/stocks/${symbol}/candles?period=${period}&adjustment=none`
      try {
        const response = await fetchImpl(new URL(requestPath, base), { headers: { Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(15000) })
        if (!response.ok) throw new Error('market API HTTP ' + response.status)
        const data = await response.json()
        validate(data, symbol, period)
        const capturedAt = new Date().toISOString(), cutoff = Math.min(Date.parse(capturedAt), Date.parse(data.source.fetchedAt))
        const closed = data.bars.filter(b => Date.parse(endAt(b, period)) <= cutoff)
        const bytes = JSON.stringify(data, null, 2) + '\n', file = period + '.json'
        await writeFile(join(outputDir, file), bytes, { flag: 'wx' })
        manifest.periods.push({ period, status: 'captured', requestPath, capturedAt, source: data.source, file,
          sha256: createHash('sha256').update(bytes).digest('hex'), bytes: Buffer.byteLength(bytes), count: data.bars.length,
          closedCount: closed.length, lastClosedAt: closed.length ? endAt(closed.at(-1), period) : null, limitedHistory: !!data.limitedHistory })
      } catch (error) { manifest.periods.push({ period, status: 'failed', requestPath, capturedAt: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) }) }
    }
    const count = manifest.periods.filter(p => p.status === 'captured').length
    manifest.status = count === periods.length ? 'captured' : count ? 'partial' : 'failed'
    manifest.capturedAt = new Date().toISOString()
    await writeFile(join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' })
    return manifest
  } finally { await lock.close(); await rm(lockFile) }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), option = (key, fallback) => { const i = args.indexOf(key); return i < 0 ? fallback : args[i + 1] }
  try {
    const manifest = await captureScenarioInputs({ apiBase: option('--api-base', 'http://127.0.0.1:3000'),
      symbol: option('--symbol', '603533'), outputDir: resolve(option('--output', '../research/zhangyue-scenario-v1')) })
    console.log(JSON.stringify({ symbol: manifest.symbol, status: manifest.status, periods: manifest.periods.map(p => ({ period: p.period, status: p.status, error: p.error })) }, null, 2))
    if (manifest.status !== 'captured') process.exitCode = 1
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
