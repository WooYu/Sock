import type { BrowserMarketClient } from '@/lib/api/browser-client'
import type { AnalysisInput, AnalysisPeriod, PeriodInput, TradingCalendar } from './scenario-types'
import { normalizeScenarioSeries } from './scenario-inputs'
export type LoadScenarioArgs = { symbol: string; asOf: string; calendar: TradingCalendar | null; client: Pick<BrowserMarketClient, 'series'>; signal?: AbortSignal; clock?: () => string; periods?: AnalysisPeriod[] }
export async function loadScenarioPeriod(args: LoadScenarioArgs, period: AnalysisPeriod): Promise<PeriodInput> {
  const series = await args.client.series(args.symbol, period, args.signal)
  if (args.signal?.aborted) throw new Error('行情请求已取消')
  if (series.symbol !== args.symbol || series.period !== period) throw new Error('返回行情与当前股票或周期不匹配')
  return normalizeScenarioSeries(series, args.asOf)
}
export async function loadScenarioInputs(args: LoadScenarioArgs): Promise<AnalysisInput> {
  const periods = args.periods ?? ['day']
  const results = await Promise.allSettled(periods.map(period => args.client.series(args.symbol, period, args.signal)))
  const asOf = args.clock?.() ?? args.asOf
  const input: AnalysisInput = { symbol: args.symbol, asOf, sourceMode: 'real', calendar: args.calendar, periods: {}, loadIssues: {} }
  results.forEach((result, index) => {
    const period = periods[index]
    if (result.status === 'fulfilled') {
      try {
        if (args.signal?.aborted) throw new Error('行情请求已取消')
        if (result.value.symbol !== args.symbol || result.value.period !== period) throw new Error('返回行情与当前股票或周期不匹配')
        input.periods[period] = normalizeScenarioSeries(result.value, asOf)
        if (!input.periods[period]!.closed.length) input.loadIssues[period] = ['没有已结束的有效K线']
      } catch (error) { input.loadIssues[period] = [error instanceof Error ? error.message : '行情校验失败'] }
    } else input.loadIssues[period] = [result.reason instanceof Error ? result.reason.message : '该周期行情暂不可用']
  })
  return input
}
