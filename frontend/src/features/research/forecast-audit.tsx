'use client'
import { useEffect, useState } from 'react'
import type { MarketSnapshot } from '../workspace/stock-workspace-types'
import { projectIndicators, type IndicatorProjection } from '../chart/indicator-projection'
import { ProjectionEvaluation } from '../chart/projection-evaluation'
import { scenarioCalendar } from '../scenario/scenario-calendar-data'
type Audit = { origin: string; close: number; createdAt: string; points: IndicatorProjection[] }
export function ForecastAudit({ market }: { market: MarketSnapshot }) {
  const [records, setRecords] = useState<Audit[]>([]), [error, setError] = useState('')
  const key = `stockcal.indicator-audit.v1:${market.quote.security.code}:${market.adjustment ?? 'none'}`
  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (!active) return
      try {
        const stored = localStorage.getItem(key)
        const saved: Audit[] = stored ? JSON.parse(stored) : []
        if (!Array.isArray(saved) || !saved.every(r => typeof r.origin === 'string' && Number.isFinite(r.close) && Array.isArray(r.points))) throw Error('核验记录格式异常，原记录已保留。')
        const cutoff = Math.min(Date.parse(market.source.fetchedAt), Date.now())
        const closed = market.dailyCandles.filter(bar => Date.parse(bar.day + 'T15:00:00+08:00') <= cutoff)
        const origin = closed.at(-1)
        if (origin && !saved.some(r => r.origin === origin.day)) {
          saved.unshift({ origin: origin.day, close: origin.close, createdAt: new Date().toISOString(), points: projectIndicators(closed, 'day', scenarioCalendar) })
          // Freeze the first observed forecast for each closed origin; do not backfill past forecasts.
          saved.splice(90)
          localStorage.setItem(key, JSON.stringify(saved))
        }
        setRecords(saved); setError('')
      } catch (cause) { setError(cause instanceof Error ? cause.message : '核验记录暂不可用。') }
    })
    return () => { active = false }
  }, [key, market])
  return <details className="rs-forecast-audit"><summary>预测核验记录 · 自动留存 {records.length} 次</summary><p>打开工作台时，留存最近已收盘日的首次预测，随后与实际指标对照。最多保留 90 次，记录位于当前浏览器；未打开期间不会补造历史预测。</p>{error ? <p role="alert">{error}</p> : null}{records.slice(0, 12).map(record => <section key={record.origin}><h4>原点 {record.origin} · {market.adjustment === 'qfq' ? '前复权' : '不复权'}</h4><small>记录于 {record.createdAt}</small><ProjectionEvaluation recordedAt={record.createdAt} points={record.points} candles={market.dailyCandles} fetchedAt={market.source.fetchedAt} basisValid={Math.abs((market.dailyCandles.find(bar => bar.day === record.origin)?.close ?? NaN) - record.close) < 0.005} /></section>)}</details>
}
