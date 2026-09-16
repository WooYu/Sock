'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { browserMarketClient, type BrowserMarketClient } from '@/lib/api/browser-client'
import { analyzeMarketSnapshot } from '../analysis/analysis-engine'
import type {
  MarketSnapshot,
  OperationCycle,
  Security,
  StockWorkspaceSnapshot,
  WorkspaceStatus,
} from './stock-workspace-types'

export type MarketClient = Pick<BrowserMarketClient, 'snapshot' | 'publishedRules'> & Partial<Pick<BrowserMarketClient, 'prediction'>>

type WorkspaceContextValue = {
  predictionStatus: 'idle' | 'loading' | 'ready' | 'error'
  predictionError: string | null
  selectedSymbol: string | null
  selectedSecurity: Security | null
  cycle: OperationCycle
  current: StockWorkspaceSnapshot | null
  lastSuccessful: StockWorkspaceSnapshot | null
  status: WorkspaceStatus
  errorMessage: string | null
  searchResults: Security[]
  search: (query: string) => Promise<void>
  selectStock: (symbol: string, security?: Security) => Promise<void>
  setCycle: (cycle: OperationCycle) => Promise<void>
  refresh: () => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

type ProviderProps = {
  children: React.ReactNode
  client?: MarketClient
  initialSymbol?: string
}

export function StockWorkspaceProvider({ children, client = browserMarketClient, initialSymbol }: ProviderProps) {
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(initialSymbol ?? null)
  const [selectedSecurity, setSelectedSecurity] = useState<Security | null>(initialSymbol ? { code: initialSymbol, name: initialSymbol } : null)
  const [cycle, setCycleState] = useState<OperationCycle>('short')
  const [current, setCurrent] = useState<StockWorkspaceSnapshot | null>(null)
  const [lastSuccessful, setLastSuccessful] = useState<StockWorkspaceSnapshot | null>(null)
  const [status, setStatus] = useState<WorkspaceStatus>(initialSymbol ? 'loading' : 'idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<Security[]>([])
  const [predictionStatus, setPredictionStatus] = useState<WorkspaceContextValue['predictionStatus']>('idle')
  const [predictionError, setPredictionError] = useState<string | null>(null)
  const requestVersion = useRef(0)
  const abortController = useRef<AbortController | null>(null)
  const initialLoadSymbol = useRef<string | null>(null)

  const load = useCallback(async (symbol: string, security: Security, nextCycle: OperationCycle, preserving: boolean) => {
    const version = ++requestVersion.current
    abortController.current?.abort()
    const controller = new AbortController()
    abortController.current = controller
    let publishedSnapshot: StockWorkspaceSnapshot | null = null
    let resolvedPrediction: StockWorkspaceSnapshot['prediction'] = null
    setStatus(preserving ? 'refreshing' : 'loading')
    setErrorMessage(null)
    setPredictionStatus(client.prediction ? 'loading' : 'idle')
    setPredictionError(null)
    if (!preserving) setCurrent(null)
    if (client.prediction) {
      void Promise.resolve()
        .then(() => client.prediction?.(symbol, controller.signal))
        .then((prediction) => {
          if (!prediction || version !== requestVersion.current || controller.signal.aborted) return
          resolvedPrediction = prediction
          setPredictionStatus('ready')
          if (!publishedSnapshot) return
          const previousSnapshot = publishedSnapshot
          const enrichedSnapshot = { ...previousSnapshot, prediction }
          publishedSnapshot = enrichedSnapshot
          setCurrent((snapshot) => snapshot === previousSnapshot ? enrichedSnapshot : snapshot)
          setLastSuccessful((snapshot) => snapshot === previousSnapshot ? enrichedSnapshot : snapshot)
        })
        .catch((error) => {
          if (version !== requestVersion.current || controller.signal.aborted) return
          setPredictionStatus('error')
          setPredictionError(error instanceof Error ? error.message : '预测暂不可用')
        })
    }
    try {
      const [market, ruleResult] = await Promise.all([
        client.snapshot(symbol, controller.signal),
        client.publishedRules ? client.publishedRules(controller.signal).then((rules) => ({ rules, status: 'ready' as const })).catch(() => ({ rules: [], status: 'error' as const })) : Promise.resolve({ rules: [], status: 'ready' as const }),
      ])
      const rules = ruleResult.rules
      if (version !== requestVersion.current) return
      const snapshot: StockWorkspaceSnapshot = {
        symbol,
        security: market.quote?.security ?? security,
        market,
        analysis: analyzeMarketSnapshot(market, nextCycle, rules),
        cycle: nextCycle,
        generatedAt: new Date().toISOString(),
        prediction: resolvedPrediction,
        publishedRules: rules,
        rulesStatus: ruleResult.status,
      }
      publishedSnapshot = snapshot
      setCurrent(snapshot)
      setLastSuccessful(snapshot)
      setStatus(market.source?.online === false ? 'offline' : 'ready')
    } catch (error) {
      if (version !== requestVersion.current) return
      if (controller.signal.aborted) return
      setErrorMessage(error instanceof Error ? error.message : '行情加载失败')
      setStatus(preserving && lastSuccessful ? 'stale' : 'error')
    }
  }, [client, lastSuccessful])

  const search = useCallback(async (query: string) => {
    if (!('search' in client)) return
    setStatus('searching')
    try {
      const results = await (client as BrowserMarketClient).search(query)
      setSearchResults(results)
      setStatus(current ? 'ready' : 'idle')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '搜索失败')
      setStatus('error')
    }
  }, [client, current])

  const selectStock = useCallback(async (symbol: string, security?: Security) => {
    const resolvedSecurity = security ?? { code: symbol, name: symbol }
    setSelectedSymbol(symbol)
    setSelectedSecurity(resolvedSecurity)
    setCurrent(null)
    setLastSuccessful(null)
    await load(symbol, resolvedSecurity, cycle, false)
  }, [cycle, load])

  const setCycle = useCallback(async (nextCycle: OperationCycle) => {
    setCycleState(nextCycle)
    if (selectedSymbol && selectedSecurity) await load(selectedSymbol, selectedSecurity, nextCycle, Boolean(lastSuccessful))
  }, [lastSuccessful, load, selectedSecurity, selectedSymbol])

  const refresh = useCallback(async () => {
    if (selectedSymbol && selectedSecurity) await load(selectedSymbol, selectedSecurity, cycle, Boolean(lastSuccessful))
  }, [cycle, lastSuccessful, load, selectedSecurity, selectedSymbol])

  useEffect(() => {
    if (!initialSymbol || initialLoadSymbol.current === initialSymbol) return
    initialLoadSymbol.current = initialSymbol
    const security = { code: initialSymbol, name: initialSymbol }
    setSelectedSymbol(initialSymbol)
    setSelectedSecurity(security)
    void load(initialSymbol, security, cycle, false)
  }, [cycle, initialSymbol, load])

  useEffect(() => () => {
    initialLoadSymbol.current = null
    requestVersion.current += 1
    abortController.current?.abort()
  }, [])

  const value = useMemo<WorkspaceContextValue>(() => ({
    predictionStatus,
    predictionError,
    selectedSymbol,
    selectedSecurity,
    cycle,
    current,
    lastSuccessful,
    status,
    errorMessage,
    searchResults,
    search,
    selectStock,
    setCycle,
    refresh,
  }), [current, cycle, errorMessage, lastSuccessful, predictionStatus, predictionError, refresh, search, searchResults, selectStock, selectedSecurity, selectedSymbol, setCycle, status])

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useStockWorkspace() {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('useStockWorkspace 必须在 StockWorkspaceProvider 内使用')
  return value
}

export type { MarketSnapshot }
