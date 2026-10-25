import { MA_PERIODS, PERIOD_LABELS, indicatorColor, formatChartTime, type ChartPeriod, type IndicatorKey, type MaKey } from './chart-periods'
import type { IndicatorProjection, ProjectionKey } from './indicator-projection'

const labels = { bollUpper: 'BOLL上轨', bollMiddle: 'BOLL中轨', bollLower: 'BOLL下轨' }

function ForecastValues({ point, keys, ma20, baseClose }: { point: IndicatorProjection; keys: ProjectionKey[]; ma20?: boolean; baseClose?: number }) {
  return <div className="rs-forecast-value-grid">{keys.map(key => {
    const value = point.values[key]
    const change = value != null && baseClose && baseClose > 0 ? (value / baseClose - 1) * 100 : null
    return <div key={key} data-indicator={key} style={{ color: indicatorColor(key, ma20) }}>
      <strong><i style={{ background: indicatorColor(key, ma20) }} />{key.startsWith('ma') ? key.toUpperCase() : labels[key as keyof typeof labels]}</strong>
      <span>{value?.toFixed(2) ?? '—'}</span>
      {change !== null ? <em>{change >= 0 ? '+' : ''}{change.toFixed(2)}%</em> : null}
      <small>{value == null ? '历史不足' : point.ranges[key] ? `${point.ranges[key]![0].toFixed(2)}～${point.ranges[key]![1].toFixed(2)}` : '区间暂无'}</small>
    </div>
  })}</div>
}

export function IndicatorForecastDetails({ points, period, indicators, selectedTime, onSelect, session, baseClose }: {
  session?: IndicatorProjection | null
  points: IndicatorProjection[]
  period: ChartPeriod
  indicators: Partial<Record<IndicatorKey, boolean>>
  selectedTime: string | null
  onSelect: (time: string | null) => void
  baseClose?: number
}) {
  if (!points.length) return null
  const selected = points.find(point => point.day === selectedTime)
  const keys: ProjectionKey[] = [...MA_PERIODS.filter(n => indicators[`ma${n}`]).map(n => `ma${n}` as MaKey), ...(indicators.boll ? ['bollUpper', 'bollMiddle', 'bollLower'] as const : [])]
  return <section className="rs-indicator-forecast" aria-label="指标预测详情">
    <div className="rs-forecast-section-heading"><strong>指标推演</strong><span>点选时间查看 · 后4根{PERIOD_LABELS[period]}</span></div>
    <div className="rs-forecast-date-buttons" aria-label="选择指标预测时间">{points.map((point, i) => <button key={point.day} type="button" aria-label={`指标预测 ${formatChartTime(point.day, period)}${point.estimated ? '（预计）' : ''} 第${i + 1}根`} aria-pressed={selected?.day === point.day} onClick={() => onSelect(selected?.day === point.day ? null : point.day)}>
      {formatChartTime(point.day, period).replace(/^\d{4}-/, '')}<small>{point.estimated ? '预计 · ' : ''}第{i + 1}根</small>
    </button>)}</div>
    {selected ? <div className="rs-inline-forecast-details">
      <header><strong>{selected.estimated ? '预计 ' : ''}{formatChartTime(selected.day, period)} · 指标预测</strong><button type="button" onClick={() => onSelect(null)}>收起详情</button></header>
      <ForecastValues point={selected} keys={keys} ma20={indicators.ma20} baseClose={baseClose} />
      <p>{baseClose && baseClose > 0 ? `涨跌幅相对历史末根收盘 ${baseClose.toFixed(2)}。` : ''}区间为近期增量延续的情景范围；BOLL 通道与该情景区间分别展示。</p>
    </div> : null}
    {session ? <details className="rs-session-reach"><summary>{session.estimated ? '预计 ' : ''}{session.day.slice(0, 10)} · 当日可达区间</summary>
      <p>覆盖原点之后至该交易日收盘的全部本周期K线，不限于图中的4根。按近期增量延续形成情景范围；若原点已收盘，则查看下一预计交易日。</p>
      <ForecastValues point={session} keys={keys} ma20={indicators.ma20} baseClose={baseClose} />
      <p>大字为该交易日收盘时指标的外推值，下方为余下各根K线情景范围的并集。</p>
    </details> : null}
  </section>
}
