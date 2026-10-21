'use client'

import { useEffect, useMemo, useState } from 'react'
import type { BrowserMarketClient } from '@/lib/api/browser-client'
import { useScenarioInputs } from '../scenario/use-scenario-inputs'
import { scenarioCalendar } from '../scenario/scenario-calendar-data'
import { adaptivePeriodPlan } from '../scenario/scenario-period-policy'
import { ANALYSIS_PERIODS } from '../scenario/scenario-calendar'
import { buildScenarioAnalysis } from '../scenario/scenario-engine'
import { parseScenarioLedger, SCENARIO_STORAGE_KEY } from '../scenario/scenario-ledger'
import type { AnalysisAnnotations, Horizon } from '../scenario/scenario-types'
import { resolveDailyPriceLimit } from '../scenario/scenario-price-ladder'

export const FORECAST_HORIZONS: Horizon[] = [1, 2, 3, 4]

/** Calculation never creates an artificial human confirmation or saves a record. */
export function useAutomaticForecast({ symbol, sourceMode, client, name }: {
  symbol: string; sourceMode: 'real' | 'demo'; client: Pick<BrowserMarketClient, 'series'>; name?: string
}) {
  const loader = useScenarioInputs({ symbol, sourceMode, client, calendar: scenarioCalendar })
  const [saved, setSaved] = useState<{ owner: string; annotations: AnalysisAnnotations } | null>(null)
  const owner = symbol + ':' + sourceMode
  useEffect(() => {
    let active = true
    const readSaved = () => {
      try {
        const records = parseScenarioLedger(localStorage.getItem(SCENARIO_STORAGE_KEY))
        const latest = records.filter(r => r.input.symbol === symbol && r.input.sourceMode === sourceMode && r.kind === 'live')
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
        if (active) setSaved({ owner, annotations: latest?.annotations ?? {} })
      } catch { if (active) setSaved({ owner, annotations: {} }) }
    }
    queueMicrotask(readSaved)
    window.addEventListener('stockcal:scenario-saved', readSaved)
    return () => { active = false; window.removeEventListener('stockcal:scenario-saved', readSaved) }
  }, [owner, symbol, sourceMode])
  const annotations = useMemo(() => saved?.owner === owner ? saved.annotations : {}, [owner, saved])
  const plan = useMemo(() => loader.input ? adaptivePeriodPlan(loader.input, annotations) : null, [loader.input, annotations])
  const next = plan?.clearPeriod ? null : plan?.nextPeriod
  const loadPeriod = loader.loadPeriod
  useEffect(() => {
    if (!next || !saved || saved.owner !== owner || loader.status === 'loading') return
    let active = true
    queueMicrotask(() => { if (active) void loadPeriod(next) })
    return () => { active = false }
  }, [next, loadPeriod, loader.status, owner, saved])
  const result = useMemo(() => {
    if (!loader.input) return { analysis: null, error: null }
    try {
      const input = loader.input
      return { analysis: buildScenarioAnalysis(input, annotations, { id: 'automatic:' + owner, version: 1,
        createdAt: input.asOf, kind: 'live', registry: [], scenarios: [], horizons: FORECAST_HORIZONS,
        executionWindow: null, mergeSelection: { method: 'average_delta', scenarioIds: {} },
        priceSelection: { limit: resolveDailyPriceLimit(symbol, name) } }), error: null }
    } catch (error) { return { analysis: null, error: error instanceof Error ? error.message : '预测计算失败' } }
  }, [loader.input, annotations, owner, symbol, name])
  const periods = ANALYSIS_PERIODS.filter(p => result.analysis?.input.periods[p])
  return { ...result, periods, loading: loader.status === 'loading' || !!next, issues: loader.issues,
    clearPeriod: plan?.clearPeriod ?? null, refresh: loader.refresh }
}

export type AutomaticForecast = ReturnType<typeof useAutomaticForecast>
