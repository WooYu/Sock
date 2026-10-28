'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { AnalysisInput, AnalysisPeriod } from './scenario-types'
import { ANALYSIS_PERIODS } from './scenario-calendar'
import type { LoadScenarioArgs } from './scenario-loader'
import { loadScenarioInputs } from './scenario-loader'
export type ScenarioInputArgs = Omit<LoadScenarioArgs, 'asOf' | 'signal' | 'periods' | 'clock'> & { sourceMode: AnalysisInput['sourceMode']; clock?: () => string; enabled?: boolean }
export type ScenarioInputState = { input: AnalysisInput | null; loadedAt: string | null; status: 'idle' | 'loading' | 'ready' | 'partial' | 'error'; issues: string[]; refresh: () => Promise<void>; loadPeriod: (period: AnalysisPeriod) => Promise<void>; retainThrough: (period: AnalysisPeriod) => void }
const defaultClock = () => new Date().toISOString()
function classify(input: AnalysisInput, requested: number): ScenarioInputState['status'] {
  const usable = Object.values(input.periods).filter(p => p.closed.length).length
  return !usable ? 'error' : usable < requested || Object.keys(input.loadIssues).length ? 'partial' : 'ready'
}
function loadMessages(input: AnalysisInput): string[] {
  return Object.entries(input.loadIssues).flatMap(([period, issues]) => issues.map(issue => period + '：' + issue))
}
export function useScenarioInputs({ symbol, calendar, client, sourceMode, clock, enabled = true }: ScenarioInputArgs): ScenarioInputState {
  const owner = symbol + ':' + sourceMode
  const [state, setState] = useState<{ owner: string; input: AnalysisInput | null; loadedAt: string | null; status: ScenarioInputState['status']; issues: string[] }>({
    owner: '', input: null, loadedAt: null, status: 'idle', issues: [],
  })
  const generation = useRef(0), controller = useRef<AbortController | null>(null)
  const currentInput = useRef<AnalysisInput | null>(null), requestedPeriods = useRef<AnalysisPeriod[]>(['day']), previousOwner = useRef('')
  const refresh = useCallback(async () => {
    if (!enabled) return
    // Keep an absent clock absent in the dependency list. Production optimizers may
    // inline a default arrow parameter, recreating it on every render.
    const readClock = clock ?? defaultClock
    controller.current?.abort()
    const control = new AbortController()
    controller.current = control
    const token = ++generation.current
    setState(old => ({ owner, input: old.owner === owner ? old.input : null, loadedAt: old.loadedAt, status: 'loading', issues: [] }))
    const before = currentInput.current
    const args = { symbol, asOf: readClock(), clock: readClock, calendar, client, signal: control.signal,
      periods: [...requestedPeriods.current] }
    try {
      const input = await loadScenarioInputs({ ...args, periods: [...args.periods] })
      if (control.signal.aborted || token !== generation.current) return
      for (const period of args.periods) {
        if (!input.periods[period] && before?.symbol === symbol && before.sourceMode === sourceMode && before.periods[period]) {
          input.periods[period] = { ...before.periods[period]!, asOf: input.asOf,
            source: { ...before.periods[period]!.source, online: false, state: 'CACHED' } }
        }
      }
      input.sourceMode = sourceMode
      currentInput.current = input
      setState({ owner, input, loadedAt: readClock(), status: classify(input, args.periods.length), issues: loadMessages(input) })
    } catch (error) {
      if (control.signal.aborted || token !== generation.current) return
      setState({ owner, input: null, loadedAt: null, status: 'error', issues: [error instanceof Error ? error.message : '分析行情暂不可用'] })
    }
  }, [owner, symbol, calendar, client, sourceMode, clock, enabled])
  const loadPeriod = useCallback(async (period: AnalysisPeriod) => {
    const base = currentInput.current
    if (!base || base.symbol !== symbol || base.sourceMode !== sourceMode) return
    const index = ANALYSIS_PERIODS.indexOf(period)
    if (index < 0 || index > requestedPeriods.current.length) throw new Error('请逐级读取分析周期')
    requestedPeriods.current = ANALYSIS_PERIODS.slice(0, Math.max(index + 1, requestedPeriods.current.length))
    await refresh()
  }, [symbol, sourceMode, refresh])
  const retainThrough = useCallback((period: AnalysisPeriod) => {
    const maximum = ANALYSIS_PERIODS.indexOf(period)
    if (requestedPeriods.current.length <= maximum + 1) return
    requestedPeriods.current = requestedPeriods.current.slice(0, maximum + 1)
    controller.current?.abort(); generation.current++
    const base = currentInput.current
    if (!base || base.symbol !== symbol || base.sourceMode !== sourceMode) return
    const keep = new Set(requestedPeriods.current)
    const input = { ...base, periods: Object.fromEntries(Object.entries(base.periods).filter(([p]) => keep.has(p as AnalysisPeriod))),
      loadIssues: Object.fromEntries(Object.entries(base.loadIssues).filter(([p]) => keep.has(p as AnalysisPeriod))) }
    currentInput.current = input
    setState(old => ({ ...old, input, status: classify(input, requestedPeriods.current.length), issues: loadMessages(input) }))
  }, [symbol, sourceMode])
  useEffect(() => {
    let active = true
    if (previousOwner.current !== owner) { requestedPeriods.current = ['day']; currentInput.current = null; previousOwner.current = owner }
    queueMicrotask(() => { if (active) void refresh() })
    return () => { active = false; controller.current?.abort() }
  }, [owner, refresh])
  const visible = !enabled ? { input: null, loadedAt: null, status: 'idle' as const, issues: [] } : state.owner === owner ? state : { input: null, loadedAt: null, status: 'loading' as const, issues: [] }
  return { ...visible, refresh, loadPeriod, retainThrough }
}
