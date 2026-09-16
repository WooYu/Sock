'use client'

import { useEffect, useMemo, useState } from 'react'
import type { MarketSnapshot } from '../workspace/stock-workspace-types'
import { aggregateCandles } from './chart-math'
import { isIntradayPeriod, type ChartPeriod } from './chart-periods'
import type { ChartSeries } from './chart-market-types'

export type ChartSeriesLoader = (symbol: string, period: ChartPeriod, signal?: AbortSignal) => Promise<ChartSeries>
type SeriesState = { key: string; data: ChartSeries | null; loading: boolean; error: string | null }

export function useChartSeries(snapshot: MarketSnapshot | null | undefined, period: ChartPeriod, loader?: ChartSeriesLoader) {
  const symbol = snapshot?.quote.security.code ?? ''
  const [attempt, setAttempt] = useState(0)
  const key = `${symbol}:${period}:${attempt}`
  const [remote, setRemote] = useState<SeriesState>({ key: '', data: null, loading: false, error: null })
  const local = useMemo<ChartSeries | null>(() => snapshot && !isIntradayPeriod(period) ? {
    symbol, period, adjustment: 'none', kind: 'candles', bars: aggregateCandles(snapshot.dailyCandles, period), source: snapshot.source,
    previousClose: snapshot.quote.previousClose, limitedHistory: true,
  } : null, [period, snapshot, symbol])
  // A full daily snapshot already carries enough observations for MA250 plus a useful view.
  const needsRemote = Boolean(loader && symbol && (period !== 'day' || (snapshot?.dailyCandles.length ?? 0) < 370))

  useEffect(() => {
    if (!needsRemote || !loader) return
    const controller = new AbortController()
    void loader(symbol, period, controller.signal).then((data) => {
      if (controller.signal.aborted) return
      if (data.symbol !== symbol || data.period !== period) throw new Error('返回的股票或周期与请求不一致')
      if (!data.bars.length) throw new Error('当前周期没有可用行情')
      setRemote({ key, data, loading: false, error: null })
    }).catch((error) => {
      if (controller.signal.aborted) return
      setRemote((old) => ({ key, data: old.key.startsWith(`${symbol}:${period}:`) && old.data ? old.data : period === 'day' ? local : null, loading: false, error: error instanceof Error ? error.message : '该周期行情暂不可用' }))
    })
    return () => controller.abort()
  }, [attempt, key, loader, local, needsRemote, period, snapshot, symbol])

  if (!needsRemote) return { data: local, loading: false, error: isIntradayPeriod(period) ? '当前数据源未提供分时或分钟行情' : null, retry: () => setAttempt((value) => value + 1) }
  const state = remote.key === key ? remote : { data: remote.key.startsWith(`${symbol}:${period}:`) ? remote.data : period === 'day' ? local : null, loading: true, error: null }
  return { ...state, retry: () => setAttempt((value) => value + 1) }
}
