import { ChartTooltipFrame } from './chart-tooltip-frame'
import { scenarioCalendar } from '../scenario/scenario-calendar-data'
import { useState } from 'react'
import type { ChartTransform } from './chart-coordinates'
import { formatChartTime, indicatorColor, MA_PERIODS, type ChartPeriod, type IndicatorKey, type IndicatorValues, type MaKey } from './chart-periods'
import { projectionLimitDays, type ProjectionKey, type IndicatorProjection } from './indicator-projection'

type Props = { baseClose?: number; previousClose?: number; limitRatio?: number; times: string[]; estimated?: boolean; ranges?: IndicatorProjection['ranges'][]; historicalCount: number; transform: ChartTransform; period: ChartPeriod; indicators: Partial<Record<IndicatorKey, boolean>>; values: IndicatorValues; interactive: boolean; selectedTime?: string | null; onSelect?: (time: string | null) => void }
const labels: Record<string, string> = { bollUpper: 'BOLL上', bollMiddle: 'BOLL中', bollLower: 'BOLL下' }
export function IndicatorProjectionLayer({ baseClose, previousClose, limitRatio, times, estimated, ranges, historicalCount, transform, period, indicators, values, interactive, selectedTime: controlledTime, onSelect }: Props) {
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [hoveredTime, setHoveredTime] = useState<string | null>(null)
  const chosenTime = controlledTime === undefined ? selectedTime : controlledTime
  const selectTime = (time: string | null) => { setSelectedTime(time); onSelect?.(time) }
  const activeTime = hoveredTime ?? chosenTime
  const selected = times.indexOf(activeTime ?? '')
  if (!times.length) return null
  const keys: ProjectionKey[] = [...MA_PERIODS.filter(n => indicators[`ma${n}`]).map(n => `ma${n}` as MaKey), ...(indicators.boll ? ['bollUpper', 'bollMiddle', 'bollLower'] as const : [])]
  const valueAt = (key: ProjectionKey, i: number) => key === 'bollUpper' ? values.boll.upper[historicalCount + i] : key === 'bollMiddle' ? values.boll.middle[historicalCount + i] : key === 'bollLower' ? values.boll.lower[historicalCount + i] : values[key]?.[historicalCount + i]
  const hasBase = baseClose != null && Number.isFinite(baseClose) && baseClose > 0
  const hasLimit = hasBase && limitRatio != null && Number.isFinite(limitRatio) && limitRatio > 0 && limitRatio < 1
  const origin = transform.times[historicalCount - 1]
  const spans = times.map(time => origin ? projectionLimitDays(origin, time, period, scenarioCalendar) : null)
  const reach = (i: number) => spans[i]
  const minute = period === 'intraday' || period === '5day' || /^\d+m$/.test(period)
  const limitBase = minute ? previousClose : baseClose
  const withinLimit = (value: number, i: number) => {
    const span = reach(i)
    if (!hasLimit || !span || limitBase == null || !Number.isFinite(limitBase) || limitBase <= 0) return false
    const days = minute ? span.days + 1 : span.days
    return value >= limitBase * (1 - limitRatio!) ** days - .005 && value <= limitBase * (1 + limitRatio!) ** days + .005
  }
  const percent = (value: number) => { const change = (value / baseClose! - 1) * 100; return `${change >= 0 ? '+' : ''}${change.toFixed(2)}%` }
  const color = (key: ProjectionKey) => indicatorColor(key, indicators.ma20)
  const x = transform.xForTime(times[0]) - transform.widthForTime(times[0]) / 2
  const textTime = (time: string) => time.startsWith('forecast:') ? `第${times.indexOf(time) + 1}根 · 日期待核实` : formatChartTime(time, period)
  return <g data-testid="indicator-projection" onKeyDown={e => { if (e.key === 'Escape') { selectTime(null); setHoveredTime(null) } }}>
    <rect x={x} y={transform.rect.top} width={transform.rect.left + transform.rect.width - x} height={transform.rect.height} fill="var(--sc-muted)" opacity=".035" pointerEvents="none" />
    <ChartTooltipFrame x={x + 4} y={transform.rect.top + 15} maxWidth={140} testId="projection-hint">{() => <text fill="var(--sc-muted)" fontSize="12">后4根 · 点选查看</text>}</ChartTooltipFrame>
    {times.map((time, i) => <g key={time} data-last-projection={i === times.length - 1 || undefined}>
      <line data-testid="projection-day-line" x1={transform.xForTime(time)} x2={transform.xForTime(time)} y1={transform.rect.top + 20} y2={400} stroke="var(--sc-muted)" strokeDasharray="3 4" opacity=".65" pointerEvents="none" />
      {keys.map(key => { const value = valueAt(key, i); return value != null && withinLimit(value, i) ? <g key={key} pointerEvents="none"><circle data-testid="projection-within-limit" cx={transform.xForTime(time)} cy={transform.yForPrice(value)} r="4" fill={color(key)} stroke="var(--sc-surface)" strokeWidth="1.5"><title>{`${labels[key] ?? key.toUpperCase()} ${value.toFixed(2)} (${percent(value)}) · 涨跌幅限制内`}</title></circle></g> : null })}
      <ChartTooltipFrame x={transform.xForTime(time)} y={time.includes('T') ? 412 : 422} maxWidth={100} testId="projection-date-label">{() => <text x={0} y={0} fill="var(--sc-muted)" fontSize="11" textAnchor="middle" pointerEvents="none">{time.startsWith('forecast:') ? `第${i + 1}根` : ['year', 'month', 'quarter'].includes(period) ? formatChartTime(time, period) : time.slice(5, 10)}{time.includes('T') ? <tspan x={0} dy="11">{time.slice(11, 16)}</tspan> : null}</text>}</ChartTooltipFrame>
      <g className="rs-projection-target" role="button" tabIndex={interactive ? 0 : -1} aria-label={`查看预测 ${textTime(time)}`} aria-pressed={selected === i} pointerEvents={interactive ? 'auto' : 'none'} onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); selectTime(chosenTime === time ? null : time) }} onMouseEnter={() => setHoveredTime(time)} onMouseLeave={() => setHoveredTime(null)} onFocus={() => setHoveredTime(time)} onBlur={() => setHoveredTime(null)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); selectTime(time) } }}>
        <rect className="rs-projection-hit" x={transform.xForTime(time) - transform.widthForTime(time) / 2} y={transform.rect.top + 20} width={transform.widthForTime(time)} height={transform.rect.height - 20} fill="var(--sc-primary)" opacity={selected === i ? '.14' : '0'} />
        <title>{`${textTime(time)}：查看全部已选 MA 与 BOLL 预测值及情景区间`}</title>
      </g>
    </g>)}
    {selected >= 0 ? keys.map(key => {
      const value = valueAt(key, selected), range = ranges?.[selected]?.[key]
      if (value == null || !Number.isFinite(value)) return null
      const px = transform.xForTime(times[selected])
      return <g key={key} pointerEvents="none">{range ? <line x1={px} x2={px} y1={transform.yForPrice(range[0])} y2={transform.yForPrice(range[1])} stroke={color(key)} strokeWidth="3" opacity=".4" /> : null}<circle cx={px} cy={transform.yForPrice(value)} r="3" fill={color(key)} stroke="var(--sc-surface)" /></g>
    }) : null}
    {selected >= 0 ? <ChartTooltipFrame x={transform.rect.left + 6} y={transform.rect.top + 24} maxWidth={transform.rect.width - 12} testId="projection-tooltip">{availableWidth => <>
      <rect x={0} y={0} width={Math.min(530, availableWidth)} height={92 + keys.length * 23} rx="7" className="sc-chart-tooltip-bg" />
      <text x={10} y={19} className="sc-chart-tooltip-title">{estimated ? '预计 ' : ''}{textTime(times[selected])} · 预测 / 情景区间</text>
      {keys.map((key, i) => {
        const value = valueAt(key, selected), range = ranges?.[selected]?.[key]
        return <g key={key}><circle data-indicator={key} cx={13} cy={38 + i * 23} r={3} fill={color(key)} /><text x={23} y={42 + i * 23} fill="var(--sc-foreground)" fontSize={12}>{value != null && withinLimit(value, selected) ? '◆ ' : ''}{labels[key] ?? key.toUpperCase()}　{value?.toFixed(2) ?? '—'} {value != null && hasBase ? `(${percent(value)})` : ''}　{value == null ? '历史不足' : range ? `${range[0].toFixed(2)}～${range[1].toFixed(2)}` : '区间暂无'}</text></g>
      })}
      <text x={10} y={48 + keys.length * 23} fill="var(--sc-muted)" fontSize="12">{hasBase ? `百分比相对历史末根收盘 ${baseClose!.toFixed(2)}` : '缺少收盘基准，无法计算涨跌幅'}</text>
      <text x={10} y={69 + keys.length * 23} fill="var(--sc-muted)" fontSize="12">{hasLimit && reach(selected) && (!minute || (previousClose != null && previousClose > 0)) ? `◆ 限制内：每日 ±${(limitRatio! * 100).toFixed(2)}%，累计 ${reach(selected)!.days + (minute ? 1 : 0)} 个交易日${reach(selected)!.estimated ? '（日历待核实）' : ''}${minute ? '，基准为昨收' : ''}` : '未标记限制范围：缺少有效基准或涨跌幅限制'}</text>
    </>}</ChartTooltipFrame> : null}
  </g>
}
