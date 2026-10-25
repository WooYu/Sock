import { expect, test, type Page } from './fixtures/test'
import { readFile } from 'node:fs/promises'
import fixture from './fixtures/scenario-research.json'
import series from './fixtures/scenario-series.json'
import { loadPreviewSeries } from '../src/features/research/preview-data'
import type { ChartPeriod } from '../src/features/chart/chart-periods'
import catalog from '../src/features/knowledge/note-tag-catalog.json'
import type { ForecastRecord, PriceEvaluation, SaveForecastRequest } from '../src/features/scenario/scenario-record-types'

const frozen = fixture as unknown as SaveForecastRequest & { result: PriceEvaluation['result']; actual: PriceEvaluation['actual'] }
const received = '2026-10-17T00:00:00Z'
function record(request: SaveForecastRequest = frozen): ForecastRecord {
  const s = request.snapshot
  return { id: '10000000-0000-4000-8000-000000000011', owner: 'web:browser-test', clientRecordId: s.id, clientVersion: s.version,
    previousRecordId: null, symbol: '603533', kind: s.kind, serverReceivedAt: received, clientCreatedAt: s.createdAt, inputAsOf: s.input.asOf,
    anchorDay: '2026-10-14', method: s.consolidation!.method, definitionVersion: s.definitionVersion, payloadHash: 'a'.repeat(64),
    targetPolicy: 'first-observed-complete-daily-v1', snapshot: s, noteBindings: request.noteBindings.map(b => ({ ...b, status: 'unresolved', study: null })),
    levels: [...s.dailyPriceLadder!.up, ...s.dailyPriceLadder!.down].map(p => ({ id: p.id, priceCents: Math.round(p.value * 100), groupIds: p.groupIds })) }
}
function evaluation(forecastId = record().id): PriceEvaluation {
  return { id: '20000000-0000-4000-8000-000000000011', forecastId, version: 1, previousEvaluationId: null,
    targetResolution: { version: 1, state: 'verified', targetDay: '2026-10-15', evidence: ['冻结历史回放验收资料'] }, status: 'scored',
    eligibility: { forwardEligible: false, reasons: ['historical_replay', 'server_receipt_after_cutoff'] }, actual: frozen.actual,
    source: { provider: '冻结浏览器验收行情', symbol: '603533', adjustment: 'none', fetchedAt: received, candleHash: 'b'.repeat(64), responseHash: fixture.sourceHash, responseHashKind: 'canonical_adapter' },
    result: frozen.result, evaluatedAt: received, nextRetryAt: null }
}
async function market(page: Page) {
  const source = { name: '合成页面行情', fetchedAt: new Date().toISOString(), online: true, state: 'TEST' }
  const marketBars: Partial<Record<ChartPeriod, typeof series.day>> = { day: series.day, '60m': series['60m'], '30m': series['30m'] }
  await page.route('**/api/market/stocks/*/candles?*', async route => {
    const period = new URL(route.request().url()).searchParams.get('period') as ChartPeriod
    return route.fulfill({ json: { symbol: '603533', period, adjustment: 'none', kind: 'candles', bars: marketBars[period] ?? (await loadPreviewSeries('DEMO', period)).bars, source, limitedHistory: false } })
  })
  await page.route('**/api/market/stocks/*/snapshot', route => route.fulfill({ json: { quote: { security: { code: '603533', name: '掌阅科技', exchange: 'SH' }, price: 30, previousClose: 29 }, dailyCandles: series.day, source } }))
  await page.route('**/api/market/stocks/*/prediction?*', route => route.fulfill({ status: 503, json: { message: '固定页面行情不含预测' } }))
  await page.route('**/api/knowledge/rules', route => route.fulfill({ json: [] }))
}
async function checkResult(page: Page) {
  const result = page.getByRole('region', { name: '价格核对', exact: true })
  await expect(result).toContainText('2 / 5')
  await expect(result).toContainText('3 / 4')
  await expect(result).toContainText('最高 32.91 · 未覆盖 · 最近偏差 6.56%')
  await expect(result).toContainText('事后对照')
  await expect(result.getByRole('table').getByRole('row')).toHaveCount(6)
  await expect(result).toContainText('盘中支撑／压力：未评估')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
}

