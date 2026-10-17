import type { AnalysisPeriod, Horizon, PriceReference, ScenarioAnalysis } from './scenario-types'
import { SCENARIO_INDICATORS } from './scenario-calculator'
import { displayTime, INDICATOR_NAMES, issueLabel, PERIOD_NAMES } from './scenario-labels'

export function ScenarioReferenceTable({ analysis, period, method, scenarioId, horizons }: {
  analysis: ScenarioAnalysis; period: AnalysisPeriod; method: PriceReference['method']; scenarioId: string | null; horizons: Horizon[]
}) {
  const refs = analysis.references.filter(r => r.period === period && r.method === method && (method !== 'rolling_close' || r.scenarioId === scenarioId))
  const origin = analysis.states[period]?.facts
  return <div className="sa-table-scroll">
    <table className="sa-reference-table" aria-label={PERIOD_NAMES[period] + ' MA/BOLL参考位'}>
      <caption>{PERIOD_NAMES[period]} MA/BOLL参考位 · 原点 {displayTime(analysis.input.periods[period]?.lastClosedAt ?? null)}</caption>
      <thead><tr><th>指标</th><th>原点值</th>{horizons.map(h => {
        const target = refs.find(r => r.target.horizon === h)?.target
        return <th key={h}>未来第{h}根<small>{target?.barKey ? displayTime(target.barKey) : '日期待核实'}</small></th>
      })}</tr></thead>
      <tbody>{SCENARIO_INDICATORS.map(indicator => <tr key={indicator}>
        <th scope="row">{INDICATOR_NAMES[indicator]}</th><td>{origin?.[indicator]?.toFixed(2) ?? '—'}</td>
        {horizons.map(h => {
          const ref = refs.find(r => r.indicator === indicator && r.target.horizon === h)
          const reason = ref?.issues.find(i => i !== 'calendar_missing' && i !== 'calendar_out_of_range') ?? ref?.issues[0]
          return <td key={h} className={ref?.valid ? '' : 'sa-invalid'}>
            <strong>{ref?.value?.toFixed(2) ?? '—'}</strong>
            {!ref?.valid ? <small>{issueLabel(reason ?? 'history_insufficient')}</small>
              : origin?.close ? <small>距原点收盘 {((ref.value! / origin.close - 1) * 100).toFixed(2)}%</small> : null}
          </td>
        })}
      </tr>)}</tbody>
    </table>
  </div>
}
