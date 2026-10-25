'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ScenarioAnalysis } from '../scenario/scenario-types'
import { DEFAULT_NOTE_PRICE_CONFIG, runNotePriceModels, type NotePriceConfig } from './note-price-models'
import { appendNotePriceSnapshot, evaluateNotePriceSnapshot, freezeNotePriceSnapshot, NOTE_PRICE_STORAGE_KEY,
  parseNotePriceSnapshots, type NotePriceSnapshot, NOTE_PRICE_EVALUATION_KEY, parseNotePriceEvaluations,
  freezeNotePriceEvaluation, appendNotePriceEvaluation, type NotePriceEvaluation } from './note-price-ledger'
import './note-price-workbench.css'

const timingLabels: Record<NotePriceSnapshot['timing'], string> = {
  local_before_window: '本地盘前记录 · 时间未经服务器核验', replay: '历史回放', unresolved: '目标日期未核实', demo: '合成示例',
}
const inputLabels: Record<string, string> = { close1: '倒数第4根收盘', close2: '倒数第3根收盘', close3: '倒数第2根收盘', close4: '最新完整收盘',
  close: '原点收盘', ma5: '原点MA5', previousMa5: '上一根MA5', upper: '原点BOLL上轨', upperTwoBarsAgo: '前第2根BOLL上轨',
  maxObservedDistance: '观察到的最大贴轨距离（比例）', touchBars: '贴轨观察根数', maxAllowedDistance: '贴轨阈值（比例）' }
