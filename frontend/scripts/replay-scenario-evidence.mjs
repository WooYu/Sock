// Offline, retrospective comparison. Vite uses the same TypeScript modules as the application.
import { createServer } from 'vite'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'
const args = process.argv.slice(2), option = (key, fallback) => { const i = args.indexOf(key); return i < 0 ? fallback : args[i + 1] }
const captureDir = resolve(option('--input', '../research/zhangyue-scenario-v1'))
const output = resolve(option('--output', join(captureDir, 'comparison.json')))
const caseDay = option('--origin', '2026-09-11'), asOf = caseDay + 'T15:00:00+08:00'
const generatedAt = new Date().toISOString()
const server = await createServer({ configFile: false, server: { middlewareMode: true, watch: null }, appType: 'custom' })
try {
  const { normalizeScenarioSeries } = await server.ssrLoadModule('/src/features/scenario/scenario-inputs.ts')
  const { buildScenarioAnalysis } = await server.ssrLoadModule('/src/features/scenario/scenario-engine.ts')
  const { indicatorSeries, SCENARIO_INDICATORS } = await server.ssrLoadModule('/src/features/scenario/scenario-calculator.ts')
  const { buildScenarioRuleRegistry } = await server.ssrLoadModule('/src/features/scenario/scenario-rule-registry.ts')
  const { evaluateRangeCoverage } = await server.ssrLoadModule('/src/features/scenario/scenario-evaluation.ts')
  const manifest = JSON.parse(await readFile(join(captureDir, 'manifest.json'), 'utf8'))
  const input = { symbol: manifest.symbol, asOf, sourceMode: 'real', calendar: null, periods: {}, loadIssues: {} }
  const series = {}, paths = [], actual = {}, comparisons = []
  for (const period of ['day', '60m', '30m']) {
    const source = manifest.periods.find(p => p.period === period && p.status === 'captured')
    if (!source) throw new Error('missing actual period: ' + period)
    const bytes = await readFile(join(captureDir, source.file))
    if (createHash('sha256').update(bytes).digest('hex') !== source.sha256) throw new Error('capture hash mismatch: ' + period)
    series[period] = JSON.parse(bytes)
    input.periods[period] = normalizeScenarioSeries(series[period], asOf)
    const origin = input.periods[period].closed.at(-1)
    if (!origin || origin.day.slice(0, 10) !== caseDay) throw new Error('origin missing from actual minute history: ' + period)
    for (const [kind, price, description] of [['continuation', origin.high, '后三根假设收于原点最高价'], ['pullback', (origin.open + origin.close) / 2, '后三根假设收于原点实体中部']]) paths.push({
      id: 'replay:' + period + ':' + kind, symbol: input.symbol, period, originBarKey: origin.day, kind, closes: [price, price, price],
      selectedAt: generatedAt, condition: '事后构造的条件路径：' + description + '；不代表该条件事前被选择或后来发生。', evidence: [] })
    actual[period] = normalizeScenarioSeries(series[period], manifest.capturedAt)
  }
  const catalog = JSON.parse(await readFile('src/features/knowledge/note-tag-catalog.json', 'utf8'))
  const snapshot = buildScenarioAnalysis(input, { shocks: { day: { period: 'day', barKey: caseDay, eventAt: asOf, confirmedAt: generatedAt,
    reason: '事后人工选定大阳线算例，考察滚动窗口与增量外推差异；未据误差优化日期。' } } }, {
    id: '603533-replay-' + caseDay, version: 1, kind: 'replay', createdAt: generatedAt,
    registry: buildScenarioRuleRegistry([...catalog.documents, ...catalog.fragments]), scenarios: paths, horizons: [1, 2, 3], executionWindow: null })
  for (const period of ['day', '60m', '30m']) {
    const bars = actual[period].closed, originKey = input.periods[period].closed.at(-1).day
    const index = bars.findIndex(b => b.day === originKey), values = indicatorSeries(bars)
    for (const ref of snapshot.references.filter(r => r.period === period)) {
      const targetIndex = index + ref.target.horizon, target = bars[targetIndex], value = values[ref.indicator][targetIndex]
      comparisons.push({ period, method: ref.method, scenarioId: ref.scenarioId, indicator: ref.indicator, horizon: ref.target.horizon,
        observedTargetBarKey: target?.day ?? null, predicted: ref.value, valid: ref.valid, actual: value ?? null,
        absoluteError: ref.valid && value != null ? Math.abs(ref.value - value) : null })
    }
  }
  const summaries = []
  for (const period of ['day', '60m', '30m']) for (const indicator of SCENARIO_INDICATORS) {
    for (const method of ['average_delta', 'last_delta', 'rolling_close']) {
      const ids = [...new Set(comparisons.filter(r => r.period === period && r.indicator === indicator && r.method === method).map(r => r.scenarioId))]
      for (const scenarioId of ids) {
        const rows = comparisons.filter(r => r.period === period && r.indicator === indicator && r.method === method && r.scenarioId === scenarioId)
        const evaluated = rows.filter(r => r.absoluteError !== null)
        summaries.push({ period, indicator, method, scenarioId, evaluated: evaluated.length,
          meanAbsoluteError: evaluated.length ? evaluated.reduce((sum, r) => sum + r.absoluteError, 0) / evaluated.length : null })
      }
    }
  }
  const dayBars = input.periods.day.closed, origin = dayBars.at(-1), previous = dayBars.at(-2)
  const report = { schemaVersion: 1, kind: 'replay', generatedAt, manifestSha256: createHash('sha256').update(await readFile(join(captureDir, 'manifest.json'))).digest('hex'),
    caseSelection: { originDay: caseDay, selectionMadeAt: generatedAt, method: '人工事后选择，非预先固定的抽样方案', origin, previousClose: previous.close,
      closeChange: origin.close / previous.close - 1, bodyChange: origin.close / origin.open - 1 },
    limitations: ['仅一个事后选取案例，存在选择偏差，不能推断预测优势、胜率或净收益。', '来源为后来采集的延时历史行情，无法复原当时源版本或盘中观测。',
      '无已核实交易所日历；预测日期保留未知，误差以冻结行情中的后续同周期有效柱进行事后对齐。', '没有窗口前保存的live计划，不提供事前范围覆盖率或成交先后。',
      '不复权序列可能包含除权等口径跳变；未做事件校正，不据此自动分类。'],
    forwardCoverage: evaluateRangeCoverage(snapshot, actual.day, { period: 'day', startAt: '2026-09-14T09:30:00+08:00', endAt: '2026-09-14T15:00:00+08:00' }),
    snapshot, comparisons, summaries }
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' })
  console.log(JSON.stringify({ output, origin: caseDay, comparisons: comparisons.length, evaluated: comparisons.filter(r => r.absoluteError !== null).length,
    forwardCoverageEligible: report.forwardCoverage.eligible }, null, 2))
} finally { await server.close() }
