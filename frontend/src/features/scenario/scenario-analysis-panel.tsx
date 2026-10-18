'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { BrowserMarketClient } from '@/lib/api/browser-client'
import { browserMarketClient } from '@/lib/api/browser-client'
import type { ChartPeriod } from '../chart/chart-periods'
import type { Security } from '../workspace/stock-workspace-types'
import { currentTagRecords, mergeTagVersions, NOTE_TAG_STORAGE_KEY, parseTagLedger, type NoteCatalog, type NoteTagRecord } from '../knowledge/note-tags'
import type { AnalysisAnnotations, AnalysisPeriod, CloseScenario, DailyPriceSelection, ExecutionWindow, Horizon, PriceReference, ScenarioAnalysis, ScenarioRule } from './scenario-types'
import { useScenarioInputs } from './use-scenario-inputs'
import { scenarioCalendar } from './scenario-calendar-data'
import { buildScenarioRuleRegistry } from './scenario-rule-registry'
import { buildScenarioAnalysis } from './scenario-engine'
import { parseScenarioLedger, saveScenarioSnapshot, SCENARIO_STORAGE_KEY, validExecutionWindow } from './scenario-ledger'
import { ScenarioConfirmationForm } from './scenario-confirmation-form'
import { ScenarioReferenceTable } from './scenario-reference-table'
import { ScenarioPriceSummary } from './scenario-price-summary'
import { resolveDailyPriceLimit } from './scenario-price-ladder'
import { adaptivePeriodPlan, scopedPeriodInput } from './scenario-period-policy'
import { ANALYSIS_PERIODS } from './scenario-calendar'
import { DIRECTION_NAMES, displayTime, INDICATOR_NAMES, issueLabel, METHOD_NAMES, MODE_NAMES, PERIOD_NAMES, RULE_STATUS_NAMES, STYLE_NAMES } from './scenario-labels'
import { evaluateIndicatorError, evaluateRangeCoverage } from './scenario-evaluation'
import { SCENARIO_INDICATORS } from './scenario-calculator'
import { annotationsForPeriod } from './scenario-state'
import { useScenarioCloudRecords, cloudRecordKey } from './use-scenario-cloud-records'
import { ScenarioPriceEvaluation } from './scenario-price-evaluation'
import { freezeLegacyBindings } from './scenario-research-export'
import { loadStudySelections } from '../knowledge/note-study-selections'
import './scenario-analysis-panel.css'
export type ScenarioAnalysisPanelProps = {
  symbol: string; sourceMode: 'real' | 'demo'; activePeriod: ChartPeriod
  onPeriodChange: (period: ChartPeriod) => void; client?: Pick<BrowserMarketClient, 'series'>; security?: Security
}
export function ScenarioAnalysisPanel(props: ScenarioAnalysisPanelProps) {
  return <ScenarioPanel key={props.symbol + ':' + props.sourceMode} {...props} />
}
function ScenarioPanel({ symbol, sourceMode, activePeriod, onPeriodChange, client = browserMarketClient, security }: ScenarioAnalysisPanelProps) {
  const requestedPeriod: AnalysisPeriod = activePeriod === '60m' || activePeriod === '30m' ? activePeriod : 'day'
  const loader = useScenarioInputs({ symbol, sourceMode, calendar: scenarioCalendar, client })
  const [annotations, setAnnotations] = useState<AnalysisAnnotations>({})
  const [paths, setPaths] = useState<CloseScenario[]>([])
  const [registry, setRegistry] = useState<ScenarioRule[] | null>(null)
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null)
  const [records, setRecords] = useState<ScenarioAnalysis[]>([])
  const tagVersions = useRef<NoteTagRecord[]>([])
  const cloud = useScenarioCloudRecords({ symbol, localRecords: records })
  const [exporting, setExporting] = useState(false)
  const [storageReady, setStorageReady] = useState(false)
  const [storageError, setStorageError] = useState<string | null>(null)
  const [analysisId, setAnalysisId] = useState(() => crypto.randomUUID())
  const [history, setHistory] = useState<ScenarioAnalysis | null>(null)
  const [showForm, setShowForm] = useState(false), [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(''), [actionError, setActionError] = useState<string | null>(null)
  const [method, setMethod] = useState<PriceReference['method']>('average_delta')
  const [scenarioIds, setScenarioIds] = useState<Partial<Record<AnalysisPeriod, string>>>({})
  const [limitChoice, setLimitChoice] = useState('auto')
  const securityName = security?.code === symbol ? security.name : undefined
  const priceSelection = useMemo<DailyPriceSelection>(() => ({ limit: limitChoice === 'auto'
    ? resolveDailyPriceLimit(symbol, securityName) : limitChoice === 'unverified'
      ? { source: 'unverified', ratio: null, label: '不限幅或规则待核实' }
      : { source: 'manual', ratio: Number(limitChoice), label: '手动设定 ±' + Number(limitChoice) * 100 + '%' } }), [limitChoice, symbol, securityName])
  const [horizonChoice, setHorizonChoice] = useState('1,2,3')
  const [executionWindow, setExecutionWindow] = useState<ExecutionWindow | null>(null)
  const [windowStart, setWindowStart] = useState(''), [windowEnd, setWindowEnd] = useState('')
  const [windowPeriod, setWindowPeriod] = useState<AnalysisPeriod>('day')
  useEffect(() => {
    let active = true
    Promise.resolve().then(() => {
      if (!active) return
      try { setRecords(parseScenarioLedger(localStorage.getItem(SCENARIO_STORAGE_KEY))) }
      catch (e) { setStorageError(e instanceof Error ? e.message : '分析记录读取失败，原值已保留') }
      setStorageReady(true)
    })
    void import('../knowledge/note-tag-catalog.json').then(module => {
      if (!active) return
      const catalog = module.default as NoteCatalog
      let local = [] as ReturnType<typeof parseTagLedger>
      try { local = parseTagLedger(localStorage.getItem(NOTE_TAG_STORAGE_KEY)) }
      catch { setKnowledgeError('本地标签修订记录不可读，本次使用原始笔记目录。') }
      tagVersions.current = mergeTagVersions([...catalog.documents, ...catalog.fragments], local)
      setRegistry(buildScenarioRuleRegistry(currentTagRecords([...catalog.documents, ...catalog.fragments], local)))
    }).catch(() => { if (active) setKnowledgeError('笔记来源暂未加载，请刷新后再确认模式。') })
    return () => { active = false }
  }, [])
  useEffect(() => {
    const reload = (event: StorageEvent) => {
      if (event.key !== SCENARIO_STORAGE_KEY) return
      try { setRecords(parseScenarioLedger(localStorage.getItem(SCENARIO_STORAGE_KEY))); setStorageError(null) }
      catch { setStorageError('共享分析记录不可读取，原值已保留') }
    }
    window.addEventListener('storage', reload)
    return () => window.removeEventListener('storage', reload)
  }, [])
  const horizons = useMemo(() => horizonChoice.split(',').map(Number) as Horizon[], [horizonChoice])
  const scopedInput = useMemo(() => loader.input ? scopedPeriodInput(loader.input, annotations) : null, [loader.input, annotations])
  const plan = useMemo(() => scopedInput ? adaptivePeriodPlan(scopedInput, annotations) : null, [scopedInput, annotations])
  const maximumPeriod = plan?.maxPeriod ?? '30m'
  const retainThrough = loader.retainThrough
  useEffect(() => {
    let active = true
    queueMicrotask(() => { if (active) retainThrough(maximumPeriod) })
    return () => { active = false }
  }, [maximumPeriod, retainThrough])
  const period = (history ? !!history.input.periods[requestedPeriod] : plan?.includedPeriods.includes(requestedPeriod))
    ? requestedPeriod : history ? 'day' : plan?.primaryPeriod ?? 'day'
  const latestVersion = records.filter(r => r.id === analysisId).reduce((v, r) => Math.max(v, r.version), 0)
  const draft = useMemo(() => {
    if (!scopedInput) return { analysis: null, error: null }
    try {
      const analysis = buildScenarioAnalysis(scopedInput, annotations, { id: analysisId, version: latestVersion + 1,
        ...(latestVersion ? { previousVersion: latestVersion } : {}), createdAt: new Date().toISOString(), kind: 'live',
        registry: registry ?? [], scenarios: paths, horizons, executionWindow, mergeSelection: { method, scenarioIds }, priceSelection })
      return { analysis, error: null }
    } catch (e) { return { analysis: null, error: e instanceof Error ? e.message : '分析计算暂不可用' } }
  }, [scopedInput, annotations, analysisId, latestVersion, registry, paths, horizons, executionWindow, method, scenarioIds, priceSelection])
  const analysis = history ?? draft.analysis
  const displayedMethod = history?.consolidation?.method ?? method
  const availableScenarios = analysis?.scenarios.filter(s => s.period === period) ?? []
  const selectedScenarioId = history?.consolidation?.scenarioIds[period] ?? scenarioIds[period]
  const chosenScenario = availableScenarios.find(s => s.id === selectedScenarioId) ?? availableScenarios[0]
  const stockRecords = records.filter(r => r.input.symbol === symbol)
  const actual = loader.input?.periods[period]
  const coverage = history?.references[0]?.executionWindow && loader.input?.periods[history.references[0].executionWindow.period]
    ? evaluateRangeCoverage(history, loader.input.periods[history.references[0].executionWindow.period]!, history.references[0].executionWindow) : null
  const errors = history && actual ? evaluateIndicatorError(history, actual) : null
  async function confirm(next: AnalysisAnnotations, path: CloseScenario | null) {
    setBusy(true); setActionError(null)
    try {
      await loader.refresh()
      setAnnotations(next)
      setPaths(old => [...old.filter(s => s.period !== period), ...(path ? [path] : [])])
      if (path || next.shocks?.day || next.shocks?.['60m']) setMethod('rolling_close')
      if (path) setScenarioIds(old => ({ ...old, [path.period]: path.id }))
      setNotice('人工确认已记录')
    } finally { setBusy(false) }
  }
  async function choosePeriod(target: AnalysisPeriod) {
    if (history) { onPeriodChange(target); return }
    if (ANALYSIS_PERIODS.indexOf(target) > ANALYSIS_PERIODS.indexOf(maximumPeriod)) return
    if (target === '30m' && !loader.input?.periods['60m'] && !loader.input?.loadIssues['60m']) return
    onPeriodChange(target)
    if (!loader.input?.periods[target]?.closed.length || loader.input?.loadIssues[target]) {
      setActionError(null)
      try { await loader.loadPeriod(target) }
      catch (error) { setActionError(error instanceof Error ? error.message : '该周期读取失败') }
    }
  }
  function save() {
    if (!draft.analysis) return
    setActionError(null)
    try {
      const frozen = { ...draft.analysis, createdAt: new Date().toISOString() }
      setRecords(saveScenarioSnapshot(localStorage, frozen)); window.dispatchEvent(new Event('stockcal:scenario-saved')); setNotice('已保存分析版本' + frozen.version)
      const selected = cloud.identityScope ? loadStudySelections(cloud.identityScope) : []
      void cloud.saveFrozen(frozen, [...freezeLegacyBindings(frozen, tagVersions.current), ...selected.map(s => ({ revisionId: s.revisionId, sourceHash: s.sourceHash, legacyKey: null, inlineVersion: null }))])
    }
    catch (e) { setActionError(e instanceof Error ? e.message : '分析未保存，当前结果仍可导出。') }
  }
  async function exportRecords() {
    setExporting(true)
    try {
      const raw = storageError ? localStorage.getItem(SCENARIO_STORAGE_KEY) : null
      const research = raw ? null : await cloud.exportSaved()
      const blob = new Blob([raw ?? JSON.stringify({ schemaVersion: 1, symbol, sourceMode,
        records: stockRecords, currentAnalysis: draft.analysis, indicatorEvaluation: errors, rangeCoverageEvaluation: coverage,
        research: research?.exports ?? [], missingResearchEvidence: research?.missing ?? [] }, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob), link = document.createElement('a')
      link.href = url; link.download = 'stockcal-' + symbol + '-scenario-analysis.json'; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) { setActionError(error instanceof Error ? error.message : '导出暂不可用，请检查浏览器下载权限。') }
    finally { setExporting(false) }
  }
  function applyWindow() {
    const next = { period: windowPeriod, startAt: windowStart + ':00+08:00', endAt: windowEnd + ':00+08:00' }
    if (!validExecutionWindow(next)) { setActionError('请填写完整且结束晚于开始的北京时间执行窗口。'); return }
    setExecutionWindow(next); setActionError(null); setNotice('执行窗口已记录')
  }
  const canConfirm = !!loader.input?.periods[period]?.closed.length && !!registry && !busy && loader.status !== 'loading'
  const canSave = !!draft.analysis && sourceMode === 'real' && !!registry && storageReady && !storageError && loader.status !== 'loading' && !busy
    && cloud.ready && !Object.entries(cloud.entries).some(([key, entry]) => key.startsWith(analysisId + '@') && entry.status === 'pending')
  return <section id="scenario-analysis" className="sa-panel" aria-label="多周期情景分析" data-testid="scenario-analysis">
    <header className="sa-header"><div><span className="sa-eyebrow">{symbol === '603533' ? '掌阅科技 · 603533' : symbol}</span><h2>按需逐级分析</h2><p>趋势 → 葛阶段 → 盈利模式 → MA/BOLL参考位 → 交易原则</p></div>
      <button type="button" onClick={() => { void loader.refresh() }} disabled={busy || loader.status === 'loading'}>刷新分析行情</button>
    </header>
    {sourceMode === 'demo' ? <p className="sa-note">合成示例分析</p> : null}
    {history ? <p className="sa-note">历史快照，只读 · {displayTime(history.input.asOf)} · {history.kind === 'replay' ? '历史回放' : '当时保存的分析'}</p>
      : <p className="sa-time">分析时点 {displayTime(loader.input?.asOf ?? null)} · 正式判断使用已结束K线</p>}
    <p className="sa-source-status" role="status">{registry ? '笔记来源已加载' : '正在读取笔记依据'}</p>
    {knowledgeError ? <p role="alert">{knowledgeError}</p> : null}
    {(actionError || draft.error || storageError) ? <p role="alert">{actionError ?? draft.error ?? storageError}</p> : null}
    {notice ? <p role="status">{notice}</p> : null}
    {loader.issues.map(issue => <p className="sa-note" role="status" key={issue}>{issueLabel(issue)}</p>)}
    <section className="sa-note" aria-label="周期判断与停止">
      {history ? <p>历史记录按保存时参与的周期展示。</p> : !plan ? <p>先读取日线，准备核对趋势和盈利模式。</p> : plan.clearPeriod ? <p>{PERIOD_NAMES[plan.clearPeriod]}规律已确认，以该周期为主判断。
        {plan.nextPeriod ? '可到此停止；如需额外核对，最多再看' + PERIOD_NAMES[plan.nextPeriod] + '。' : '已保留最多一个下级核对周期，停止继续下钻。'}</p>
        : <p>先看日线；趋势或盈利模式尚未确认时，再按需看下一级。{plan?.nextPeriod ? '下一可选周期：' + PERIOD_NAMES[plan.nextPeriod] + '。' : '已到最小周期，规律仍待核对。'}</p>}
      <small>停止依据：当前完整K线的趋势和盈利模式均经人工确认；需要足够的MA/BOLL样本。</small>
    </section>
    <nav className="sa-drill" aria-label="分析周期下钻">
      <button type="button" disabled={busy || loader.status === 'loading'} aria-pressed={period === 'day'} onClick={() => { void choosePeriod('day') }}>日线分析</button><span aria-hidden="true">→</span>
      <button type="button" disabled={busy || loader.status === 'loading' || !!history && !history.input.periods['60m']} aria-pressed={period === '60m'} onClick={() => { void choosePeriod('60m') }}>看1小时</button><span aria-hidden="true">→</span>
      <button type="button" disabled={busy || loader.status === 'loading' || (history ? !history.input.periods['30m'] : maximumPeriod !== '30m' || !loader.input?.periods['60m'] && !loader.input?.loadIssues['60m'])}
        aria-pressed={period === '30m'} onClick={() => { void choosePeriod('30m') }}>继续看30分钟</button>
    </nav>
    <div className="sa-state-grid">{ANALYSIS_PERIODS.filter(p => analysis?.input.periods[p] || analysis?.input.loadIssues[p] || !analysis && p === 'day').map(p => {
      const state = analysis?.states[p], input = analysis?.input.periods[p]
      const direction = state ? DIRECTION_NAMES[state.direction] + (!state.confirmed && state.direction !== 'unknown' ? '候选' : '') : '待确认'
      return <section className={'sa-state sa-state-' + (state?.direction ?? 'unknown')} key={p} aria-label={PERIOD_NAMES[p] + '状态'}>
        <h3>{PERIOD_NAMES[p]} <strong>{direction}</strong></h3><p>{state?.confirmed ? '人工确认 · ' : ''}{STYLE_NAMES[state?.style ?? 'unknown']}</p>
        <dl><div><dt>{PERIOD_NAMES[p]} MA5</dt><dd>{state?.facts.ma5?.toFixed(2) ?? '—'}</dd></div><div><dt>MA10 / MA20</dt><dd>{state?.facts.ma10?.toFixed(2) ?? '—'} / {state?.facts.ma20?.toFixed(2) ?? '—'}</dd></div>
          <div><dt>BOLL中轨</dt><dd>{state?.facts.bollMiddle?.toFixed(2) ?? '—'}</dd></div><div><dt>葛阶段</dt><dd>{state?.granville.stage ? (state.granville.context === 'up' ? '上涨' : '下跌') + ' 葛' + state.granville.stage : '起点待确认'}</dd></div></dl>
        <small>{input ? '完整' + input.closed.length + '根 · 未完成' + input.observed.length + '根' : p === '30m' ? '尚未读取，可继续下钻' : '行情待加载'}</small>
        <small>最新完整K线 {displayTime(input?.lastClosedAt ?? null)}</small>
        {input ? <><small>{input.source.name} · {input.source.online ? '延时行情' : '离线缓存'} · 采集 {displayTime(input.source.fetchedAt)}</small>
          {input.issues.length ? <details><summary>数据范围与缺项</summary><p>{input.issues.map(issueLabel).join('；')}</p></details> : null}</> : null}
        {state ? <details><summary>查看形态计算依据</summary><dl>{([
          ['MA5变化', state.facts.ma5Delta], ['MA10变化', state.facts.ma10Delta], ['MA20变化', state.facts.ma20Delta],
          ['BOLL中轨变化', state.facts.bollMiddleDelta], ['BOLL带宽', state.facts.bandwidth], ['量比（前5根）', state.facts.volumeRatio],
          ['实体', state.facts.body], ['上影', state.facts.upperWick], ['下影', state.facts.lowerWick], ['波幅', state.facts.range],
          ['距MA5', state.facts.ma5Distance], ['距MA20', state.facts.ma20Distance],
        ] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value?.toFixed(4) ?? '—'}</dd></div>)}</dl>
          <p>高点上移：{state.facts.higherHigh === null ? '待核对' : state.facts.higherHigh ? '是' : '否'} · 低点上移：{state.facts.higherLow === null ? '待核对' : state.facts.higherLow ? '是' : '否'}</p></details> : null}
        {state?.shockConfirmed ? <p className="sa-note">已人工标注大阳线，结合下层K线核对延续／消化／回撤。</p> : null}
        {!history && loader.input?.loadIssues[p] ? <button type="button" onClick={() => { void choosePeriod(p) }}>重试{PERIOD_NAMES[p]}</button> : null}
      </section>
    })}</div>
    {!history ? <><button type="button" aria-expanded={showForm} disabled={!canConfirm} onClick={() => setShowForm(v => !v)}>核对形态与模式</button>
      {showForm && loader.input ? <ScenarioConfirmationForm key={period + ':' + loader.input.periods[period]?.closed.at(-1)?.day}
        input={loader.input} period={period} previous={annotationsForPeriod(annotations, period)} requiredCloses={Math.max(...horizons)} busy={busy} onConfirm={confirm} /> : null}</> : null}
    {analysis ? <>
      {analysis.provisional?.map(p => <section key={p.period} className="sa-section sa-note" aria-label={PERIOD_NAMES[p.period] + '盘中暂估'}>
        <h3>{PERIOD_NAMES[p.period]}盘中暂估 · 尚未收盘</h3><p>观察价 {p.observedClose.toFixed(2)} · 采集 {displayTime(p.observedAt)}</p>
        <p>{p.condition} 正式模式、风险与覆盖核对使用上方完整K线。</p>
        <details><summary>展开暂估指标与未来参考位</summary><div className="sa-table-scroll"><table className="sa-reference-table">
          <caption>{PERIOD_NAMES[p.period]}未完成柱假设 · {displayTime(p.originBarKey)}</caption>
          <thead><tr><th>指标</th><th>当前暂估</th>{horizons.map(h => <th key={h}>暂估后第{h}根</th>)}</tr></thead>
          <tbody>{SCENARIO_INDICATORS.map(key => <tr key={key}><th>{INDICATOR_NAMES[key]}</th><td>{p.indicators[key]?.toFixed(2) ?? '历史不足'}</td>
            {horizons.map(h => { const r = p.references.find(r => r.indicator === key && r.target.horizon === h); return <td key={h}>{r?.valid ? r.value!.toFixed(2) : '历史不足'}</td> })}</tr>)}</tbody>
        </table></div></details>
      </section>)}
      <section className="sa-section" aria-label="盈利模式依据"><h3>盈利模式与缺项</h3><div className="sa-mode-grid">{analysis.modeCandidates.map(m => <div key={m.period + ':' + m.id}>
        <strong>{PERIOD_NAMES[m.period]} · {MODE_NAMES[m.id]}</strong><span>{m.status === 'confirmed' ? '已人工确认' : m.status === 'candidate' ? '候选，待确认' : m.status === 'not_applicable' ? '本次不适用' : '条件不足'}</span>
        {m.missing.length ? <small>{m.missing.map(issueLabel).join('、')}</small> : null}
        {m.mirrorOutcome ? <small>{({ support_confirmed: '回踩支撑确认', support_failed: '回踩支撑失效', resistance_confirmed: '反抽受阻', turned_stronger: '重新站回，转强分支' })[m.mirrorOutcome]}</small> : null}
      </div>)}</div></section>
      <ScenarioPriceSummary analysis={analysis} loading={loader.status === 'loading' || busy}
        autoLimit={history?.dailyPriceLadder?.selection.limit ?? resolveDailyPriceLimit(symbol, securityName)} limitChoice={history
          ? history.dailyPriceLadder?.selection.limit.source === 'manual' ? String(history.dailyPriceLadder.selection.limit.ratio)
            : history.dailyPriceLadder?.selection.limit.source === 'unverified' ? 'unverified' : 'auto' : limitChoice}
        onLimitChange={history ? undefined : setLimitChoice} />
      <section className="sa-section" aria-label="前三后三参数"><h3>前三后三参数</h3>
        {!analysis.input.calendar ? <p className="sa-note">交易日历未核实，目标日期待核实</p> : null}
        <div className="sa-controls"><label>计算方法<select aria-label="计算方法" disabled={!!history} value={displayedMethod} onChange={e => setMethod(e.target.value as typeof method)}>{Object.entries(METHOD_NAMES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          {!history ? <label>未来根数<select aria-label="未来根数" value={horizonChoice} onChange={e => setHorizonChoice(e.target.value)}><option value="1,2,3">原点之后第1/2/3根</option><option value="2,3,4">原点之后第2/3/4根</option></select></label> : null}
          {displayedMethod === 'rolling_close' ? <label>收盘情景<select aria-label="收盘情景" disabled={!!history} value={chosenScenario?.id ?? ''} onChange={e => setScenarioIds(old => ({ ...old, [period]: e.target.value }))}>{availableScenarios.map(s => <option key={s.id} value={s.id}>{s.kind === 'base' ? '保持原点收盘' : s.kind === 'continuation' ? '条件延续' : '条件回撤'}</option>)}</select></label> : null}
        </div>
        <p>{displayedMethod === 'rolling_close' ? chosenScenario?.condition ?? '此周期暂无可计算情景' : displayedMethod === 'average_delta' ? '使用同周期最近三个已知MA/BOLL参数的平均增量。' : '使用最近一根参数增量，作为对照。'}</p>
        {chosenScenario && displayedMethod === 'rolling_close' ? <p className="sa-time">假设收盘：{chosenScenario.closes.map(c => c.toFixed(2)).join(' → ')}</p> : null}
        <ScenarioReferenceTable analysis={analysis} period={period} method={displayedMethod} scenarioId={chosenScenario?.id ?? null}
          horizons={history ? [...new Set(history.references.filter(r => r.period === period).map(r => r.target.horizon))] : horizons} />
        <p className="sa-time">每个周期分别计算。参数所属未来K线与当前价格覆盖窗口分别记录。</p>
        {analysis.inactiveScenarios?.length ? <aside className="sa-note" aria-label="待重新确认的收盘路径"><h4>待重新确认的收盘路径</h4>
          {analysis.inactiveScenarios.map(({ scenario, issues }) => <p key={scenario.id}>{PERIOD_NAMES[scenario.period]} · 原点 {displayTime(scenario.originBarKey)}：{issues.map(issueLabel).join('、')}。{scenario.condition}</p>)}
          <p>旧路径未自动移动原点；请核对当前K线并重新填写条件路径。</p></aside> : null}
      </section>
      <section className="sa-section" aria-label="交易原则与风险参考"><h3>交易原则与风险参考</h3>
        <p>{analysis.entryBlocked ? '当前日线风险原则限制新增参与。' : '是否满足参与条件仍需核对模式与缺项。'}</p>
        {analysis.risk.length ? <ul>{analysis.risk.map(r => <li key={r.id}><strong>{PERIOD_NAMES[r.period]} {r.indicator ? INDICATOR_NAMES[r.indicator] : r.kind === 'deadline' ? '时间退出条件' : '参考底线'} {r.value?.toFixed(2) ?? ''}</strong><p>{r.condition}</p></li>)}</ul>
          : <p className="sa-time">模式、持仓或底线条件不足时，暂不生成止盈止损参考。</p>}
        <details><summary>本次采用与忽略的笔记 · {analysis.rules.length}条</summary><div className="sa-rules">{analysis.rules.map(rule => <details key={rule.period + ':' + rule.ruleId}>
          <summary>{RULE_STATUS_NAMES[rule.status]} · {rule.name}</summary><p>{rule.status === 'insufficient' ? rule.missing.map(issueLabel).join('、') : rule.reason}</p>
          <small>研究定义 {rule.definitionVersion} · 原则版本{rule.version} · {PERIOD_NAMES[rule.period]}</small>
          {rule.evidence.map((e, i) => <blockquote key={e.recordId + e.sourceHash + i}><p>{e.quote}</p><a href={e.sourceUrl.split('#')[0] + '#L' + e.startLine + '-L' + e.endLine} target="_blank" rel="noreferrer">查看笔记原文 · L{e.startLine}–{e.endLine} · 标签v{e.tagVersion}</a></blockquote>)}
          {!history ? <button type="button" onClick={() => {
            const reason = window.prompt('填写本次停用原因，原文与历史将保留。')
            if (reason?.trim()) setAnnotations(old => ({ ...old, disabledRules: { ...old.disabledRules, [rule.ruleId]: reason.trim() } }))
          }}>本次停用此原则</button> : null}
        </details>)}</div></details>
      </section>
    </> : <p role="status">{loader.status === 'loading' ? '正在准备日线与1小时分析行情' : '分析行情暂不可用，可刷新重试。'}</p>}
    {!history ? <details className="sa-section"><summary>执行窗口与覆盖核对设置</summary><p>填写北京时间窗口；只对窗口开始前保存的计划核对价格范围覆盖。</p>
      <div className="sa-form-grid"><label>覆盖核对周期<select aria-label="覆盖核对周期" value={windowPeriod} onChange={e => setWindowPeriod(e.target.value as AnalysisPeriod)}>{Object.entries(PERIOD_NAMES).map(([p, label]) => <option key={p} value={p}>{label}</option>)}</select></label>
        <label className="sa-wide">执行窗口开始<input type="datetime-local" value={windowStart} onChange={e => setWindowStart(e.target.value)} /></label>
        <label className="sa-wide">执行窗口结束<input type="datetime-local" value={windowEnd} onChange={e => setWindowEnd(e.target.value)} /></label></div>
      <button type="button" onClick={applyWindow}>记录执行窗口</button>{executionWindow ? <p>{displayTime(executionWindow.startAt)} → {displayTime(executionWindow.endAt)}</p> : null}
    </details> : <section className="sa-section"><h3>历史核对</h3><p>{coverage?.eligible ? '当前窗口价格范围覆盖 ' + coverage.coveredCount + ' 个参考位' : coverage ? coverage.issues.map(issueLabel).join('、') : '此快照没有预先选择执行窗口，覆盖核对待设置。'}</p>
      <p>{errors?.references.some(r => r.status === 'evaluated') ? '已有目标K线可核对MA/BOLL误差；详见导出。' : '目标MA/BOLL尚不可核对，参考位覆盖与指标误差分别记录。'}</p></section>}
    {history ? <><ScenarioPriceEvaluation view={cloud.details[cloudRecordKey(history)]?.view ?? { latestStatus: null, latestSuccessful: null }} />
      {cloud.entries[cloudRecordKey(history)]?.receipt ? <div className="sa-actions"><button type="button" disabled={cloud.loading} onClick={() => { void cloud.loadDetails(history, true) }}>{cloud.loading ? '正在核对…' : '立即核对实际四价'}</button>
        <button type="button" disabled={cloud.loading} onClick={() => { void cloud.loadDetails(history) }}>读取已存评价</button></div> : <p className="sa-note">此版本仅在本地保存，入库后可自动核对。</p>}</> : null}
    {cloud.error ? <p role="status" className="sa-note">{cloud.error}</p> : null}
    <footer className="sa-actions">{history ? <><button type="button" onClick={() => setHistory(null)}>返回当前分析</button><button type="button" onClick={() => {
      setAnalysisId(history.id); setAnnotations(history.annotations); setPaths([...history.scenarios.filter(s => s.kind !== 'base'), ...(history.inactiveScenarios ?? []).map(s => s.scenario)]);
      if (history.consolidation) { setMethod(history.consolidation.method); setScenarioIds(history.consolidation.scenarioIds) }
      if (history.dailyPriceLadder) {
        const { limit } = history.dailyPriceLadder.selection
        setLimitChoice(limit.source === 'manual' ? String(limit.ratio) : limit.source === 'unverified' ? 'unverified' : 'auto')
      }
      setHistory(null); setNotice('已载入历史依据，重新核对当前K线后保存新版本')
    }}>以此为基础修订</button></> : <button className="sa-primary" type="button" disabled={!canSave} onClick={save}>保存分析快照</button>}
      <button type="button" disabled={exporting} onClick={() => { void exportRecords() }}>{exporting ? '正在整理导出…' : '导出分析与历史'}</button></footer>
    <details className="sa-history"><summary>分析历史 · {stockRecords.length}个版本</summary>{[...stockRecords].reverse().map(record => {
      const entry = cloud.entries[cloudRecordKey(record)]
      return <div key={record.id + record.version}>
        <span>v{record.version} · {displayTime(record.createdAt)} · {record.kind === 'replay' ? '回放' : '保存记录'}<small className="sa-cloud-status">{entry?.status === 'stored' ? '已入库' : entry?.status === 'pending' ? '待同步' : entry?.status === 'retry' ? '仅本地 · 失败可重试' : '仅本地'}</small>
          {entry?.receipt ? <small>服务器首次接收 {displayTime(entry.receipt.serverReceivedAt)}</small> : null}{entry?.error ? <small>{entry.error}</small> : null}</span>
        <div className="sa-history-actions"><button type="button" onClick={() => { setHistory(record); setShowForm(false); if (entry?.receipt) void cloud.loadDetails(record) }}>查看分析版本{record.version}</button>
          {entry?.status === 'retry' ? <button type="button" disabled={!cloud.ready} onClick={() => { void cloud.retry(record.id, record.version) }}>重试入库版本{record.version}</button>
            : !entry ? <button type="button" disabled={!cloud.ready} onClick={() => { void cloud.saveFrozen(record, freezeLegacyBindings(record, tagVersions.current)) }}>上传原版本{record.version}</button> : null}</div>
      </div>
    })}</details>
  </section>
}
