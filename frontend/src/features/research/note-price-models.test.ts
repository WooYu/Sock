// @vitest-environment node
import { expect, test } from 'vitest'
import { createHash } from 'node:crypto'
import seed from '../../server/note-study-seed.json'
import { analysisInputFixture, seriesFixture, testCalendar } from '../scenario/scenario-test-fixtures'
import { DEFAULT_NOTE_PRICE_CONFIG, NOTE_PRICE_CARDS, runNotePriceModels } from './note-price-models'
import { appendNotePriceSnapshot, evaluateNotePriceSnapshot, freezeNotePriceSnapshot, NOTE_PRICE_STORAGE_KEY, parseNotePriceSnapshots,
  appendNotePriceEvaluation, freezeNotePriceEvaluation, NOTE_PRICE_EVALUATION_KEY, parseNotePriceEvaluations } from './note-price-ledger'
import { priceRuleCardForClaim } from '../knowledge/note-price-rule-cards'
import type { SemanticStudy } from '../knowledge/note-study-types'

const memory = new Map<string, string>()
const localStorage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value) }, removeItem: (key: string) => { memory.delete(key) } }

function inputFixture(falling = false) {
  const dates = Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2026, 8, 10 + i)).toISOString().slice(0, 10))
  const input = analysisInputFixture(seriesFixture({ dates, closes: dates.map((_, i) => falling ? 12 - i * .01 : 10 + i * .01), fetchedAt: '2026-10-09T16:00:00+08:00' }))
  input.calendar = testCalendar
  return input
}

