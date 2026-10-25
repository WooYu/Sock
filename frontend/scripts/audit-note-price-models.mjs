import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname, relative } from 'node:path'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

// Compile the actual pure application modules for an offline Node run. No copied
// research formulas, paid extraction, network access, or edits to frozen inputs.
const root = resolve(import.meta.dirname, '..')
const runtime = resolve(root, 'artifacts/note-price-audit-runtime')
mkdirSync(runtime, { recursive: true })
const compiled = new Map()
function compile(path) {
  path = resolve(path)
  if (compiled.has(path)) return compiled.get(path)
  const output = resolve(runtime, createHash('sha256').update(path).digest('hex').slice(0, 24) + '.mjs')
  compiled.set(path, output)
  let code = path.endsWith('.json') ? 'export default ' + readFileSync(path, 'utf8') : ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText
  code = code.replace(/(from\s*['"])(\.[^'"]+)(['"])/g, (_, before, specifier, after) => {
    const dependency = resolve(dirname(path), specifier.endsWith('.json') ? specifier : specifier + '.ts')
    return before + pathToFileURL(compile(dependency)).href + after
  })
  writeFileSync(output, code)
  return output
}
const { runNotePriceModels, DEFAULT_NOTE_PRICE_CONFIG } = await import(pathToFileURL(compile(resolve(root, 'src/features/research/note-price-models.ts'))).href)
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex')
const firstPath = resolve(root, '../research/zhangyue-scenario-v1/learning-2026-10-16/source.json')
const first = JSON.parse(readFileSync(firstPath, 'utf8'))
const secondPath = resolve(root, '../research/2026-09-16-xinyisheng/data/stock-adjusted.json')
const secondManifest = JSON.parse(readFileSync(resolve(root, '../research/2026-09-16-xinyisheng/source-manifest.json'), 'utf8'))
const datasets = [
  { path: firstPath, symbol: first.symbol, adjustment: first.adjustment, source: first.source,
    bars: first.bars.filter(bar => Date.parse(bar.day + 'T15:00:00+08:00') <= Date.parse(first.source.fetchedAt)) },
  { path: secondPath, symbol: '300502', adjustment: 'qfq', source: { name: '腾讯历史前复权冻结版本',
    fetchedAt: secondManifest.sources.map(source => source.retrievedAt).sort().at(-1), state: 'HISTORICAL_REPLAY', online: false },
    bars: JSON.parse(readFileSync(secondPath, 'utf8')).map(bar => ({ ...bar, volume: bar.volume_lots * 100 })) },
]
const quantile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor((sorted.length - 1) * p)]
}
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
const summarize = (rows, predict) => {
  const valid = rows.flatMap(row => { const value = predict(row); return value != null && value > 0 ? [{ ...row, value }] : [] })
  return { samples: valid.length, meanRelativeError: mean(valid.map(row => Math.abs(row.value - row.actualHigh) / row.actualHigh)),
    withinOnePercent: mean(valid.map(row => Math.abs(row.value - row.actualHigh) / row.actualHigh < .01 ? 1 : 0)) }
}
const report = { definitionVersion: 'note-price-research-v1', generatedAt: new Date().toISOString(), config: DEFAULT_NOTE_PRICE_CONFIG,
  status: 'historical_research_only', limitations: [
    '两份行情均为既有、已研究过的冻结历史；按时间留出不是新的严格未见或前瞻验证。',
    '历史前复权使用采集时的统一版本，不是逐日保存的当时版本；所有预测计算只传原点及之前完整K线。',
    '条件模型未生成时保留原因和覆盖率；最高价按最高评分，不选OHLC中最有利的一项。',
    '条件只筛选输出，不声称它改变同一原点的原始外推值。训练残差修正另作候选，不写入应用默认值。',
    '没有分钟路径，不确认支撑压力反应；MA5代数阈值不计作收盘预测。',
  ], datasets: [] }
for (const dataset of datasets) {
  const split = Math.floor(dataset.bars.length * .8)
  const rows = []
  for (let i = 30; i < dataset.bars.length - 1; i++) {
    const history = dataset.bars.slice(Math.max(0, i - 59), i + 1)
    const asOf = history.at(-1).day + 'T15:00:00+08:00'
    const input = { symbol: dataset.symbol, asOf, sourceMode: 'real', calendar: null, loadIssues: {}, periods: { day: {
      symbol: dataset.symbol, period: 'day', adjustment: dataset.adjustment, asOf, source: dataset.source, closed: history, observed: [],
      lastClosedAt: asOf, issues: ['calendar_history_unverified'],
    } } }
    const run = runNotePriceModels(input)
    const actual = dataset.bars[i + 1]
    for (const result of run.results.filter(result => result.card.role === 'high')) rows.push({ symbol: dataset.symbol, origin: run.origin,
      target: actual.day, split: i + 1 < split ? 'research' : 'time_holdout', id: result.card.id, status: result.status,
      reason: result.reason, value: result.value, actualHigh: actual.high, baselines: result.baselines,
      // Date is resolved for scoring only, after computing from history with calendar=null.
      resolvedAfterCalculation: true })
  }
  const models = ['climb_high', 'rebound_high'].map(id => {
    const all = rows.filter(row => row.id === id)
    const train = all.filter(row => row.split === 'research' && row.status === 'computed')
    const testAll = all.filter(row => row.split === 'time_holdout')
    const test = testAll.filter(row => row.status === 'computed')
    const residuals = train.map(row => row.actualHigh / row.value - 1)
    const correction = train.length >= 30 ? quantile(residuals, .5) : null
    const low = correction !== null ? quantile(residuals, .1) : null
    const high = correction !== null ? quantile(residuals, .9) : null
    return { id, trainSamples: train.length, validationOrigins: testAll.length, issued: test.length,
      outputCoverage: testAll.length ? test.length / testAll.length : 0,
      skipped: testAll.filter(row => row.status !== 'computed').length,
      conditional: summarize(test, row => row.value),
      previousHighOnSameOrigins: summarize(test, row => row.baselines.previousHigh),
      previousCloseOnSameOrigins: summarize(test, row => row.baselines.previousClose),
      noConditionOnSameOrigins: summarize(test, row => row.baselines.unconditional),
      noConditionAllOrigins: summarize(testAll, row => row.baselines.unconditional),
      residualCandidate: { status: correction === null ? 'insufficient_training_samples' : 'experimental_not_enabled', trainMedian: correction,
        corrected: summarize(test, row => correction === null ? null : row.value * (1 + correction)),
        intervalCoverage: correction === null ? null : mean(test.map(row => row.actualHigh >= row.value * (1 + low) && row.actualHigh <= row.value * (1 + high) ? 1 : 0)),
        meanIntervalWidthRatio: correction === null ? null : mean(test.map(row => row.value * (high - low) / row.actualHigh)) },
    }
  })
  report.datasets.push({ symbol: dataset.symbol, path: relative(resolve(root, '..'), dataset.path).replaceAll('\\', '/'), sourceHash: hash(dataset.path),
    adjustment: dataset.adjustment, source: dataset.source, bars: dataset.bars.length,
    researchThrough: dataset.bars[split - 1].day, holdoutFrom: dataset.bars[split].day, models, rows })
}
const output = resolve(root, '../research/note-price-models-v1')
mkdirSync(output, { recursive: true })
writeFileSync(resolve(output, 'historical-audit.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report.datasets.map(({ symbol, models }) => ({ symbol, models })), null, 2))
