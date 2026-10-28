'use client'

import { useEffect, useMemo, useState } from 'react'
import type { MarketSnapshot } from '../workspace/stock-workspace-types'
import { aggregateCandles } from './chart-math'
import { isIntradayPeriod, type ChartPeriod } from './chart-periods'
import type { ChartSeries, PriceAdjustment } from './chart-market-types'
import { browserMarketClient } from '@/lib/api/browser-client'
import { cachedChartSeries } from '@/lib/api/market-history-cache'
import { isA50Futures, isMarketIndex } from '@/lib/api/market-symbol'

export type ChartSeriesLoader = (symbol: string, period: ChartPeriod, signal?: AbortSignal, adjustment?: PriceAdjustment) => Promise<ChartSeries>
type SeriesState = { key: string; data: ChartSeries | null; loading: boolean; error: string | null }

export function useChartSeries(snapshot: MarketSnapshot | null | undefined, period: ChartPeriod, loader?: ChartSeriesLoader, requestedAdjustment: PriceAdjustment = snapshot?.adjustment ?? 'none') {
  const symbol = snapshot?.quote.security.code ?? ''
  const adjustment = isMarketIndex(symbol) || isA50Futures(symbol) || isIntradayPeriod(period) ? 'none' : requestedAdjustment
  const [attempt, setAttempt] = useState(0)
  const key = `${symbol}:${period}:${adjustment}:${attempt}`
  const [remote, setRemote] = useState<SeriesState>({ key: '', data: null, loading: false, error: null })
  const local = useMemo<ChartSeries | null>(() => snapshot && !isIntradayPeriod(period) && (snapshot.adjustment ?? 'none') === adjustment ? {
    symbol, period, adjustment: snapshot.adjustment ?? 'none', kind: 'candles', bars: aggregateCandles(snapshot.dailyCandles, period), source: snapshot.source,
    previousClose: snapshot.quote.previousClose, limitedHistory: true,
  } : null, [period, snapshot, symbol, adjustment])
  // A full daily snapshot already carries enough observations for MA250 plus a useful view.
  const needsRemote = Boolean(loader && symbol && (period !== 'day' || !local || (snapshot?.dailyCandles.length ?? 0) < 370))
  const cached = useMemo(() => loader === browserMarketClient.series ? cachedChartSeries(symbol, period, adjustment) : null, [loader, symbol, period, adjustment])

  useEffect(() => {
    if (!needsRemote || !loader) return
    const controller = new AbortController()
    void loader(symbol, period, controller.signal, adjustment).then((data) => {
      if (controller.signal.aborted) return
      if (data.symbol !== symbol || data.period !== period || data.adjustment !== adjustment) throw new Error('返回的股票或周期与请求不一致')
      if (!data.bars.length) throw new Error('当前周期没有可用行情')
      setRemote({ key, data, loading: false, error: null })
    }).catch((error) => {
      if (controller.signal.aborted) return
      setRemote((old) => ({ key, data: old.key.startsWith(`${symbol}:${period}:${adjustment}:`) && old.data ? old.data : cached ?? (period === 'day' ? local : null), loading: false, error: error instanceof Error ? error.message : '该周期行情暂不可用' }))
    })
    return () => controller.abort()
  }, [attempt, cached, key, loader, local, needsRemote, period, snapshot, symbol, adjustment])

  if (!needsRemote) return { data: local, loading: false, error: isIntradayPeriod(period) ? '当前数据源未提供分时或分钟行情' : null, retry: () => setAttempt((value) => value + 1) }
  const state = remote.key === key ? remote : { data: remote.key.startsWith(`${symbol}:${period}:${adjustment}:`) ? remote.data : cached ?? (period === 'day' ? local : null), loading: true, error: null }
  return { ...state, retry: () => setAttempt((value) => value + 1) }
}
