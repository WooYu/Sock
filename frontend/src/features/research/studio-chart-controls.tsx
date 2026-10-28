import type { ChartPeriod } from '../chart/chart-types'
import { CHART_PERIODS, PERIOD_LABELS } from '../chart/chart-periods'
import { StudioIcon } from './studio-icon'

const mainPeriods: ChartPeriod[] = ['intraday', 'day', 'week', 'month']
const otherPeriods = CHART_PERIODS.filter(period => !mainPeriods.includes(period))

export function StudioChartControls({ period, onPeriod, mode, onMode, onSettings, calendarOnly = false }: {
  period: ChartPeriod
  onPeriod: (period: ChartPeriod) => void
  mode: 'read' | 'draw'
  onMode: (mode: 'read' | 'draw') => void
  onSettings: () => void
  calendarOnly?: boolean
}) {
  return <div className="rs-workbench-controls">
    <div className="rs-workbench-periods">
      <div role="tablist" aria-label="K线周期">{mainPeriods.map(key => <button type="button" key={key} role="tab" disabled={calendarOnly && key === 'intraday'} aria-selected={period === key} onClick={() => onPeriod(key)}>{PERIOD_LABELS[key]}</button>)}</div>
      <select aria-label="更多K线周期" className={otherPeriods.includes(period) ? 'is-active' : ''} value={otherPeriods.includes(period) ? period : ''} onChange={event => onPeriod(event.target.value as ChartPeriod)}>
        <option value="" disabled>更多周期</option>{otherPeriods.map(key => <option key={key} value={key} disabled={calendarOnly && !['quarter', 'year'].includes(key)}>{PERIOD_LABELS[key]}</option>)}
      </select>
    </div>
    <div className="rs-workbench-mode-row">
      <div className="rs-workbench-modes" role="group" aria-label="图表操作模式">
        <button type="button" aria-pressed={mode === 'read'} onClick={() => onMode('read')}><StudioIcon name="chart" size={16} />看图</button>
        <button type="button" aria-pressed={mode === 'draw'} onClick={() => onMode('draw')}><StudioIcon name="trend-line" size={16} />绘图</button>
      </div>
      <button type="button" className="rs-workbench-settings" aria-haspopup="dialog" onClick={onSettings}><StudioIcon name="layers" size={16} />图表设置</button>
    </div>
  </div>
}
