'use client'

import { useState } from 'react'
import type { DecisionRule, StockAnalysis } from '../workspace/stock-workspace-types'
import type { MergedLevel } from '../scenario/scenario-types'
import { ScenarioReferenceTable } from '../scenario/scenario-reference-table'
import { FORECAST_HORIZONS, type AutomaticForecast } from './use-automatic-forecast'
import { INDICATOR_NAMES, PERIOD_NAMES } from '../scenario/scenario-labels'
import type { AnalysisPeriod } from '../scenario/scenario-types'
import { findHistoricalMatches } from './research-context'
import { levelEvidence } from './forecast-evidence'

export function AutomaticForecastPanel({ forecast, selected, onSelect, rules = [], stockAnalysis, compact = false }: {
  forecast: AutomaticForecast; selected: MergedLevel | null; onSelect: (level: MergedLevel) => void;
  rules?: DecisionRule[]; stockAnalysis?: StockAnalysis | null; compact?: boolean
}) {
  const [period, setPeriod] = useState<AnalysisPeriod>('day')
  const analysis = forecast.analysis
  const daily = analysis?.input.periods.day?.closed ?? []
  const close = daily.at(-1)?.close ?? 0
  const history = findHistoricalMatches(daily)
  const levels = analysis?.mergedLevels ?? []
  const evidence = selected ? levelEvidence(selected, close, rules, stockAnalysis, history) : null
  return <section className={`rs-auto-forecast ${compact ? 'is-compact' : ''}`} id={compact ? undefined : 'automatic-forecast-results'} aria-label={compact ? '预测候选价位' : '自动 MA/BOLL 预测'}>
    <header><div><h2>{compact ? '合并候选价位' : 'MA / BOLL 预测'}</h2><p>{compact ? '选择价位，核对下方依据' : '历史 3 根 → 未来 4 根 → 合并价位 → 选择依据'}</p></div>{!compact ? <button type="button" className="rs-button" onClick={() => void forecast.refresh()} disabled={forecast.loading}>重新计算</button> : null}</header>
    {!compact ? <p className="rs-auto-status" role="status">{forecast.loading ? '正在自动核对日线 → 1小时 → 30分钟…' : forecast.clearPeriod ? `${PERIOD_NAMES[forecast.clearPeriod]}趋势与盈利模式已有有效确认，停止自动下钻。` : '日线趋势／盈利模式尚未明确，已自动核对至30分钟；候选价位不代表模式已确认。'}</p> : null}
    {forecast.error ? <p role="alert">{forecast.error}</p> : null}
    {!analysis ? <p role="status">{forecast.loading ? '正在计算指标预测…' : '暂无有效预测数据，可重新计算。'}</p> : null}
    {!compact && analysis ? <><nav aria-label="预测计算周期" className="rs-auto-periods">{(['day', '60m', '30m'] as const).map(p => <button type="button" key={p} aria-pressed={period === p} disabled={!analysis.input.periods[p]} onClick={() => setPeriod(p)}>{PERIOD_NAMES[p]}{analysis.input.loadIssues[p] ? ' · 数据缺项' : ''}</button>)}</nav>
      <p className="rs-auto-table-hint">表格可左右滑动，查看历史3根与未来4根的全部指标值。</p>
      {analysis.input.periods[period] ? <ScenarioReferenceTable analysis={analysis} period={period} method="average_delta" scenarioId={null} horizons={FORECAST_HORIZONS} historyCount={3} /> : <p>该周期暂无有效数据。</p>}
      <p className="rs-auto-method">按最近3根指标的平均增量外推4根；未来值为条件参考；日期未核实时按第1～4根展示，不推定具体交易日。各周期分别按本周期的4根计算。</p>
      {forecast.issues.map(issue => <p className="rs-auto-method" role="status" key={issue}>{issue}</p>)}</> : null}
    {analysis ? <><h3>{compact ? '最近的3个候选价位' : `合并候选价位 · ${levels.length} 个`}</h3>
      {!compact ? <p className="rs-auto-method">仅合并有效的前三根平均增量预测：组内任意两值偏差不超过1%，取算术平均；保留各周期与目标根数。不同周期不视为同一到达时间。</p> : null}
      <div className="rs-auto-levels">{[...levels].sort((a, b) => Math.abs(a.value - close) - Math.abs(b.value - close)).slice(0, compact ? 3 : undefined).map(level => {
        const basis = levelEvidence(level, close, rules, stockAnalysis, history)
        return <button type="button" key={level.id} aria-pressed={selected?.id === level.id} onClick={() => onSelect(level)}>
          <strong>{level.value.toFixed(2)}</strong><span>{basis.change === null ? '—' : `${basis.change >= 0 ? '+' : ''}${basis.change.toFixed(2)}%`}</span>
          <small>{[...new Set(level.references.map(r => PERIOD_NAMES[r.period]))].join(' / ')}</small>
          <small>{basis.matchingRules.length ? `${basis.matchingRules.length} 条规则可核对` : '待核对规则依据'}{basis.comparableHistory.length ? ` · ${basis.comparableHistory.length} 个历史结果接近` : ''}</small>
        </button>
      })}</div>{compact ? <a className="rs-auto-all-link" href="#automatic-forecast-results">查看全部 {levels.length} 个价位与依据 ↓</a> : null}{!levels.length ? <p>有效参考值不足，暂不合并价位。</p> : null}</> : null}
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
