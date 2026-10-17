'use client'

import Link from 'next/link'
import { useId, useMemo, useState, type ReactNode } from 'react'
import type { Candle, DecisionRule, StockAnalysis } from '../workspace/stock-workspace-types'
import { findHistoricalMatches, summarizeRecent } from './research-context'
import type { MergedLevel } from '../scenario/scenario-types'
import { levelEvidence } from './forecast-evidence'
import { StudioIcon } from './studio-icon'

const signed = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
const factLabels: Record<string, string> = { closeAboveMa5: '收盘站上 MA5', closeAboveMa20: '收盘站上 MA20', closeAboveBollMiddle: '收盘站上 BOLL 中轨', ma5SlopePositive: 'MA5 斜率向上', bollMiddleSlopePositive: 'BOLL 中轨向上', volumeRatio: '成交量比值', supportDistance: '距支撑位比例', granvilleDay: '葛兰碧阶段', phase: '走势阶段', marketPanic: '市场恐慌条件', relativeStrength: '相对强度', phase3Opening: '三期开口', mirrorRetest: '压力支撑互换确认' }
const operators: Record<string, string> = { equals: '=', greaterThan: '>', greaterThanOrEqual: '≥', lessThan: '<', lessThanOrEqual: '≤' }
function RuleEvidence({ rule, analysis }: { rule: DecisionRule; analysis?: StockAnalysis | null }) {
  const evaluation = analysis?.ruleEvaluations?.find((item) => item.ruleId === rule.ruleId)
  return <details><summary><StudioIcon name="book" size={16} /><strong>{rule.name}</strong><span className={evaluation?.status === 'matched' ? 'is-matched' : ''}>{evaluation?.status === 'matched' ? '条件命中' : evaluation?.status === 'insufficient' ? '数据不足' : '未命中'}</span></summary>
    {rule.evidence.length ? <ul aria-label="规则来源">{rule.evidence.map((evidence) => <li key={evidence.id}>{evidence.detail ?? evidence.label}<br /><span>来源：{evidence.id}</span></li>)}</ul> : <p>已发布知识规则，暂未提供原文出处。</p>}
    <ul aria-label="规则条件">{rule.conditions?.map((condition, index) => { const actual = evaluation?.conditions[index]; return <li key={`${condition.field}-${index}`}>{factLabels[condition.field] ?? condition.field} {operators[condition.operator]} {condition.value}；当前：{actual?.actual === null || actual?.actual === undefined ? '缺少数据' : typeof actual.actual === 'boolean' ? Number(actual.actual) : String(actual.actual)} · {actual?.passed ? '满足' : actual?.passed === false ? '不满足' : '待补充'}</li> })}</ul>
    {rule.invalidationConditions?.length ? <p>失效条件：{rule.invalidationConditions.join('；')}</p> : null}
  </details>
}
function Sparkline({ values }: { values: number[] }) {
  const min = Math.min(...values), max = Math.max(...values)
  return <svg aria-hidden="true" viewBox="0 0 110 32" className="rs-sparkline"><polyline points={values.map((value, index) => `${3 + index / (values.length - 1) * 104},${29 - (value - min) / (max - min || 1) * 26}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
}

export function ResearchEvidence({ candles, analysis, rules = [], rulesStatus, demo, scenario, selectedLevel, scenarioInitiallyOpen = false }: { candles: Candle[]; analysis?: StockAnalysis | null; rules?: DecisionRule[]; rulesStatus?: 'loading' | 'ready' | 'error'; demo?: boolean; scenario?: ReactNode; selectedLevel?: MergedLevel | null; scenarioInitiallyOpen?: boolean }) {
  const [tab, setTab] = useState<'recent' | 'rules' | 'history' | 'scenario'>(scenarioInitiallyOpen && scenario ? 'scenario' : 'recent')
  const id = useId()
  const tabs = [
    ['recent', '走势依据', 'chart'], ['rules', '笔记规则', 'book'], ['history', '历史相似', 'clock'],
    ...(scenario ? [['scenario', '多周期分析', 'layers'] as const] : []),
  ] as const
  const recent = useMemo(() => summarizeRecent(candles), [candles])
  const matches = useMemo(() => findHistoricalMatches(candles), [candles])
  const selectedEvidence = selectedLevel ? levelEvidence(selectedLevel, candles.at(-1)?.close ?? 0, rules, analysis, matches) : null
  return <section className="rs-evidence" aria-label="研究依据">
    <div className="rs-evidence-heading"><div><h2>价位选择依据{selectedLevel ? ` · ${selectedLevel.value.toFixed(2)}` : ''}</h2><p>{selectedLevel ? '只核对所选价位关联的规则与历史片段。' : '先在上方选择候选价位，再核对笔记和历史依据。'}</p></div><Link href="/rules">管理规则<StudioIcon name="arrow" size={14} /></Link></div>
    <header><div className="rs-evidence-tabs" role="tablist" aria-label="研究依据类型">{tabs.map(([key, label, icon], index) => <button id={`${id}-tab-${key}`} aria-controls={`${id}-panel-${key}`} aria-selected={tab === key} tabIndex={tab === key ? 0 : -1} key={key} onClick={() => setTab(key)} onKeyDown={(event) => {
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length : null
      if (next === null) return
      event.preventDefault(); setTab(tabs[next][0]); document.getElementById(`${id}-tab-${tabs[next][0]}`)?.focus()
    }} role="tab" type="button"><StudioIcon name={icon} size={16} />{label}</button>)}</div></header>
    <div className="rs-evidence-body">
      <div id={`${id}-panel-recent`} role="tabpanel" aria-labelledby={`${id}-tab-recent`} hidden={tab !== 'recent'} tabIndex={0}>
      {tab === 'recent' ? recent ? <><div className="rs-evidence-caption"><strong>近 20 个交易日</strong><span>{recent.startDay} — {recent.endDay}</span></div><div className="rs-observations"><div><span>价格位置</span><strong>{recent.aboveMa20 ? '位于 MA20 上方' : '位于 MA20 下方'}</strong><p>MA20 <b>{recent.ma20.toFixed(2)}</b></p></div><div><span>区间变化</span><strong className={recent.returnPercent >= 0 ? 'rs-up' : 'rs-down'}>{signed(recent.returnPercent)}</strong><p>最高 {recent.high.toFixed(2)} · 最低 {recent.low.toFixed(2)}</p></div><div><span>当日量能 / 前 20 日均量</span><strong>{recent.volumeRatio === null ? '数据不足' : `${recent.volumeRatio.toFixed(2)} 倍`}</strong><p>{recent.volumeRatio !== null && recent.volumeRatio > 1 ? '成交量高于近期均值' : '成交量未超过近期均值'}</p></div></div></> : <p className="rs-evidence-empty">至少需要 20 根 K 线，才能形成近期走势依据。</p> : null}
      </div>
      <div id={`${id}-panel-rules`} role="tabpanel" aria-labelledby={`${id}-tab-rules`} hidden={tab !== 'rules'} tabIndex={0}>
      {demo ? <p className="rs-evidence-empty">示例模式不载入个人笔记规则。切换真实股票后，将显示规则条件和命中依据。</p> : (selectedEvidence ? selectedEvidence.matchingRules : rules).length ? <div className="rs-evidence-rules">{(selectedEvidence ? selectedEvidence.matchingRules : rules).map((rule) => <RuleEvidence key={rule.ruleId} rule={rule} analysis={analysis} />)}</div> : <p className="rs-evidence-empty">{rulesStatus === 'loading' ? '正在读取笔记规则，图表可以先使用。' : rulesStatus === 'error' ? '笔记规则服务暂不可用。连接恢复后刷新可重新校验。' : selectedLevel ? '暂无已命中且关联所选价位指标的规则。' : '当前没有已发布的可计算规则。可从规则库导入笔记、审核并发布。'}</p>}<p className="rs-evidence-footnote">规则用于核验当前走势；基准预测价格是否采用规则，以模型说明为准。</p>
      </div>
      <div id={`${id}-panel-history`} role="tabpanel" aria-labelledby={`${id}-tab-history`} hidden={tab !== 'history'} tabIndex={0}>
      {tab === 'history' ? <><div className="rs-evidence-caption"><strong>与最近 10 日价格路径对照</strong><span>仅比较已发生的历史片段</span></div>{(selectedEvidence ? selectedEvidence.comparableHistory : matches).length ? <div className="rs-history-list">{(selectedEvidence ? selectedEvidence.comparableHistory : matches).map((match) => <div key={match.startDay}><span><strong>{match.startDay} — {match.endDay}</strong><small>路径偏差 {match.distance.toFixed(2)} 个百分点</small></span><Sparkline values={match.closes} /><span><small>历史后续 3 日</small><strong className={match.followThroughReturn >= 0 ? 'rs-up' : 'rs-down'}>{signed(match.followThroughReturn)}</strong></span></div>)}</div> : <p className="rs-evidence-empty">历史片段不足，暂时没有可对照的走势。</p>}<p className="rs-evidence-footnote">按归一化价格路径的均方根偏差排序，偏差越小越接近；历史表现不代表未来结果。</p></> : null}
      </div>
      {scenario ? <div id={`${id}-panel-scenario`} role="tabpanel" aria-labelledby={`${id}-tab-scenario`} hidden={tab !== 'scenario'} tabIndex={0}>{scenario}</div> : null}
    </div>
  </section>
}