test('rule cards retain source hashes, exact quotations and untested status', () => {
  for (const card of NOTE_PRICE_CARDS) {
    const record = seed.records.find(record => record.study.file === card.source.file)!
    expect(createHash('sha256').update(record.sourceText).digest('hex')).toBe(card.source.sourceHash)
    for (const evidence of card.source.evidence) expect(record.sourceText.split(/\r?\n/).slice(evidence.startLine - 1, evidence.endLine).join('\n')).toContain(evidence.quote)
    expect(card.validation).toBe('not_validated')
  }
})
test('all 271 source claims have rule-card states; only bound claims acquire executable research models', () => {
  const cards = seed.records.flatMap(record => {
    const study = record.study as SemanticStudy
    return study.claims.map(claim => priceRuleCardForClaim(study, claim))
  })
  expect(cards).toHaveLength(271)
  expect(new Set(cards.flatMap(card => card.executableModelIds))).toEqual(new Set(['ma5_boundary', 'climb_high', 'rebound_high']))
  expect(cards.filter(card => card.stage === 'candidate').every(card => card.missingForExecution.length > 0)).toBe(true)
})
test('solves next-close MA5 boundary algebra rather than predicting a close', () => {
  const input = inputFixture()
  input.periods.day!.closed = input.periods.day!.closed.slice(-4).map((bar, i) => ({ ...bar, open: 10 + i * .2, close: 10 + i * .2, high: 11, low: 9 }))
  const boundary = runNotePriceModels(input).results[0]
  expect(boundary.value).toBeCloseTo(10.3, 12)
  expect(boundary.card.role).toBe('boundary')
  expect((41.2 + boundary.value!) / 5).toBeCloseTo(boundary.value!, 12)
})
test('climb model separates price window from indicator horizon and keeps mapping alternatives', () => {
  const input = inputFixture()
  const t2 = runNotePriceModels(input).results[1]
  const t1 = runNotePriceModels(input, { ...DEFAULT_NOTE_PRICE_CONFIG, upperMapping: 1 }).results[1]
  expect(t2.status).toBe('computed')
  expect(t2.priceTarget.barKey).toBe('2026-10-12')
  expect(t2.indicatorTarget?.barKey).toBe('2026-10-13')
  expect(t1.indicatorTarget?.barKey).toBe('2026-10-12')
  expect(t2.value).toBeGreaterThan(t1.value!)
  expect(t2.value).toBeCloseTo(t2.inputs.upper + t2.inputs.upper - t2.inputs.upperTwoBarsAgo, 12)
})
test('conditions route different hypotheses without manufacturing a confirmed trend', () => {
  const up = runNotePriceModels(inputFixture())
  const down = runNotePriceModels(inputFixture(true))
  expect(up.results[1].status).toBe('computed')
  expect(up.results[2].status).toBe('not_applicable')
  expect(down.results[1].status).toBe('not_applicable')
  expect(down.results[2].status).toBe('computed')
  expect(down.results[2].card.researchDefinition).toContain('实验代理')
})
test('incomplete or future candles cannot enter calculation; unknown calendar preserves horizon without a made-up date', () => {
  const input = inputFixture()
  input.periods.day!.closed.at(-1)!.day = '2026-10-12'
  expect(runNotePriceModels(input).results.every(result => result.status === 'insufficient' && result.value === null)).toBe(true)
  const noCalendar = inputFixture(); noCalendar.calendar = null
  const result = runNotePriceModels(noCalendar).results[0]
  expect(result.value).not.toBeNull()
  expect(result.priceTarget).toMatchObject({ horizon: 1, barKey: null })
  expect(() => runNotePriceModels(noCalendar, { ...DEFAULT_NOTE_PRICE_CONFIG, touchBars: 0 })).toThrow()
})
test('frozen ledger is append-only, rejects modified prices or sources, and preserves corrupt storage', () => {
  const record = freezeNotePriceSnapshot(inputFixture(), DEFAULT_NOTE_PRICE_CONFIG, 'one', '2026-10-09T16:01:00+08:00')
  localStorage.removeItem(NOTE_PRICE_STORAGE_KEY)
  appendNotePriceSnapshot(localStorage, record)
  expect(record.timing).toBe('local_before_window')
  expect(parseNotePriceSnapshots(localStorage.getItem(NOTE_PRICE_STORAGE_KEY))).toEqual([record])
  expect(() => appendNotePriceSnapshot(localStorage, record)).toThrow('不能覆盖')
  const mutated = structuredClone(record); mutated.run.results[1].value = 999
  expect(() => parseNotePriceSnapshots(JSON.stringify({ schemaVersion: 1, records: [mutated] }))).toThrow('未被覆盖')
  localStorage.setItem(NOTE_PRICE_STORAGE_KEY, '{broken')
  expect(() => appendNotePriceSnapshot(localStorage, { ...record, id: 'two' })).toThrow('未被覆盖')
  expect(localStorage.getItem(NOTE_PRICE_STORAGE_KEY)).toBe('{broken')
  localStorage.removeItem(NOTE_PRICE_STORAGE_KEY)
})
test('late saves are replay; no-calendar and demo saves cannot claim a dated prospective forecast', () => {
  expect(freezeNotePriceSnapshot(inputFixture(), DEFAULT_NOTE_PRICE_CONFIG, 'late', '2026-10-12T16:00:00+08:00').timing).toBe('replay')
  const unknown = inputFixture(); unknown.calendar = null
  expect(freezeNotePriceSnapshot(unknown, DEFAULT_NOTE_PRICE_CONFIG, 'unknown', unknown.asOf).timing).toBe('unresolved')
  unknown.sourceMode = 'demo'
  expect(freezeNotePriceSnapshot(unknown, DEFAULT_NOTE_PRICE_CONFIG, 'demo', unknown.asOf).timing).toBe('demo')
  const fetchedLater = inputFixture(); fetchedLater.periods.day!.source.fetchedAt = '2026-10-13T16:00:00+08:00'
  expect(() => freezeNotePriceSnapshot(fetchedLater, DEFAULT_NOTE_PRICE_CONFIG, 'false-early', fetchedLater.asOf)).toThrow('实际采集时间')
})
test('scores only the declared high, keeps failed rebound samples, and compares one-point baselines', () => {
  const input = inputFixture(true)
  const record = freezeNotePriceSnapshot(input, DEFAULT_NOTE_PRICE_CONFIG, 'down', input.asOf)
  const actual = structuredClone(input.periods.day!)
  actual.asOf = actual.source.fetchedAt = '2026-10-12T16:00:00+08:00'
  actual.closed.push({ day: '2026-10-12', open: 10, high: 10.5, low: 9, close: 9.1, volume: 1000 })
  const scores = evaluateNotePriceSnapshot(record, actual)
  expect(scores[2]).toMatchObject({ status: 'evaluated', actualHigh: 10.5, withinOnePercent: false })
  expect(scores[2].relativeError).toBeCloseTo(Math.abs(record.run.results[2].value! - 10.5) / 10.5, 12)
  expect(scores[2].previousHighError).not.toBeNull()
  expect(scores[0]).toMatchObject({ relativeError: null, boundaryHeld: false })
})
test('high target can be scored before the later indicator target closes, with separate indicator error', () => {
  const input = inputFixture()
  const record = freezeNotePriceSnapshot(input, DEFAULT_NOTE_PRICE_CONFIG, 'climb', input.asOf)
  const actual = structuredClone(input.periods.day!)
  actual.asOf = actual.source.fetchedAt = '2026-10-12T16:00:00+08:00'
  actual.closed.push({ day: '2026-10-12', open: 10.3, high: 10.5, low: 10, close: 10.4, volume: 1000 })
  expect(evaluateNotePriceSnapshot(record, actual)[1]).toMatchObject({ status: 'evaluated', indicatorRelativeError: null })
  actual.closed[0].close += .01
  expect(evaluateNotePriceSnapshot(record, actual)[1].status).toBe('basis_changed')
})
test('exactly one percent high-price error is not counted as a hit', () => {
  const input = inputFixture(true)
  input.periods.day!.closed = input.periods.day!.closed.map((bar, i) => ({ ...bar, open: 127 - i, close: 127 - i, high: 129 - i, low: 125 - i }))
  const record = freezeNotePriceSnapshot(input, DEFAULT_NOTE_PRICE_CONFIG, 'edge', input.asOf)
  expect(record.run.results[2].value).toBe(99)
  const actual = structuredClone(input.periods.day!)
  actual.asOf = actual.source.fetchedAt = '2026-10-12T16:00:00+08:00'
  actual.closed.push({ day: '2026-10-12', open: 99, high: 100, low: 98, close: 99, volume: 1000 })
  expect(evaluateNotePriceSnapshot(record, actual)[2]).toMatchObject({ relativeError: .01, withinOnePercent: false })
})

