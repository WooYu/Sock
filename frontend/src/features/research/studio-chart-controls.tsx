import type { ChartPeriod } from '../chart/chart-types'
import { MA_COLORS, MA_PERIODS, PERIOD_LABELS, isMinutePeriod, type IndicatorKey } from '../chart/chart-periods'
import { StudioIcon } from './studio-icon'

const mainPeriods: ChartPeriod[] = ['intraday', 'day', 'week', 'month', 'quarter', 'year']
const minutePeriods: ChartPeriod[] = ['1m', '5m', '15m', '30m', '60m', '120m']

export function StudioChartControls({ period, onPeriod, indicators, onIndicator, predictionVisible, onPrediction, zoom, onZoom, onReset, onUndo, onRedo, crosshair, onCrosshair }: { period: ChartPeriod; onPeriod: (period: ChartPeriod) => void; indicators: Record<IndicatorKey, boolean>; onIndicator: (key: IndicatorKey, visible: boolean) => void; predictionVisible: boolean; onPrediction: (visible: boolean) => void; zoom: number; onZoom: (zoom: number) => void; onReset: () => void; onUndo: () => void; onRedo: () => void; crosshair: boolean; onCrosshair: () => void }) {
  return <div className="rs-chart-controls">
    <div className="rs-chart-primary-controls">
      <div role="tablist" aria-label="K线周期" className="rs-periods">{mainPeriods.map((key) => <button type="button" key={key} role="tab" aria-selected={period === key} onClick={() => onPeriod(key)}>{PERIOD_LABELS[key]}</button>)}</div>
      <select className={`rs-minute-select ${isMinutePeriod(period) ? 'is-active' : ''}`} aria-label="分钟K线周期" value={isMinutePeriod(period) ? period : ''} onChange={(event) => onPeriod(event.target.value as ChartPeriod)}><option value="" disabled>分钟 K 线</option>{minutePeriods.map((key) => <option key={key} value={key}>{PERIOD_LABELS[key]}</option>)}</select>
      <label className="rs-prediction-toggle"><input type="checkbox" role="switch" aria-label="未来推演" checked={predictionVisible} onChange={(event) => onPrediction(event.target.checked)} /><span>未来推演</span></label>
    </div>
    <div className="rs-chart-secondary-controls">
      {period !== 'intraday' ? <div className="rs-indicators" aria-label="均线与布林指标">{MA_PERIODS.map((value) => { const key = `ma${value}` as const; return <label className={`rs-indicator rs-${key}`} key={key} style={{ color: MA_COLORS[key] }}><input type="checkbox" role="switch" aria-label={`MA${value}`} checked={indicators[key]} onChange={(event) => onIndicator(key, event.target.checked)} /><i /><span>MA{value}</span></label> })}<label className="rs-indicator rs-boll"><input type="checkbox" role="switch" aria-label="BOLL" checked={indicators.boll} onChange={(event) => onIndicator('boll', event.target.checked)} /><i /><span>BOLL</span></label></div> : <span className="rs-intraday-explanation">分时价格 · 成交均价 · 成交量</span>}
    </div>
    <div className="rs-chart-view-controls" aria-label="视图控制"><button title="撤销 Ctrl+Z" aria-label="撤销" className="rs-icon-button" onClick={onUndo} type="button"><StudioIcon name="undo" size={16} /></button><button title="重做 Ctrl+Y" aria-label="重做" className="rs-icon-button" onClick={onRedo} type="button"><StudioIcon name="redo" size={16} /></button><span className="rs-control-divider" /><button title="缩小" aria-label="缩小" className="rs-icon-button" onClick={() => onZoom(Math.max(80, zoom - 10))} type="button"><StudioIcon name="minus" size={16} /></button><span className="rs-zoom">{zoom}%</span><button title="放大" aria-label="放大" className="rs-icon-button" onClick={() => onZoom(Math.min(150, zoom + 10))} type="button"><StudioIcon name="plus" size={16} /></button><button aria-label="复位视图" title="复位视图" className="rs-icon-button" onClick={onReset} type="button"><StudioIcon name="refresh" size={16} /></button><button aria-label="十字光标" title="十字光标" aria-pressed={crosshair} className="rs-icon-button" onClick={onCrosshair} type="button"><StudioIcon name="crosshair" size={16} /></button></div>
  </div>
}
