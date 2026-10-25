'use client'

import { useEffect, useRef, useState } from 'react'
import type { DecisionRule, StockAnalysis } from '../workspace/stock-workspace-types'
import type { MergedLevel } from '../scenario/scenario-types'
import { ScenarioReferenceTable } from '../scenario/scenario-reference-table'
import { FORECAST_HORIZONS, type AutomaticForecast } from './use-automatic-forecast'
import { INDICATOR_NAMES, PERIOD_NAMES, RULE_STATUS_NAMES, issueLabel } from '../scenario/scenario-labels'
import type { AnalysisPeriod } from '../scenario/scenario-types'
import { findHistoricalMatches } from './research-context'
import { levelEvidence } from './forecast-evidence'
import { ANALYSIS_PERIODS } from '../scenario/scenario-calendar'
import { ForecastPeriodContext } from './forecast-period-context'
import { dailyCandidates } from './daily-candidates'
import { NotePriceWorkbench } from './note-price-workbench'

export function AutomaticForecastPanel({ forecast, selected, onSelect, rules = [], stockAnalysis, compact = false }: {
  forecast: AutomaticForecast; selected: MergedLevel | null; onSelect: (level: MergedLevel) => void;
  rules?: DecisionRule[]; stockAnalysis?: StockAnalysis | null; compact?: boolean
}) {
  const [period, setPeriod] = useState<AnalysisPeriod>('day')
  const sectionRef = useRef<HTMLElement>(null)
  const initialAnchorHandled = useRef(false)
  const anchorReady = !forecast.loading && !!(forecast.analysis || forecast.error)
  useEffect(() => {
    if (compact || !anchorReady) return
    let frame = 0
    const scrollToAnchor = () => {
      if (window.location.hash !== '#automatic-forecast-results') return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        initialAnchorHandled.current = true
        sectionRef.current?.scrollIntoView({ block: 'start' })
      })
    }
    if (!initialAnchorHandled.current) {
      scrollToAnchor()
    }
    window.addEventListener('hashchange', scrollToAnchor)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('hashchange', scrollToAnchor)
    }
  }, [compact, anchorReady])
  const analysis = forecast.analysis
  const daily = analysis?.input.periods.day?.closed ?? []
  const close = daily.at(-1)?.close ?? 0
  const history = findHistoricalMatches(daily)
  const candidates = analysis ? dailyCandidates(analysis) : null
  const levels = candidates?.levels ?? []
  const evidence = selected ? levelEvidence(selected, close, rules, stockAnalysis, history) : null
  const renderLevel = (level: MergedLevel) => {
    const basis = levelEvidence(level, close, rules, stockAnalysis, history)
    return <button type="button" key={level.id} aria-pressed={selected?.id === level.id} onClick={() => onSelect(level)}>
      <strong>{level.value.toFixed(2)}</strong><span>{basis.change === null ? '—' : `${basis.change >= 0 ? '+' : ''}${basis.change.toFixed(2)}%`}</span>
      <small>{[...new Set(level.references.map(r => PERIOD_NAMES[r.period]))].join(' / ')}</small>
      {analysis?.entryBlocked ? <small>入场过滤未通过 · 仅作指标参考</small> : null}
      <small>{basis.matchingRules.length ? `${basis.matchingRules.length} 条规则可核对` : '待核对规则依据'}{basis.comparableHistory.length ? ` · ${basis.comparableHistory.length} 个历史结果接近` : ''}</small>
    </button>
  }
  return <section ref={sectionRef} className={`rs-auto-forecast ${compact ? 'is-compact' : ''}`} id={compact ? undefined : 'automatic-forecast-results'} aria-label={compact ? '预测候选价位' : '自动 MA/BOLL 预测'}>
    <header><div><h2>{compact ? '合并候选价位' : 'MA / BOLL 预测'}</h2><p>{compact ? '选择价位，核对下方依据' : '历史 3 根 → 未来 4 根 → 合并价位 → 选择依据'}</p></div>{!compact ? <button type="button" className="rs-button" onClick={() => void forecast.refresh()} disabled={forecast.loading}>重新计算</button> : null}</header>
    {!compact ? <p className="rs-auto-status" role="status">{forecast.loading ? '正在按需核对日线 → 1小时 → 30分钟 → 15分钟…' : forecast.clearPeriod ? `${PERIOD_NAMES[forecast.clearPeriod]}趋势与盈利模式已有有效确认，停止自动下钻。` : `趋势／盈利模式尚未明确，已核对至${PERIOD_NAMES[forecast.periods.at(-1) ?? 'day']}；候选适配仍需核对条件。`}</p> : null}
    {forecast.error ? <p role="alert">{forecast.error}</p> : null}
    {!analysis ? <p role="status">{forecast.loading ? '正在计算指标预测…' : '暂无有效预测数据，可重新计算。'}</p> : null}
    {analysis && analysis.rules.length ? <section className="rs-selected-basis" aria-label="笔记预估条件核对">
      <h3>笔记预估条件</h3>
      <p role="status">{analysis.entryBlocked ? '原文入场过滤已触发；下列价位仅为指标参考，不能当作新入场目标。' : '当前未触发已定义的入场过滤，不等于已确认买入条件。'}</p>
      {!compact ? <><p>按预估作用调用原文条件：入场过滤、持仓底线、目标参考、退出期限与场景。条件影响价位用途与风险判断；MA／BOLL 外推值仍按行情计算。</p>
        {analysis.rules.filter(rule => rule.status === 'adopted').map(rule => <details key={`${rule.ruleId}:${rule.period}`}><summary>{rule.name} · {PERIOD_NAMES[rule.period]} · 条件已满足</summary><p>{rule.reason}</p>{rule.evidence.map(e => <blockquote key={`${e.recordId}:${e.startLine}:${e.quote}`}><a href={e.sourceUrl} target="_blank" rel="noopener noreferrer">原文 L{e.startLine}–{e.endLine}</a>：{e.quote}</blockquote>)}</details>)}
        {analysis.risk.map(risk => <p key={risk.id}>{PERIOD_NAMES[risk.period]}{risk.indicator ? ` ${INDICATOR_NAMES[risk.indicator]}` : ''}{risk.value != null ? ` ${risk.value.toFixed(2)}` : ''}：{risk.condition}</p>)}
        <details><summary>未采用的条件 · {analysis.rules.filter(rule => rule.status !== 'adopted').length} 条</summary>{analysis.rules.filter(rule => rule.status !== 'adopted').map(rule => <p key={`${rule.ruleId}:${rule.period}`}>{rule.name} · {RULE_STATUS_NAMES[rule.status]}：{rule.status === 'insufficient' ? '尚未满足采用要求' : rule.reason}{rule.missing.length ? `（缺项：${rule.missing.map(issueLabel).join('、')}）` : ''}</p>)}</details>
      </> : null}
    </section> : null}
    {!compact && analysis ? <><ForecastPeriodContext analysis={analysis} selected={period} onSelect={setPeriod} /><nav aria-label="预测计算周期" className="rs-auto-periods">{ANALYSIS_PERIODS.map(p => <button type="button" key={p} aria-pressed={period === p} disabled={!analysis.input.periods[p]} onClick={() => setPeriod(p)}>{PERIOD_NAMES[p]}{analysis.input.loadIssues[p] ? ' · 数据缺项' : ''}</button>)}</nav>
      <p className="rs-auto-table-hint">{analysis.input.periods[period]?.adjustment === 'qfq' ? '前复权' : '不复权'} · 从左到右查看历史3根 → 未来4根；每格依次显示指标值、较上一根变化、距原点收盘。表格可左右滑动。</p>
      {analysis.input.periods[period] ? <ScenarioReferenceTable analysis={analysis} period={period} method="average_delta" scenarioId={null} horizons={FORECAST_HORIZONS} historyCount={3} /> : <p>该周期暂无有效数据。</p>}
      <p className="rs-auto-method">按最近3根指标的平均增量外推4根；未来值为条件参考；日期未核实时按第1～4根展示，不推定具体交易日。各周期分别按本周期的4根计算。</p>
      {forecast.issues.map(issue => <p className="rs-auto-method" role="status" key={issue}>{issue}</p>)}</> : null}
    {analysis ? <><h3>{compact ? '最近的3个候选价位' : `合并候选价位 · ${levels.length} 个`}</h3>
      {!compact ? <p className="rs-auto-method">仅合并与日线价格口径一致的有效平均增量预测（日线前复权时，分钟不复权参考值单独展示）：组内任意两值偏差不超过1%，取算术平均；保留各周期与目标根数。不同周期不视为同一到达时间。</p> : null}
      <p className="rs-auto-method" data-testid="daily-candidate-scope">{candidates?.band && candidates.anchor ? `原点范围筛选：以 ${candidates.anchor.day} 收盘 ${candidates.anchor.close.toFixed(2)} 为原点，候选范围 ${candidates.band.lower.toFixed(2)}～${candidates.band.upper.toFixed(2)}（参考${candidates.limitLabel}）。` : candidates?.index ? '指数无个股涨跌幅范围限制，合并所有目标根数的有效指标参考。' : '缺少已核实的原点价格范围，暂不列出合并候选。'}保留当日及跨日各目标根数；先过滤偏离原点过远的值，再合并，不代表目标日涨跌停范围或必达价格。</p>
      <div className="rs-auto-levels">{[...levels].sort((a, b) => compact ? Math.abs(a.value - close) - Math.abs(b.value - close) : a.value - b.value).slice(0, compact ? 3 : undefined).map(renderLevel)}</div>{compact ? <a className="rs-auto-all-link" href="#automatic-forecast-results">查看全部 {levels.length} 个价位与依据 ↓</a> : null}{!levels.length ? <p>{candidates?.verified ? '原点范围内暂无有效候选，不补造目标价。' : '原点价格范围尚未核实，暂不列出合并候选。'}</p> : null}
    </> : null}
    {!compact && analysis ? <NotePriceWorkbench key={analysis.input.symbol + ':' + analysis.input.sourceMode} analysis={analysis} onRefresh={forecast.refresh} /> : null}
    {!compact && selected && evidence ? <section className="rs-selected-basis" aria-label="所选价位依据"><h3>所选价位 {selected.value.toFixed(2)} · 依据</h3>
      <p>计算来源：{selected.references.map(r => `${PERIOD_NAMES[r.period]} ${INDICATOR_NAMES[r.indicator]} 第${r.target.horizon}根 ${r.value?.toFixed(2)}`).join('；')}</p>
      <p>笔记规则：{evidence.matchingRules.length ? evidence.matchingRules.map(r => r.name).join('；') : '暂无已命中且直接关联该指标的笔记规则，不能视为已获规则支持。'}</p>
      {evidence.matchingRules.map(rule => <p key={rule.ruleId}>{rule.evidence.map(e => `${e.detail ?? e.label}（${e.id}）`).join('；')}</p>)}
      <p>历史相似：{evidence.comparableHistory.length ? '以下已发生片段的后3日涨跌幅与该价位相对收盘涨跌幅相差不超过1个百分点。' : '暂无历史相似片段的后3日结果接近该价位。'}</p>
      {evidence.comparableHistory.map(h => <p key={h.startDay}>{h.startDay}～{h.endDay} · 路径偏差 {h.distance.toFixed(2)} 个百分点 · 后3日 {h.followThroughReturn.toFixed(2)}%</p>)}
      <small>历史相似按已发生的日线片段比较；不能验证小时／30分钟的到达时间，也不代表未来命中率。</small>
    </section> : null}
  </section>
}