test('evaluation versions retain actual candles and failures without overwriting earlier scores', () => {
  const input = inputFixture(true)
  const forecast = freezeNotePriceSnapshot(input, DEFAULT_NOTE_PRICE_CONFIG, 'forecast', input.asOf)
  const actual = structuredClone(input.periods.day!)
  expect(() => freezeNotePriceEvaluation(forecast, actual, 'waiting', actual.asOf)).toThrow('尚未完成')
  actual.asOf = actual.source.fetchedAt = '2026-10-12T16:00:00+08:00'
  actual.closed.push({ day: '2026-10-12', open: 10, high: 10.5, low: 9, close: 9.1, volume: 1000 })
  const first = freezeNotePriceEvaluation(forecast, actual, 'first', actual.asOf)
  localStorage.removeItem(NOTE_PRICE_EVALUATION_KEY)
  appendNotePriceEvaluation(localStorage, first)
  actual.closed.at(-1)!.high = 12
  const second = freezeNotePriceEvaluation(forecast, actual, 'second', actual.asOf)
  appendNotePriceEvaluation(localStorage, second)
  const restored = parseNotePriceEvaluations(localStorage.getItem(NOTE_PRICE_EVALUATION_KEY))
  expect(restored).toEqual([first, second])
  expect(restored[0].scores[2]).toMatchObject({ actualHigh: 10.5, withinOnePercent: false })
  expect(restored[1].actual.closed.at(-1)!.high).toBe(12)
  expect(() => appendNotePriceEvaluation(localStorage, first)).toThrow('不能覆盖')
  expect(() => freezeNotePriceEvaluation(forecast, actual, 'early', input.asOf)).toThrow('早于')
  const changed = structuredClone(first); changed.scores[2].withinOnePercent = true
  expect(() => parseNotePriceEvaluations(JSON.stringify({ schemaVersion: 1, evaluations: [changed] }))).toThrow('未被覆盖')
  localStorage.setItem(NOTE_PRICE_EVALUATION_KEY, '{broken')
  expect(() => appendNotePriceEvaluation(localStorage, second)).toThrow('未被覆盖')
  expect(localStorage.getItem(NOTE_PRICE_EVALUATION_KEY)).toBe('{broken')
  localStorage.removeItem(NOTE_PRICE_EVALUATION_KEY)
})
