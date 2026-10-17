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

export type MarketClient = Pick<BrowserMarketClient, 'snapshot' | 'publishedRules'> & Partial<Pick<BrowserMarketClient, 'prediction' | 'cachedSnapshot'>>

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
  loadPrediction?: boolean
}

export function StockWorkspaceProvider({ children, client = browserMarketClient, initialSymbol, loadPrediction = true }: ProviderProps) {
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
  const recent = useRef(new Map<string, StockWorkspaceSnapshot>())

  const load = useCallback(async (symbol: string, security: Security, nextCycle: OperationCycle, preserving: boolean) => {
    const savedMarket = !preserving ? client.cachedSnapshot?.(symbol) : null
    if (savedMarket) {
      const saved: StockWorkspaceSnapshot = { symbol, security: savedMarket.quote.security, market: savedMarket,
        analysis: analyzeMarketSnapshot(savedMarket, nextCycle, []), cycle: nextCycle, generatedAt: savedMarket.source.fetchedAt,
        prediction: null, publishedRules: [], rulesStatus: 'loading' }
      setCurrent(saved); setLastSuccessful(saved)
      preserving = true
    }
    const version = ++requestVersion.current
    abortController.current?.abort()
    const controller = new AbortController()
    abortController.current = controller
    let publishedSnapshot: StockWorkspaceSnapshot | null = null
    let resolvedPrediction: StockWorkspaceSnapshot['prediction'] = null
    setStatus(preserving ? 'refreshing' : 'loading')
    setErrorMessage(null)
    setPredictionStatus(client.prediction && loadPrediction ? 'loading' : 'idle')
    setPredictionError(null)
    if (!preserving) setCurrent(null)
    if (client.prediction && loadPrediction) {
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
      const rulesPromise = client.publishedRules ? client.publishedRules(controller.signal).then((rules) => ({ rules, status: 'ready' as const })).catch(() => ({ rules: [], status: 'error' as const })) : Promise.resolve({ rules: [], status: 'ready' as const })
      const market = await client.snapshot(symbol, controller.signal)
      const rules = preserving ? recent.current.get(symbol)?.publishedRules ?? [] : []
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
        rulesStatus: client.publishedRules ? 'loading' : 'ready',
      }
      publishedSnapshot = snapshot
      setCurrent(snapshot)
      setLastSuccessful(snapshot)
      setStatus(market.source?.online === false ? 'offline' : 'ready')
      recent.current.set(symbol, snapshot)
      if (recent.current.size > 20) recent.current.delete(recent.current.keys().next().value!)
      void rulesPromise.then(result => {
        if (controller.signal.aborted || version !== requestVersion.current) return
        const enriched = { ...publishedSnapshot!, publishedRules: result.rules, rulesStatus: result.status, analysis: analyzeMarketSnapshot(market, nextCycle, result.rules) }
        publishedSnapshot = enriched
        recent.current.set(symbol, enriched)
        setCurrent(enriched); setLastSuccessful(enriched)
      })
    } catch (error) {
      if (version !== requestVersion.current) return
      if (controller.signal.aborted) return
      setErrorMessage(error instanceof Error ? error.message : '行情加载失败')
      setStatus(preserving ? 'stale' : 'error')
    }
  }, [client, loadPrediction])

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
    const cached = recent.current.get(symbol)
    setCurrent(cached ?? null)
    setLastSuccessful(cached ?? null)
    await load(symbol, resolvedSecurity, cycle, Boolean(cached))
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