test('local-only failure retries the frozen version, reloads its receipt and exports all evidence', async ({ page }, info) => {
  const errors: string[] = [], uploads: SaveForecastRequest[] = [], periods: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { const u = new URL(request.url()); if (u.pathname.endsWith('/candles')) periods.push(u.searchParams.get('period')!) })
  await market(page)
  await page.addInitScript(snapshot => { if (!localStorage.getItem('stockcal.scenario-analysis.v1')) localStorage.setItem('stockcal.scenario-analysis.v1', JSON.stringify({ schemaVersion: 1, records: [snapshot] })) }, frozen.snapshot)
  let saved = record(), evaluated = false
  await page.route('**/api/scenario-records', async route => {
    uploads.push(route.request().postDataJSON())
    if (uploads.length === 1) return route.fulfill({ status: 503, json: { message: '验收：暂时断网' } })
    saved = record(uploads.at(-1)!)
    await route.fulfill({ json: saved })
  })
  await page.route('**/api/scenario-records/*', route => route.fulfill({ json: saved }))
  await page.route('**/api/scenario-records/*/evaluations', route => route.fulfill({ json: evaluated ? [evaluation()] : [] }))
  await page.route('**/api/scenario-records/*/evaluate', route => { evaluated = true; return route.fulfill({ json: { latestStatus: evaluation(), latestSuccessful: evaluation() } }) })
  await page.goto('/?symbol=603533')
  await page.getByRole('tab', { name: '多周期分析', exact: true }).click()

  await page.getByRole('button', { name: '开始多周期分析' }).click()
  const panel = page.getByRole('region', { name: '多周期情景分析', exact: true })
  await expect(panel.getByText('笔记来源已加载')).toBeVisible()
  await panel.getByText('分析历史 · 1个版本', { exact: true }).click()
  await panel.getByRole('button', { name: '上传原版本1', exact: true }).click()
  await expect(panel.getByText('仅本地 · 失败可重试', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('stockcal.scenario-analysis.v1')!).records)).toEqual([frozen.snapshot])
  await panel.getByRole('button', { name: '重试入库版本1', exact: true }).click()
  await expect(panel.getByText('已入库', { exact: true })).toBeVisible()
  expect(uploads).toHaveLength(2); expect(uploads[1]).toEqual(uploads[0])
  await page.reload()
  await page.getByRole('tab', { name: '多周期分析', exact: true }).click()

  await page.getByRole('button', { name: '开始多周期分析' }).click()
  await panel.getByText('分析历史 · 1个版本', { exact: true }).click()
  await expect(panel.getByText('已入库', { exact: true })).toBeVisible()
  await panel.getByRole('button', { name: '查看分析版本1', exact: true }).click()
  await panel.getByRole('button', { name: '立即核对实际四价', exact: true }).click()
  await checkResult(page)
  const event = page.waitForEvent('download'); await panel.getByRole('button', { name: '导出分析与历史', exact: true }).click()
  const path = info.outputPath('frozen-export.json'); await (await event).saveAs(path)
  const exported = JSON.parse(await readFile(path, 'utf8'))
  expect(exported.records).toEqual([frozen.snapshot]); expect(exported.research[0].selectedEvaluationId).toBe(evaluation().id)
  expect(exported.research[0].actualEvidence[0].candleHash).toBe('b'.repeat(64))
  expect(exported.research[0].noteBindings.length).toBeGreaterThan(0)
  expect([...new Set(periods)].sort()).toEqual(['15m', '30m', '60m']) // Automatic forecast now loads unclear lower periods too.
  expect(uploads).toHaveLength(2); expect(errors).toEqual([])
  await page.getByRole('region', { name: '价格核对', exact: true }).screenshot({ path: info.outputPath('price-evaluation.png') })
})

