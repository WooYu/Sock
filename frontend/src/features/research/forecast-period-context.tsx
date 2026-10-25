import type { AnalysisPeriod, ScenarioAnalysis, ScenarioMode } from '../scenario/scenario-types'
import { ANALYSIS_PERIODS } from '../scenario/scenario-calendar'
import { annotationsForPeriod, matchSelectedModeCandidates } from '../scenario/scenario-state'
import { DIRECTION_NAMES, displayTime, issueLabel, MODE_NAMES, PERIOD_NAMES, STYLE_NAMES } from '../scenario/scenario-labels'

export function ForecastPeriodContext({ analysis, selected, onSelect }: {
  analysis: ScenarioAnalysis; selected: AnalysisPeriod; onSelect: (period: AnalysisPeriod) => void
}) {
  return <div className="rs-period-context" aria-label="各周期趋势与盈利模式">
    {ANALYSIS_PERIODS.map(period => {
      const state = analysis.states[period]
      const input = analysis.input.periods[period]
      const modes = matchSelectedModeCandidates(analysis.states, annotationsForPeriod(analysis.annotations, period), period)
      const confirmed = modes.filter(mode => mode.status === 'confirmed')
      const ready = modes.filter(mode => mode.status === 'candidate')
      const preferred: ScenarioMode | null = state?.direction === 'rising' ? 'trend_climb'
        : state?.direction === 'falling' || analysis.states.day?.direction === 'falling' ? 'down_rebound'
        : state?.direction === 'sideways' ? 'range' : null
      const suggested = confirmed.length ? confirmed : ready.length ? ready : modes.filter(mode => mode.id === preferred && mode.status !== 'not_applicable')
      const direction = state ? DIRECTION_NAMES[state.direction] : '待判断'
      return <section key={period} className={`rs-period-card${selected === period ? ' is-selected' : ''}`} aria-label={`${PERIOD_NAMES[period]}趋势与模式`}>
        <button type="button" disabled={!input} aria-pressed={selected === period} onClick={() => onSelect(period)}>
          <strong>{PERIOD_NAMES[period]}</strong><span className={`rs-trend-${state?.direction ?? 'unknown'}`}>{direction}{state && state.direction !== 'unknown' ? state.confirmed ? ' · 已确认' : ' · 候选' : ''}</span>
        </button>
        {!state?.bars.length ? <p>{analysis.input.loadIssues[period]?.length ? '行情缺失，暂不能判断' : '尚未核对 · 上级未明确时逐级查看'}</p> : <>
          <p className="rs-period-origin">最近完整K线 · {displayTime(input?.lastClosedAt ?? null)}</p>
          <p>K线趋势：{direction}{state.direction === 'rising' && state.style !== 'unknown' ? ` · ${STYLE_NAMES[state.style]}` : ''}。{state.confirmed ? '人工确认已生效。' : 'MA5斜率与收盘位置提示，形态待人工核对。'}</p>
          <p>MA5{state.facts.ma5Delta == null ? '方向待判断' : state.facts.ma5Delta > 0 ? '上行' : state.facts.ma5Delta < 0 ? '下行' : '走平'} · {state.facts.closeAboveMa5 == null ? '收盘位置待判断' : state.facts.close === state.facts.ma5 ? '收盘等于MA5' : state.facts.closeAboveMa5 ? '收盘在MA5上方' : '收盘在MA5下方'}{state.direction === 'rising' && state.style === 'unknown' ? ' · 攀升/飙升待区分' : ''}</p>
          <p><b>{confirmed.length ? '已确认模式' : '优先核对模式'}：</b>{suggested.length ? suggested.map(mode => MODE_NAMES[mode.id]).join(' / ') : '暂未明确'}</p>
          {suggested.filter(mode => mode.status === 'insufficient').map(mode => <p className="rs-period-missing" key={mode.id}>待补：{mode.missing.map(issueLabel).join('、')}</p>)}
          <details><summary>核对全部盈利模式条件</summary><ul>{modes.map(mode => <li key={mode.id}><b>{MODE_NAMES[mode.id]}</b> · {mode.status === 'confirmed' ? '已确认' : mode.status === 'candidate' ? '条件齐备，待确认' : mode.status === 'not_applicable' ? '当前不适用' : '条件不足'}{mode.missing.length ? <span>{mode.missing.map(issueLabel).join('、')}</span> : null}</li>)}</ul></details>
        </>}
      </section>
    })}
  </div>
}
