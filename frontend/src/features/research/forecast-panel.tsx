'use client'

import { useState } from 'react'
import type { PredictionSnapshot } from '../chart/chart-types'
import { StudioIcon } from './studio-icon'
import { MA_PERIODS } from '../chart/chart-periods'

type Props = { prediction: PredictionSnapshot | null; selectedDay: string | null; onSelectDay: (day: string) => void; currentPrice: number; status?: 'idle' | 'loading' | 'ready' | 'error'; error?: string | null; onRetry?: () => void; hidden?: boolean; onShow?: () => void; period?: string }

export function ForecastPanel({ prediction, selectedDay, onSelectDay, currentPrice, status, error, onRetry, hidden, onShow, period = 'day' }: Props) {
  const [detail, setDetail] = useState<'price' | 'ma' | 'boll'>('price')
  const selectedIndex = Math.max(0, prediction?.days.findIndex((day) => day.day === selectedDay) ?? 0)
  const day = prediction?.days[selectedIndex]
  const labels = { price: '价格', ma: 'MA 均线', boll: 'BOLL 通道' }
  return <section className="rs-forecast" aria-label="未来预测">
    <header className="rs-panel-title"><div><StudioIcon name="chart" /><h2>未来 3 个交易日</h2></div><span>基准推演</span></header>
    {prediction && (status === 'loading' || status === 'error') ? <p className="rs-forecast-refresh" role="status">{status === 'loading' ? '正在刷新，当前显示上次预测。' : `预测刷新失败，当前显示上次结果。${error ?? ''}`}</p> : null}
    {period !== 'day' ? <div className="rs-panel-empty"><StudioIcon name="clock" size={28} /><h3>日线预测</h3><p>切回日线查看未来三个交易日的价格与指标。</p></div>
      : hidden ? <div className="rs-panel-empty"><StudioIcon name="layers" size={28} /><h3>预测图层已隐藏</h3><p>重新显示后可与真实 K 线对照。</p><button className="rs-button" onClick={onShow} type="button">显示未来推演</button></div>
      : !prediction || !day ? <div className="rs-panel-empty" role="status"><StudioIcon name={status === 'loading' ? 'refresh' : 'chart'} size={28} /><h3>{status === 'loading' ? '正在计算未来走势' : '预测暂不可用'}</h3><p>{status === 'loading' ? '行情和绘图可以继续使用。' : error ?? '等待至少 20 个有效交易日的行情。'}</p>{status !== 'loading' && onRetry ? <button className="rs-button" onClick={onRetry} type="button">重试预测</button> : null}</div>
      : <>
        <div className="rs-forecast-days" aria-label="未来日期">
          {prediction.days.map((item, index) => <button aria-pressed={selectedIndex === index} key={item.day} onClick={() => onSelectDay(item.day)} type="button"><span>T+{index + 1}</span><strong>{item.day.slice(5).replace('-', '/')}</strong><small className={item.close >= currentPrice ? 'rs-up' : 'rs-down'}>{item.close.toFixed(2)}</small></button>)}
        </div>
        <div className="rs-forecast-price"><span>第 {selectedIndex + 1} 日 · 预测收盘</span><div><strong className={day.close >= currentPrice ? 'rs-up' : 'rs-down'}>{day.close.toFixed(2)}</strong><span className={day.close >= currentPrice ? 'rs-up' : 'rs-down'}>{day.close >= currentPrice ? '+' : ''}{currentPrice > 0 ? ((day.close / currentPrice - 1) * 100).toFixed(2) : '—'}%</span></div><p>相对最新行情 · {day.day}</p></div>
        <div className="rs-range"><div><span>推演价格区间</span><strong>{day.rangeLow.toFixed(2)} – {day.rangeHigh.toFixed(2)}</strong></div><div className="rs-range-track"><i style={{ left: `${Math.min(100, Math.max(0, (day.close - day.rangeLow) / (day.rangeHigh - day.rangeLow || 1) * 100))}%` }} /></div><div><span>{day.rangeLow.toFixed(2)}</span><span>{day.rangeHigh.toFixed(2)}</span></div></div>
        <div className="rs-detail-tabs" role="tablist" aria-label="预测指标类型">{(['price', 'ma', 'boll'] as const).map((key) => <button role="tab" aria-selected={detail === key} key={key} onClick={() => setDetail(key)} type="button">{labels[key]}</button>)}</div>
        <dl className="rs-forecast-values" aria-label={`${labels[detail]}预测值`}>
          {(detail === 'price' ? [['预测开盘', day.open], ['预测最高', day.high], ['预测最低', day.low], ['预测收盘', day.close]] : detail === 'ma' ? MA_PERIODS.map((period) => [`MA${period}`, day[`ma${period}`]]) : [['BOLL 上轨', day.bollUpper], ['BOLL 中轨', day.bollMiddle], ['BOLL 下轨', day.bollLower]]).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value === null || value === undefined ? '—' : Number(value).toFixed(2)}</dd></div>)}
        </dl>
        {detail === 'ma' && MA_PERIODS.some((period) => day[`ma${period}`] == null) ? <p className="rs-forecast-note">“—”表示历史不足以计算该均线，不以短窗口替代。</p> : null}
        <p className="rs-forecast-note">虚线为推演，实色为历史行情。MA 与 BOLL 基于历史收盘及预测收盘连续计算。</p>
        <details className="rs-model-details"><summary>计算说明与生成时间</summary><p>{prediction.modelVersion === 'baseline-v1' ? '当前使用近 20 日线性趋势与波动区间。笔记规则用于独立校验，尚未调整此基准路径。' : '预测值来自当前返回的模型快照。'}</p><p>模型参考值 {Math.round(day.confidence * 100)}%，未经回测校准，不代表命中概率。</p><code>{prediction.modelVersion}</code><time dateTime={prediction.generatedAt}>{new Date(prediction.generatedAt).toLocaleString('zh-CN')}</time></details>
      </>}
  </section>
}