test('semantic study can be saved and selected while manual tag v2/v3 stays byte-for-byte intact', async ({ page }, info) => {
  const base = catalog.documents[0]
  const revisions = [2, 3].map(v => ({ ...base, version: v, previousVersion: v - 1, createdAt: received, revisionReason: `保留人工修订v${v}` }))
  const raw = JSON.stringify({ schemaVersion: 1, records: revisions })
  await page.addInitScript(value => localStorage.setItem('stockcal.note-tags.v1', value), raw)
  await page.route('**/api/note-studies?*', route => route.fulfill({ json: { items: [], nextCursor: null, asOf: received } }))
  await page.route('**/api/note-studies', route => { const body = route.request().postDataJSON(); return route.fulfill({ json: { ...body, id: '30000000-0000-4000-8000-000000000011', owner: 'web:browser', createdAt: received, payloadHash: 'd'.repeat(64) } }) })
  await page.goto('/knowledge?view=notes')
  await page.getByRole('button', { name: '逐篇学习建议', exact: true }).click()
  const study = page.getByRole('region', { name: '逐篇学习建议', exact: true }), detail = page.getByRole('region', { name: '逐篇学习详情', exact: true })
  await expect(study).toContainText('146篇完成文字阅读 · 271条计算主张 · 53篇附件待核对')
  await study.getByRole('textbox', { name: '搜索逐篇学习', exact: true }).fill(base.file)
  await expect(detail).toContainText('人工／原始版本 v3')
  await expect(detail.locator('blockquote').first()).toBeVisible()
  await detail.getByRole('button', { name: '保存研究建议', exact: true }).click()
  await expect(detail).toContainText('研究建议已入库；效果仍为未测试')
  await detail.getByRole('button', { name: '选为后续分析依据', exact: true }).click()
  await expect(detail).toContainText('仍未启用新公式')
  expect(await page.evaluate(() => localStorage.getItem('stockcal.note-tags.v1'))).toBe(raw)
  expect(await page.evaluate(() => localStorage.getItem('stockcal.note-study-selections.v1'))).toContain('30000000-0000-4000-8000-000000000011')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await detail.screenshot({ path: info.outputPath('semantic-study.png') })
})

test('samples distinguish query errors, preserve filters during pagination and export the selected evaluation', async ({ page }, info) => {
  const queries: URLSearchParams[] = [], f = record(), e = evaluation()
  let fail = true
  await page.route('**/api/learning-samples?*', route => {
    const q = new URL(route.request().url()).searchParams; queries.push(q)
    if (fail) return route.fulfill({ status: 503, json: { message: '验收：样本库暂未连接' } })
    return route.fulfill({ json: { items: [{ forecast: f, evaluation: { latestStatus: e, latestSuccessful: e } }], nextCursor: q.has('cursor') ? null : 'fixture-next-batch', asOf: received } })
  })
  await page.route('**/api/scenario-records/*/evaluations', route => route.fulfill({ json: [e] }))
  await page.goto('/knowledge?view=samples&directionCandidate=falling&directionConfirmed=unknown')
  const samples = page.getByRole('region', { name: '学习样本库', exact: true })
  await expect(samples.getByRole('alert')).toContainText('样本库暂未连接')
  await expect(samples.getByText('没有符合条件的样本', { exact: true })).toHaveCount(0)
  fail = false; await samples.getByRole('button', { name: '重试样本', exact: true }).click()
  await expect(samples.getByRole('table')).toContainText('2/5')
  await samples.getByRole('button', { name: '下一批样本', exact: true }).click()
  await expect(samples.getByRole('button', { name: '下一批样本', exact: true })).toBeDisabled()
  expect(queries.at(-1)!.get('directionCandidate')).toBe('falling'); expect(queries.at(-1)!.get('directionConfirmed')).toBe('unknown')
  await samples.getByRole('combobox', { name: '前瞻资格筛选', exact: true }).selectOption('false')
  await expect.poll(() => queries.at(-1)!.get('forwardEligible')).toBe('false'); expect(queries.at(-1)!.has('cursor')).toBe(false)
  await samples.getByRole('button', { name: '查看冻结样本', exact: true }).click()
  const detail = page.getByRole('region', { name: '学习样本详情', exact: true })
  await expect(detail).toContainText('采用周期：仅日线'); await expect(detail).toContainText('葛阶段：未知，起点待确认')
  await checkResult(page)
  const event = page.waitForEvent('download'); await detail.getByRole('button', { name: '导出冻结样本', exact: true }).click()
  const path = info.outputPath('sample-export.json'); await (await event).saveAs(path)
  const exported = JSON.parse(await readFile(path, 'utf8'))
  expect(exported.forecast.snapshot).toEqual(frozen.snapshot); expect(exported.selectedEvaluationId).toBe(e.id); expect(exported.queryAsOf).toBe(received)
  await detail.screenshot({ path: info.outputPath('learning-sample.png') })
})

