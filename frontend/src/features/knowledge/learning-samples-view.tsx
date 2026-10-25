'use client'
import { useEffect, useRef, useState } from 'react'
import { getEvaluationHistory, listLearningSamples } from '../scenario/scenario-api'
import { getResearchIdentity, RESEARCH_IDENTITY_EVENT } from '../scenario/research-identity'
import type { LearningFilters, LearningSample, Page } from '../scenario/scenario-record-types'
import { ScenarioPriceEvaluation } from '../scenario/scenario-price-evaluation'
import { buildResearchExport } from '../scenario/scenario-research-export'
import { DIRECTION_NAMES, displayTime, METHOD_NAMES, PERIOD_NAMES, STYLE_NAMES } from '../scenario/scenario-labels'
import '../scenario/scenario-analysis-panel.css'

const FILTER_KEYS = ['symbol', 'anchorFrom', 'anchorThrough', 'method', 'forecastDefinitionVersion', 'evaluationDefinitionVersion', 'directionCandidate', 'directionConfirmed', 'noteFile', 'status'] as const
function locationFilters(): { filters: LearningFilters; cursor: string | null } {
  const query = new URL(window.location.href).searchParams
  const filters: LearningFilters = { symbol: query.has('symbol') ? query.get('symbol')! : '603533' }
  for (const key of FILTER_KEYS) if (key !== 'symbol' && query.has(key)) filters[key] = query.get(key)!
  const eligibility = query.get('forwardEligible')
  if (eligibility === 'true' || eligibility === 'false') filters.forwardEligible = eligibility === 'true'
  return { filters, cursor: query.get('sampleCursor') }
}
function updateLocation(filters: LearningFilters, cursor: string | null, replace = false) {
  const url = new URL(window.location.href); url.searchParams.set('view', 'samples')
  for (const key of [...FILTER_KEYS, 'forwardEligible', 'sampleCursor']) url.searchParams.delete(key)
  for (const [key, value] of Object.entries(filters)) if (value !== undefined && (value !== '' || key === 'symbol')) url.searchParams.set(key, String(value))
  if (cursor) url.searchParams.set('sampleCursor', cursor)
  window.history[replace ? 'replaceState' : 'pushState'](null, '', url.pathname + url.search)
}
const STATUS: Record<string, string> = { pending: '待核对', target_unverified: '目标待核实', scored: '已核对', source_error: '采集失败，可重试' }
export function LearningSamplesView() {
  const [filters, setFilters] = useState<LearningFilters>({ symbol: '603533' }), [cursor, setCursor] = useState<string | null>(null), [stack, setStack] = useState<Array<string | null>>([null])
  const [appliedFilters, setAppliedFilters] = useState<LearningFilters>({ symbol: '603533' })
  const detailTrigger = useRef<HTMLButtonElement | null>(null)
  const detailOrigin = useRef(0)
  const [ready, setReady] = useState(false), [refresh, setRefresh] = useState(0), [identityEpoch, setIdentityEpoch] = useState(0), [selected, setSelected] = useState<LearningSample | null>(null)
  const [state, setState] = useState<{ key: string; page: Page<LearningSample> | null; error: string }>({ key: '', page: null, error: '' })
  useEffect(() => {
    const restore = () => { const value = locationFilters(); setFilters(value.filters); setAppliedFilters(value.filters); setCursor(value.cursor); setStack([value.cursor]); setSelected(null); setReady(true) }
    const identityChanged = () => { setIdentityEpoch(n => n + 1); setSelected(null) }
    const storageChanged = (event: StorageEvent) => { if (event.key === null || event.key === 'stockcal.accessToken' || event.key === 'stockcal:sync-client-id') identityChanged() }
    queueMicrotask(restore)
    window.addEventListener('popstate', restore); window.addEventListener(RESEARCH_IDENTITY_EVENT, identityChanged); window.addEventListener('storage', storageChanged)
    return () => { window.removeEventListener('popstate', restore); window.removeEventListener(RESEARCH_IDENTITY_EVENT, identityChanged); window.removeEventListener('storage', storageChanged) }
  }, [])
  useEffect(() => {
    const reloadShared = () => { if (!cursor && !selected) setRefresh(n => n + 1) }
    window.addEventListener('focus', reloadShared)
    const timer = setInterval(reloadShared, 10000)
    return () => { clearInterval(timer); window.removeEventListener('focus', reloadShared) }
  }, [cursor, selected])
  const key = JSON.stringify({ filters: appliedFilters, cursor, refresh, identityEpoch })
  useEffect(() => {
    if (!ready) return
    const controller = new AbortController()
    void getResearchIdentity().then(async owner => {
      if (!owner.isCurrent() || controller.signal.aborted) return
      try {
        const page = await listLearningSamples(appliedFilters, cursor ?? undefined, controller.signal)
        if (!controller.signal.aborted && owner.isCurrent()) setState({ key, page, error: '' })
      } catch (cause) { if (!controller.signal.aborted && owner.isCurrent()) setState({ key, page: null, error: cause instanceof Error ? cause.message : '样本读取失败' }) }
    }).catch(cause => { if (!controller.signal.aborted) setState({ key, page: null, error: cause instanceof Error ? cause.message : '身份读取失败' }) })
    return () => controller.abort()
  }, [ready, key, appliedFilters, cursor])
  const page = state.key === key ? state.page : null, error = state.key === key ? state.error : ''
  function filter<K extends keyof LearningFilters>(name: K, value: LearningFilters[K]) {
    setFilters(previous => ({ ...previous, [name]: value }))
  }
  function applyFilters() { setAppliedFilters(filters); setCursor(null); setStack([null]); setSelected(null); updateLocation(filters, null) }
  function nextPage() { if (!page?.nextCursor) return; setCursor(page.nextCursor); setStack(old => [...old, page.nextCursor]); setSelected(null); updateLocation(appliedFilters, page.nextCursor) }
  function previousPage() { if (stack.length < 2) return; const previous = stack[stack.length - 2]; setStack(old => old.slice(0, -1)); setCursor(previous); setSelected(null); updateLocation(appliedFilters, previous) }
  function reload() { setCursor(null); setStack([null]); setSelected(null); setRefresh(n => n + 1); updateLocation(appliedFilters, null, true) }
  return <section className="ls-workbench" aria-label="学习样本库">
    <header className="nt-heading"><h2>已保存的计算</h2><button className="kw-button" type="button" onClick={reload}>刷新样本</button></header>
    <details className="ls-advanced"><summary>样本与核对指标说明</summary><p className="ls-guide">先筛选已保存的计算，再打开样本查看实际四价与原始依据。接近价位：偏差严格小于 1%；四价覆盖：开、高、低、收中有几项被命中。</p></details>
    <form aria-label="学习样本筛选" onSubmit={event => { event.preventDefault(); applyFilters() }}><div className="ls-filters">
      <label>股票代码<input inputMode="numeric" placeholder="留空查看全部" value={filters.symbol ?? ''} onChange={e => filter('symbol', e.target.value)} /></label>
      <label>计算方法筛选<select value={filters.method ?? ''} onChange={e => filter('method', e.target.value)}><option value="">全部方法</option>{Object.entries(METHOD_NAMES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>评估状态筛选<select value={filters.status ?? ''} onChange={e => filter('status', e.target.value)}><option value="">全部状态</option>{Object.entries(STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>

    </div>
    <details className="ls-advanced"><summary>更多筛选 · 日期、资格与来源</summary><div className="ls-filters">      <label>基准日起<input type="date" value={filters.anchorFrom ?? ''} onChange={e => filter('anchorFrom', e.target.value)} /></label>
      <label>基准日止<input type="date" value={filters.anchorThrough ?? ''} onChange={e => filter('anchorThrough', e.target.value)} /></label>
      <label>前瞻资格筛选<select value={filters.forwardEligible === undefined ? '' : String(filters.forwardEligible)} onChange={e => filter('forwardEligible', e.target.value === '' ? undefined : e.target.value === 'true')}><option value="">全部记录</option><option value="true">前瞻有效</option><option value="false">事后对照／资格待定</option></select></label>      <label>计算定义版本<input value={filters.forecastDefinitionVersion ?? ''} onChange={e => filter('forecastDefinitionVersion', e.target.value)} placeholder="全部版本" /></label>
      <label>核对定义版本<input value={filters.evaluationDefinitionVersion ?? ''} onChange={e => filter('evaluationDefinitionVersion', e.target.value)} placeholder="当前四价定义" /></label>
      <label>候选趋势<select value={filters.directionCandidate ?? ''} onChange={e => filter('directionCandidate', e.target.value)}><option value="">全部候选</option>{Object.entries(DIRECTION_NAMES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>人工确认趋势<select value={filters.directionConfirmed ?? ''} onChange={e => filter('directionConfirmed', e.target.value)}><option value="">全部确认状态</option>{Object.entries(DIRECTION_NAMES).map(([value, label]) => <option key={value} value={value}>{value === 'unknown' ? '未确认／未知' : label}</option>)}</select></label>
      <label>笔记文件<input value={filters.noteFile ?? ''} onChange={e => filter('noteFile', e.target.value)} placeholder="完整文件名" /></label>
</div></details>
    <div className="ls-filter-actions"><button type="submit" className="kw-button kw-primary">应用筛选</button><span>{JSON.stringify(filters) !== JSON.stringify(appliedFilters) ? '筛选已修改，点击应用后更新结果' : '股票代码留空可查看全部股票'}</span><button type="button" className="kw-button" onClick={() => { setFilters({ symbol: '' }); setAppliedFilters({ symbol: '' }); setCursor(null); setStack([null]); setSelected(null); updateLocation({ symbol: '' }, null) }}>清空筛选</button></div></form>
    {error ? <p role="alert" className="kw-alert">{error}<button type="button" onClick={reload}>重试样本</button></p> : !page ? <p role="status">正在读取样本…</p> : <>
      <p className="ls-caption">本批{page.items.length}条 · 前瞻有效且已有评分{page.items.filter(s => s.evaluation.latestSuccessful?.eligibility.forwardEligible && s.evaluation.latestSuccessful.targetResolution.state === 'verified').length}条 · 查询时点 {displayTime(page.asOf)}</p>
      <p className="nt-disclaimer">前瞻汇总只使用已核实目标日的当前成功评价。事后对照继续保留；价位接近和四价覆盖使用不同分母。</p>
      {!page.items.length ? <div className="kw-empty"><h3>没有符合条件的样本</h3><p>可以清空筛选；若尚未保存计算，请先在股票分析中保存一次正式计算。</p></div> : <div className="ls-table-scroll"><table className="ls-table sc-mobile-record-table"><caption>冻结计算与实际价格核对</caption><thead><tr><th>股票</th><th>基准日</th><th>方法与周期</th><th>接近价位</th><th>四价覆盖</th><th>状态与资格</th><th>记录</th></tr></thead><tbody>{page.items.map(sample => {
        const f = sample.forecast, result = sample.evaluation.latestSuccessful?.result, latest = sample.evaluation.latestStatus
        return <tr key={f.id}><th>{f.symbol}</th><td data-label="基准日">{f.anchorDay}</td><td data-label="方法与周期">{METHOD_NAMES[f.method as keyof typeof METHOD_NAMES] ?? f.method}<small>{Object.keys(f.snapshot.input.periods).map(p => PERIOD_NAMES[p as keyof typeof PERIOD_NAMES]).join('、')}</small></td>
          <td data-label="接近价位">{result ? `${result.closeLevels}/${result.totalLevels}${result.totalLevels ? '' : '（无价位）'}` : '待核对'}</td><td data-label="四价覆盖">{result ? `${result.coveredTargets}/4` : '—'}</td>
          <td data-label="状态与资格">{STATUS[latest?.status ?? 'pending']}<small>{sample.evaluation.latestSuccessful?.eligibility.forwardEligible ? '前瞻有效' : f.kind === 'replay' ? '历史回放' : '事后对照／资格待定'}</small></td><td className="sc-record-action"><button className="kw-button" type="button" aria-expanded={selected?.forecast.id === f.id} onClick={event => { detailTrigger.current = event.currentTarget; detailOrigin.current = window.scrollY; setSelected(sample) }}>查看冻结样本</button></td></tr>
      })}</tbody></table></div>}
      <div className="kw-pagination"><button type="button" disabled={stack.length < 2} onClick={previousPage}>上一批样本</button><span>按首次接收时间排序</span><button type="button" disabled={!page.nextCursor} onClick={nextPage}>下一批样本</button></div>
    </>}
    {selected && page ? <SampleDetail key={selected.forecast.id} sample={selected} asOf={page.asOf} onClose={() => { setSelected(null); detailTrigger.current?.focus({ preventScroll: true }); requestAnimationFrame(() => window.scrollTo({ top: detailOrigin.current, behavior: 'instant' })) }} /> : null}
  </section>
}
function SampleDetail({ sample, asOf, onClose }: { sample: LearningSample; asOf: string; onClose: () => void }) {
  const detailRef = useRef<HTMLElement | null>(null)
  useEffect(() => { detailRef.current?.focus(); detailRef.current?.scrollIntoView?.({ behavior: 'instant', block: 'start' }) }, [])
  const { forecast: record, evaluation } = sample, day = record.snapshot.states.day
  const [error, setError] = useState(''), [exporting, setExporting] = useState(false), alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  async function exportSample() {
    setExporting(true); setError('')
    try {
      const owner = await getResearchIdentity()
      const history = await getEvaluationHistory(record.id)
      if (!owner.isCurrent() || !alive.current) return
      const blob = new Blob([JSON.stringify({ ...buildResearchExport(record, evaluation, history), queryAsOf: asOf }, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob), link = document.createElement('a')
      link.href = url; link.download = 'stockcal-' + record.symbol + '-' + record.id + '.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : '导出失败，请重试') }
    finally { if (alive.current) setExporting(false) }
  }
  return <section ref={detailRef} tabIndex={-1} onKeyDown={event => { if (event.key === 'Escape') onClose() }} className="sa-panel ls-detail" aria-label="学习样本详情">
    <header className="sa-header"><div><h3>{record.symbol} · 冻结分析 v{record.clientVersion}</h3><p>首次入库 {displayTime(record.serverReceivedAt)} · 分析时点 {displayTime(record.inputAsOf)}</p></div><button type="button" onClick={onClose}>关闭样本详情</button></header>
    <p>采用周期：{Object.keys(record.snapshot.input.periods).length === 1 && record.snapshot.input.periods.day ? '仅日线' : Object.keys(record.snapshot.input.periods).map(p => PERIOD_NAMES[p as keyof typeof PERIOD_NAMES]).join('、')} · {METHOD_NAMES[record.method as keyof typeof METHOD_NAMES] ?? record.method}</p>
    <p>候选趋势：{DIRECTION_NAMES[day?.directionCandidate ?? 'unknown']} · 人工确认：{day?.confirmed ? DIRECTION_NAMES[day.direction] : '未确认'} · {STYLE_NAMES[day?.style ?? 'unknown']}</p>
    <p>葛阶段：{day?.granville.stage ? (day.granville.context === 'up' ? '上涨葛' : '下跌葛') + day.granville.stage : '未知，起点待确认'}</p>
    <section><h4>冻结的全部参考价</h4><p>{record.levels.length ? record.levels.map(p => (p.priceCents / 100).toFixed(2)).join(' · ') : '没有范围内的计算价位'}</p></section>
    <ScenarioPriceEvaluation view={evaluation} />
    <details><summary>所用笔记与解释版本 · {record.noteBindings.length}</summary>{record.noteBindings.map((binding, i) => <section key={i} className="ls-note-source"><h4>{binding.study?.sourceFile ?? binding.inlineVersion?.file ?? '原引用未解析'}</h4>
      <p>{binding.status === 'resolved' ? '已固定研究版本' : '引用未解析，保留原证据'}{binding.legacyKey ? ` · 标签v${binding.legacyKey.tagVersion}` : ''}</p><p className="nt-source-hash">SHA-256：{binding.sourceHash}</p><pre>{binding.study?.sourceText ?? binding.inlineVersion?.sourceExcerpt ?? '缺少对应原文历史，未用新版本替代。'}</pre></section>)}</details>
    <details><summary>冻结交易原则与版本</summary><p>计算定义 {record.definitionVersion} · 预测来自客户端冻结计算。</p>{record.snapshot.risk.map(r => <p key={r.id}>{r.condition}{r.value === null ? '' : ` · ${r.value.toFixed(2)}`}</p>)}</details>
    {error ? <p role="alert">{error}</p> : null}<button type="button" disabled={exporting} onClick={() => { void exportSample() }}>{exporting ? '正在整理导出…' : '导出冻结样本'}</button>
  </section>
}