function download(name: string, value: string) {
  const url = URL.createObjectURL(new Blob([value], { type: 'application/json;charset=utf-8' }))
  const link = document.createElement('a'); link.href = url; link.download = name; link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function NotePriceWorkbench({ analysis, onRefresh }: { analysis: ScenarioAnalysis; onRefresh: () => unknown }) {
  const [config, setConfig] = useState<NotePriceConfig>({ ...DEFAULT_NOTE_PRICE_CONFIG })
  const [ledger, setLedger] = useState<{ ready: boolean; records: NotePriceSnapshot[]; error: string }>({ ready: false, records: [], error: '' })
  const [selectedId, setSelectedId] = useState('')
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [evaluations, setEvaluations] = useState<NotePriceEvaluation[]>([])
  const [evaluationError, setEvaluationError] = useState('')
  useEffect(() => {
    let active = true
    const read = () => {
      try { const records = parseNotePriceSnapshots(localStorage.getItem(NOTE_PRICE_STORAGE_KEY)); if (active) setLedger({ ready: true, records, error: '' }) }
      catch (error) { if (active) setLedger({ ready: false, records: [], error: error instanceof Error ? error.message : '记录读取失败' }) }
      try { const values = parseNotePriceEvaluations(localStorage.getItem(NOTE_PRICE_EVALUATION_KEY)); if (active) { setEvaluations(values); setEvaluationError('') } }
      catch (error) { if (active) setEvaluationError(error instanceof Error ? error.message : '核对历史读取失败') }
    }
    queueMicrotask(read)
    const storage = (event: StorageEvent) => { if (event.key === NOTE_PRICE_STORAGE_KEY || event.key === NOTE_PRICE_EVALUATION_KEY || event.key === null) read() }
    window.addEventListener('storage', storage)
    window.addEventListener('stockcal:note-price-saved', read)
    return () => { active = false; window.removeEventListener('storage', storage); window.removeEventListener('stockcal:note-price-saved', read) }
  }, [])
  const current = useMemo(() => {
    try { return { run: runNotePriceModels(analysis.input, config), error: '' } }
    catch (error) { return { run: null, error: error instanceof Error ? error.message : '计算失败' } }
  }, [analysis.input, config])
  const records = ledger.records.filter(record => record.input.symbol === analysis.input.symbol && record.input.sourceMode === analysis.input.sourceMode)
  const selected = records.find(record => record.id === selectedId)
  const evaluation = selected && analysis.input.periods.day ? evaluateNotePriceSnapshot(selected, analysis.input.periods.day) : []
  const savedEvaluations = evaluations.filter(value => value.forecast.id === selectedId)
  function save() {
    try {
      const record = freezeNotePriceSnapshot(analysis.input, config, crypto.randomUUID(), new Date().toISOString())
      const records = appendNotePriceSnapshot(localStorage, record)
      setLedger({ ready: true, records, error: '' }); setSelectedId(record.id); setActionError('')
      setNotice('已追加冻结记录；刷新后按原定义核对，修改参数不会改写此记录。')
      window.dispatchEvent(new Event('stockcal:note-price-saved'))
    } catch (error) { setActionError(error instanceof Error ? error.message : '保存失败，原有记录未覆盖') }
  }
  function exportRecords() {
    try {
      const frozen = parseNotePriceSnapshots(localStorage.getItem(NOTE_PRICE_STORAGE_KEY))
      download('stockcal-note-price-shadow.json', JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(),
        note: '本地冻结记录；时间未经服务器核验，历史回放与合成示例不属于前瞻业绩。', records: frozen,
        frozenEvaluations: parseNotePriceEvaluations(localStorage.getItem(NOTE_PRICE_EVALUATION_KEY)),
        evaluations: frozen.filter(record => record.input.symbol === analysis.input.symbol && record.input.sourceMode === analysis.input.sourceMode)
          .map(record => ({ id: record.id, evaluatedAsOf: analysis.input.asOf,
            scores: analysis.input.periods.day ? evaluateNotePriceSnapshot(record, analysis.input.periods.day) : [] })) }, null, 2))
    } catch (error) { setActionError(error instanceof Error ? error.message : '导出失败') }
  }
  function saveEvaluation() {
    if (!selected || !analysis.input.periods.day) return
    try {
      const frozen = freezeNotePriceEvaluation(selected, analysis.input.periods.day, crypto.randomUUID(), new Date().toISOString())
      setEvaluations(appendNotePriceEvaluation(localStorage, frozen)); setActionError(''); setNotice('已追加核对版本，保留核对行情及先前成功／失败结果。')
      window.dispatchEvent(new Event('stockcal:note-price-saved'))
    } catch (error) { setActionError(error instanceof Error ? error.message : '核对结果保存失败') }
  }
  return <section id="note-price-research" className="np-workbench" aria-label="笔记条件价格研究">
    <header><div><h3>笔记驱动价位 · 影子研究</h3><p>先判条件，再算目标；与普通指标合并价分别核对。</p></div><span className="np-badge">尚未证明预测增益</span></header>
    <p>临界价用于判断条件；高点假设用于检验笔记。这里不生成确定的未来蜡烛，也不把研究结果自动升级为交易信号。</p>
    <details className="np-definition"><summary>研究定义与人工调整</summary><p>原文未明确的条件先采用下列程序定义；你可以调整并另存版本。调整后的结果不会修改已经冻结的记录。</p>
      <div className="np-fields"><label>攀升指标目标<select value={config.upperMapping} onChange={event => setConfig(old => ({ ...old, upperMapping: Number(event.target.value) as 1 | 2 }))}><option value={2}>高点第1根 → 上轨第2根（字面研究解释）</option><option value={1}>高点第1根 → 上轨第1根（备选研究假设）</option></select></label>
        <label>连续贴轨根数<input type="number" min="1" max="10" value={config.touchBars} onChange={event => setConfig(old => ({ ...old, touchBars: Number(event.target.value) }))} /></label>
        <label>贴轨最大距离（%）<input type="number" min="0.01" max="10" step="0.1" value={Number((config.touchDistance * 100).toFixed(4))} onChange={event => setConfig(old => ({ ...old, touchDistance: Number(event.target.value) / 100 }))} /></label></div>
      <p>攀升：MA5向上且最近所选根数收盘贴近各自BOLL20/2上轨；反抽：收盘低于MA5且MA5向下。均为可验证的程序代理，不等同于人工确认盈利模式。</p>
    </details>
    {current.error ? <p role="alert">{current.error}</p> : null}
    <div className="np-models">{current.run?.results.map(result => <article key={result.card.id} aria-label={result.card.name}>
      <div className="np-card-heading"><h4>{result.card.name}</h4><span>{result.card.role === 'boundary' ? '条件临界价' : '次日最高价实验'}</span></div>
      <strong className="np-price">{result.status === 'computed' ? result.value!.toFixed(2) : '—'}</strong>
      <p>{result.reason}</p><p>价格窗口：{result.priceTarget.barKey ?? '日期待核实'} · 第{result.priceTarget.horizon}根日K{result.indicatorTarget ? `；指标：${result.indicatorTarget.barKey ?? '日期待核实'} · 第${result.indicatorTarget.horizon}根` : ''}</p>
      <details><summary>计算、原文与失效条件</summary><p>{result.card.formula}</p><p>{result.card.researchDefinition}</p><p>失效：{result.card.invalidation}</p>
        <dl>{Object.entries(result.inputs).map(([name, value]) => <div key={name}><dt>{inputLabels[name] ?? name}</dt><dd>{Number.isFinite(value) ? value.toFixed(4) : '不足'}</dd></div>)}</dl>
        <a href={result.card.source.sourceUrl} target="_blank" rel="noopener noreferrer">查看原文 · {result.card.source.file}</a>
        {result.card.source.evidence.map(evidence => <blockquote key={`${evidence.startLine}:${evidence.quote}`}>L{evidence.startLine}–{evidence.endLine}：{evidence.quote}</blockquote>)}
      </details>
    </article>)}</div>
    {ledger.error ? <p role="alert">{ledger.error}<button type="button" onClick={() => {
      try { download('stockcal-note-price-raw-backup.json', localStorage.getItem(NOTE_PRICE_STORAGE_KEY) ?? '') }
      catch { setActionError('浏览器不允许读取备份，原记录未被覆盖。') }
    }}>导出原始备份</button></p> : null}
    {evaluationError ? <p role="alert">{evaluationError}<button type="button" onClick={() => {
      try { download('stockcal-note-price-evaluation-raw.json', localStorage.getItem(NOTE_PRICE_EVALUATION_KEY) ?? '') }
      catch { setActionError('核对备份无法读取，原有内容未覆盖。') }
    }}>导出核对原始备份</button></p> : null}
    {actionError ? <p role="alert">{actionError}</p> : null}{notice ? <p role="status">{notice}</p> : null}
    <div className="np-actions"><button type="button" disabled={!ledger.ready || !!ledger.error || !current.run?.results.some(result => result.status === 'computed')} onClick={save}>冻结本次笔记计算</button><button type="button" onClick={() => void onRefresh()}>刷新行情并核对记录</button><button type="button" disabled={!ledger.ready || !!ledger.error} onClick={exportRecords}>导出笔记影子记录</button></div>
    <details className="np-history" open={!!selected}><summary>本地冻结记录 · {records.length} 条</summary>
      <p>真实未来窗口可作影子跟踪；过去窗口、日期未核实及示例单独标记。本地时钟不是服务器事前凭证。</p>
      {[...records].reverse().map(record => <button type="button" key={record.id} aria-pressed={record.id === selectedId} onClick={() => setSelectedId(record.id)}>{record.createdAt.slice(0, 19).replace('T', ' ')} UTC · {timingLabels[record.timing]} · 查看冻结记录</button>)}
      {selected ? <section aria-label="冻结笔记计算核对"><h4>{timingLabels[selected.timing]}</h4><p>原点 {selected.run.origin} · 价格口径 {selected.run.adjustment === 'qfq' ? '前复权' : '不复权'} · 贴轨 {selected.run.config.touchBars} 根／{(selected.run.config.touchDistance * 100).toFixed(2)}% · 上轨第{selected.run.config.upperMapping}根</p>
        {selected.run.results.map((result, i) => <div className="np-score" key={result.card.id}><strong>{result.card.name} · 冻结值 {result.value?.toFixed(2) ?? '未输出'}</strong><p>{evaluation[i]?.reason ?? '暂无核对行情'}</p>
          {evaluation[i]?.relativeError != null ? <p>目标最高 {evaluation[i].actualHigh?.toFixed(2)} · 误差 {(evaluation[i].relativeError! * 100).toFixed(2)}% · {evaluation[i].withinOnePercent ? '小于1%' : '未达到小于1%标准'}；前高基准误差 {((evaluation[i].previousHighError ?? 0) * 100).toFixed(2)}%</p> : null}
          {evaluation[i]?.boundaryHeld !== null && evaluation[i]?.boundaryHeld !== undefined ? <p>{evaluation[i].boundaryHeld ? '目标收盘达到临界价' : '目标收盘未达到临界价'}，不计作收盘价格预测命中。</p> : null}</div>)}
        <button type="button" disabled={!!evaluationError || !evaluation.some(score => score.status === 'evaluated' || score.status === 'basis_changed')} onClick={saveEvaluation}>冻结本次核对结果</button>
        <details><summary>核对版本 · {savedEvaluations.length} 条</summary>{savedEvaluations.map(value => <div key={value.id}><strong>{value.evaluatedAt}</strong>{value.scores.map(score => <p key={score.modelId}>{selected.run.results.find(result => result.card.id === score.modelId)?.card.name}：{score.reason}{score.relativeError !== null ? ` · 误差 ${(score.relativeError * 100).toFixed(2)}%` : ''}</p>)}</div>)}</details>
      </section> : null}
    </details>
  </section>
}