test('real BFF and PostgreSQL save idempotently, isolate owners and compare Tencent actual prices @real', async ({ page, request }, info) => {
  test.skip(process.env.SCENARIO_REAL_RESEARCH !== 'true', 'Requires the explicitly isolated PostgreSQL/Next integration harness')
  test.setTimeout(60_000)
  const client = `browser-real-final-${info.project.name}`, headers = { 'X-Client-Id': client }
  const proposalResponse = await request.get('/api/note-study-proposals?file=01-ma-golden-cross.md')
  expect(proposalResponse.status()).toBe(200)
  const proposal = await proposalResponse.json()
  const studyBody = { sourceFile: proposal.study.file, sourceHash: proposal.study.sourceHash, sourceText: proposal.sourceText,
    sourceUrl: proposal.study.sourceUrl, channel: 'ai_semantic', parentRevisionId: null, legacyKey: null, payload: proposal.study }
  const studyResponse = await request.post('/api/note-studies', { headers, data: studyBody }); expect(studyResponse.status()).toBe(200)
  const study = await studyResponse.json()
  const studyAgain = await request.post('/api/note-studies', { headers, data: studyBody }); expect((await studyAgain.json()).id).toBe(study.id)
  const body = { snapshot: { ...frozen.snapshot, id: `close14-real-study-${info.project.name}` }, noteBindings: [...frozen.noteBindings,
    { revisionId: study.id, sourceHash: study.sourceHash, legacyKey: null, inlineVersion: null }] }
  const first = await request.post('/api/scenario-records', { headers, data: body }); expect(first.status()).toBe(200)
  const saved = await first.json() as ForecastRecord
  expect(saved.noteBindings.every(b => b.status === 'resolved' && b.study?.sourceText)).toBe(true)
  expect(saved.noteBindings.some(b => b.study?.id === study.id && b.study?.channel === 'ai_semantic')).toBe(true)
  const again = await request.post('/api/scenario-records', { headers, data: body }); expect(again.status()).toBe(200)
  expect(await again.json()).toMatchObject({ id: saved.id, serverReceivedAt: saved.serverReceivedAt, payloadHash: saved.payloadHash })
  const alien = await request.get(`/api/scenario-records/${saved.id}`, { headers: { 'X-Client-Id': client + '-other' } }); expect(alien.status()).toBe(404)
  const response = await request.post(`/api/scenario-records/${saved.id}/evaluate`, { headers, data: {} }); expect(response.status()).toBe(200)
  const view = await response.json(); expect(view.latestStatus.status).toBe('scored'); expect(view.latestSuccessful.result).toMatchObject({ totalLevels: 5, closeLevels: 2, coveredTargets: 3 })
  expect(view.latestSuccessful.eligibility.forwardEligible).toBe(false); expect(view.latestSuccessful.actual).toMatchObject({ day: '2026-10-15', open: 29.51, high: 32.91, low: 28.95, close: 29.01 })
  expect(view.latestSuccessful.source.provider).toMatch(/腾讯/); expect(view.latestSuccessful.source.candleHash).toMatch(/^[a-f0-9]{64}$/)
  await page.addInitScript(id => localStorage.setItem('stockcal:sync-client-id', id), client)
  await page.goto('/knowledge?view=samples&symbol=603533')
  await page.getByRole('button', { name: '查看冻结样本', exact: true }).click(); await checkResult(page)
  const event = page.waitForEvent('download'); await page.getByRole('button', { name: '导出冻结样本', exact: true }).click()
  const path = info.outputPath('real-research-export.json'); await (await event).saveAs(path)
  const exported = JSON.parse(await readFile(path, 'utf8')); expect(exported.forecast.id).toBe(saved.id); expect(exported.noteBindings.every((b: { study?: { sourceText?: string } }) => b.study?.sourceText)).toBe(true)
  await page.getByRole('region', { name: '学习样本详情', exact: true }).screenshot({ path: info.outputPath('real-learning-sample.png') })
})
