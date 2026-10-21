'use client'

import { useState } from 'react'
import type { AnalysisPeriod, Horizon, PriceReference, ScenarioAnalysis } from './scenario-types'
import { SCENARIO_INDICATORS } from './scenario-calculator'
import { displayTime, INDICATOR_NAMES, issueLabel, PERIOD_NAMES } from './scenario-labels'
import { indicatorSeries } from './scenario-calculator'

function movement(value: number | null | undefined, previous: number | null | undefined) {
  if (value == null || previous == null || previous === 0 || !Number.isFinite(value) || !Number.isFinite(previous)) return null
  const percent = (value / previous - 1) * 100
  const rounded = Number(percent.toFixed(2))
  return { percent, tone: rounded > 0 ? 'rise' : rounded < 0 ? 'fall' : 'flat', label: `${rounded > 0 ? '↑ +' : rounded < 0 ? '↓ ' : '→ '}${rounded.toFixed(2)}%` }
}

export function ScenarioReferenceTable({ analysis, period, method, scenarioId, horizons, historyCount = 0 }: {
  analysis: ScenarioAnalysis; period: AnalysisPeriod; method: PriceReference['method']; scenarioId: string | null; horizons: Horizon[]; historyCount?: number
}) {
  const [sort, setSort] = useState('indicator')
  const refs = analysis.references.filter(r => r.period === period && r.method === method && (method !== 'rolling_close' || r.scenarioId === scenarioId))
  const origin = analysis.states[period]?.facts
  const bars = analysis.input.periods[period]?.closed ?? []
  const series = indicatorSeries(bars)
  const historical = bars.slice(-historyCount || bars.length)
  const enhanced = historyCount > 0
  const finalHorizon = Math.max(...horizons)
  const rows = SCENARIO_INDICATORS.map(indicator => {
    const forecasts = horizons.map(h => refs.find(r => r.indicator === indicator && r.target.horizon === h))
    const last = refs.find(r => r.indicator === indicator && r.target.horizon === finalHorizon)
    const current = series[indicator].at(-1)
    const change = movement(last?.valid ? last.value : null, current)
    const first = forecasts[0]
    const distance = first?.valid && first.value != null && origin?.close ? Math.abs(first.value / origin.close - 1) : null
    return { indicator, forecasts, change, distance }
  })
  if (enhanced && sort !== 'indicator') rows.sort((a, b) => {
    const av = sort === 'distance' ? a.distance : a.change?.percent
    const bv = sort === 'distance' ? b.distance : b.change?.percent
    if (av == null) return bv == null ? 0 : 1
    if (bv == null) return -1
    return sort === 'rise' ? bv - av : av - bv
  })
  return <>
    {enhanced ? <div className="sa-trend-toolbar">
      <div className="sa-trend-legend"><span className="sa-tone-rise">↑ 上升</span><span className="sa-tone-fall">↓ 下降</span><span>→ 持平</span><span>颜色 / 箭头：较上一根指标值</span></div>
      <label>指标排序 <select value={sort} onChange={event => setSort(event.target.value)}>
        <option value="indicator">默认指标顺序</option><option value="rise">预测涨幅优先</option><option value="fall">预测跌幅优先</option><option value="distance">距原点收盘最近优先</option>
      </select></label>
      <p>涨跌排序：未来第{finalHorizon}根较原点指标值；距离排序：未来第{horizons[0]}根较原点收盘价{origin?.close ? ` ${origin.close.toFixed(2)}` : ''}。</p>
    </div> : null}
    <div className={`sa-table-scroll${enhanced ? ' sa-trend-table-scroll' : ''}`}>
    <table className="sa-reference-table" aria-label={PERIOD_NAMES[period] + ' MA/BOLL参考位'}>
      <caption>{PERIOD_NAMES[period]} MA/BOLL参考位 · {analysis.input.periods[period]?.adjustment === 'qfq' ? '前复权' : '不复权'} · 原点 {displayTime(analysis.input.periods[period]?.lastClosedAt ?? null)}</caption>
      <thead><tr><th>指标</th>{historyCount ? historical.map((bar, i) => <th key={bar.day}>历史第{historical.length - i}根<small>{displayTime(bar.day)}</small></th>) : <th>原点值</th>}{horizons.map(h => {
        const target = refs.find(r => r.target.horizon === h)?.target
        return <th className={enhanced && h === horizons[0] ? 'sa-forecast-start' : undefined} key={h}>未来第{h}根<small>{target?.barKey ? displayTime(target.barKey) : '日期待核实'}</small></th>
      })}</tr></thead>
      <tbody>{rows.map(({ indicator, forecasts, change }) => <tr key={indicator}>
        <th scope="row">{INDICATOR_NAMES[indicator]}{enhanced && change ? <small className={`sa-tone-${change.tone}`}>后{finalHorizon}根 {change.label}</small> : null}</th>{historyCount ? historical.map((bar, i) => {
          const index = bars.length - historical.length + i
          const value = series[indicator][index]
          const delta = movement(value, series[indicator][index - 1])
          return <td className="sa-historical-value" key={bar.day}><strong className={delta ? `sa-tone-${delta.tone}` : undefined}>{value?.toFixed(2) ?? '—'}</strong>{delta ? <small className={`sa-step-change sa-tone-${delta.tone}`}>{delta.label}</small> : null}</td>
        }) : <td>{series[indicator].at(-1)?.toFixed(2) ?? '—'}</td>}
        {horizons.map((h, index) => {
          const ref = forecasts[index]
          const previous = h === 1 ? series[indicator].at(-1) : refs.find(r => r.indicator === indicator && r.target.horizon === h - 1 && r.valid)?.value
          const delta = ref?.valid ? movement(ref.value, previous) : null
          const reason = ref?.issues.find(i => i !== 'calendar_missing' && i !== 'calendar_out_of_range') ?? ref?.issues[0]
          return <td key={h} className={`${ref?.valid ? '' : 'sa-invalid'} ${enhanced && h === horizons[0] ? 'sa-forecast-start' : ''} ${enhanced && delta ? `sa-cell-${delta.tone}` : ''}`}>
            <strong className={enhanced && delta ? `sa-tone-${delta.tone}` : undefined}>{ref?.value?.toFixed(2) ?? '—'}</strong>
            {enhanced && delta ? <small className={`sa-step-change sa-tone-${delta.tone}`}>{delta.label}</small> : null}
            {!ref?.valid ? <small>{issueLabel(reason ?? 'history_insufficient')}</small>
              : origin?.close ? <small>距原点收盘 {ref.value! >= origin.close ? '+' : ''}{((ref.value! / origin.close - 1) * 100).toFixed(2)}%</small> : null}
          </td>
        })}
      </tr>)}</tbody>
    </table>
  </div></>
}
