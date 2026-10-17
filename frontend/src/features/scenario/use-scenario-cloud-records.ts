'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ScenarioAnalysis } from './scenario-types'
import type { EvaluationView, ForecastRecord, NoteBindingInput, PriceEvaluation } from './scenario-record-types'
import { evaluationViewFromHistory, evaluateForecast, getEvaluationHistory, getForecastRecord, saveForecast } from './scenario-api'
import { getResearchIdentity, RESEARCH_IDENTITY_EVENT, type ResearchIdentity } from './research-identity'
import { buildResearchExport } from './scenario-research-export'

export const CLOUD_RECORDS_STORAGE_KEY = 'stockcal.scenario-cloud.v1'
export const cloudRecordKey = (record: Pick<ScenarioAnalysis, 'id' | 'version'>) => `${record.id}@${record.version}`
type Receipt = Pick<ForecastRecord, 'id' | 'serverReceivedAt' | 'payloadHash' | 'clientRecordId' | 'clientVersion'>
type CloudEntry = { symbol: string; status: 'local' | 'pending' | 'stored' | 'retry'; noteBindings: NoteBindingInput[]; receipt?: Receipt; error?: string }
type Details = { record: ForecastRecord; view: EvaluationView; history: PriceEvaluation[] }
type Ledger = { schemaVersion: 1; scopes: Record<string, Record<string, CloudEntry>> }
function readLedger(): Ledger {
  const raw = localStorage.getItem(CLOUD_RECORDS_STORAGE_KEY)
  if (!raw) return { schemaVersion: 1, scopes: {} }
  const value = JSON.parse(raw) as Ledger
  if (value?.schemaVersion !== 1 || !value.scopes || typeof value.scopes !== 'object' || Array.isArray(value.scopes)) throw new Error('云端回执格式损坏，原值已保留')
  for (const entries of Object.values(value.scopes)) for (const entry of Object.values(entries)) {
    if (!entry || !['local', 'pending', 'stored', 'retry'].includes(entry.status) || !Array.isArray(entry.noteBindings) || typeof entry.symbol !== 'string'
      || (entry.status === 'stored' && (!entry.receipt?.id || !Number.isFinite(Date.parse(entry.receipt.serverReceivedAt))))) throw new Error('云端回执格式损坏，原值已保留')
  }
  return value
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (value && typeof value === 'object') return '{' + Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => JSON.stringify(k) + ':' + canonical(v)).join(',') + '}'
  return JSON.stringify(value)
}
function validReceipt(record: ForecastRecord, snapshot: ScenarioAnalysis) {
  return record && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(record.id) && Number.isFinite(Date.parse(record.serverReceivedAt))
    && /^[a-f0-9]{64}$/.test(record.payloadHash) && record.clientRecordId === snapshot.id && record.clientVersion === snapshot.version
    && record.symbol === snapshot.input.symbol && canonical(record.snapshot) === canonical(snapshot)
}
export function useScenarioCloudRecords({ symbol, localRecords }: { symbol: string; localRecords: ScenarioAnalysis[] }) {
  const [entries, setEntries] = useState<Record<string, CloudEntry>>({}), [details, setDetails] = useState<Record<string, Details>>({})
  const [ready, setReady] = useState(false), [error, setError] = useState(''), [loading, setLoading] = useState(false)
  const [identityScope, setIdentityScope] = useState('')
  const identity = useRef<ResearchIdentity | null>(null), epoch = useRef(0), mounted = useRef(false)
  const entriesRef = useRef(entries), recordsRef = useRef(localRecords)
  const inFlight = useRef(new Map<string, Promise<void>>()), controllers = useRef(new Set<AbortController>())
  useEffect(() => { recordsRef.current = localRecords }, [localRecords])
  useEffect(() => {
    mounted.current = true
    const pendingControllers = controllers.current
    const invalidate = () => { epoch.current++ }
    const reload = async () => {
      const current = ++epoch.current
      controllers.current.forEach(c => c.abort()); controllers.current.clear()
      identity.current = null; entriesRef.current = {}; setEntries({}); setDetails({}); setReady(false); setLoading(false); setIdentityScope('')
      try {
        const next = await getResearchIdentity()
        if (!mounted.current || current !== epoch.current || !next.isCurrent()) return
        identity.current = next
        setIdentityScope(next.scope)
        const stored = readLedger().scopes[next.scope] ?? {}
        const restored = Object.fromEntries(Object.entries(stored).map(([key, entry]) => [key, entry.status === 'pending' ? { ...entry, status: 'retry' as const, error: '上次请求尚未确认，请重试原版本' } : entry]))
        entriesRef.current = restored; setEntries(restored); setError(''); setReady(true)
      } catch (cause) { if (mounted.current && current === epoch.current) { setError(cause instanceof Error ? cause.message : '回执不可读取'); setReady(true) } }
    }
    queueMicrotask(() => { if (mounted.current) void reload() })
    const onStorage = (e: StorageEvent) => { if (e.key === 'stockcal.accessToken' || e.key === 'stockcal:sync-client-id' || e.key === null) void reload() }
    const onIdentity = () => { void reload() }
    window.addEventListener('storage', onStorage); window.addEventListener(RESEARCH_IDENTITY_EVENT, onIdentity)
    return () => { mounted.current = false; invalidate(); pendingControllers.forEach(c => c.abort()); window.removeEventListener('storage', onStorage); window.removeEventListener(RESEARCH_IDENTITY_EVENT, onIdentity) }
  }, [symbol])
  const active = useCallback((owner: ResearchIdentity, generation: number) => mounted.current && generation === epoch.current && identity.current?.scope === owner.scope && owner.isCurrent(), [])
  const write = useCallback((owner: ResearchIdentity, generation: number, key: string, entry: CloudEntry) => {
    if (!active(owner, generation)) return
    const next = { ...entriesRef.current, [key]: entry }; entriesRef.current = next; setEntries(next)
    try { const ledger = readLedger(); ledger.scopes[owner.scope] = { ...(ledger.scopes[owner.scope] ?? {}), [key]: entry }; localStorage.setItem(CLOUD_RECORDS_STORAGE_KEY, JSON.stringify(ledger)) }
    catch { setError('浏览器回执未能保存，已有原始记录仍保留；云端以服务器确认为准') }
  }, [active])
  const saveFrozen = useCallback(async (snapshot: ScenarioAnalysis, noteBindings: NoteBindingInput[]): Promise<void> => {
    const owner = identity.current, generation = epoch.current
    if (!owner || !owner.isCurrent() || snapshot.input.symbol !== symbol) { setError('身份或股票已变化，请重新读取后重试'); return }
    const key = cloudRecordKey(snapshot), requestKey = owner.scope + ':' + key
    const existing = inFlight.current.get(requestKey); if (existing) return existing
    const frozen = structuredClone({ snapshot, noteBindings })
    const controller = new AbortController(); controllers.current.add(controller)
    const operation = (async () => {
      write(owner, generation, key, { symbol, status: 'pending', noteBindings: frozen.noteBindings })
      try {
        const receipt = await saveForecast(frozen, controller.signal)
        if (!validReceipt(receipt, frozen.snapshot)) throw new Error('服务器回执与冻结快照不一致，请重试核实')
        write(owner, generation, key, { symbol, status: 'stored', noteBindings: frozen.noteBindings,
          receipt: { id: receipt.id, serverReceivedAt: receipt.serverReceivedAt, payloadHash: receipt.payloadHash, clientRecordId: receipt.clientRecordId, clientVersion: receipt.clientVersion } })
      } catch (cause) {
        write(owner, generation, key, { symbol, status: 'retry', noteBindings: frozen.noteBindings, error: cause instanceof Error ? cause.message : '入库失败，请重试' })
      } finally { inFlight.current.delete(requestKey); controllers.current.delete(controller) }
    })()
    inFlight.current.set(requestKey, operation)
    return operation
  }, [symbol, write])
  const retry = useCallback(async (id: string, version: number) => {
    const snapshot = recordsRef.current.find(s => s.id === id && s.version === version && s.input.symbol === symbol)
    const entry = entriesRef.current[`${id}@${version}`]
    if (!snapshot || !entry) { setError('找不到原冻结版本，请保留并导出本地备份'); return }
    await saveFrozen(snapshot, entry.noteBindings)
  }, [symbol, saveFrozen])
  const loadDetails = useCallback(async (snapshot: ScenarioAnalysis, evaluate = false): Promise<Details | null> => {
    const owner = identity.current, generation = epoch.current, key = cloudRecordKey(snapshot), receipt = entriesRef.current[key]?.receipt
    if (!owner || !active(owner, generation) || !receipt || snapshot.input.symbol !== symbol) return null
    const controller = new AbortController(); controllers.current.add(controller); setLoading(true); setError('')
    try {
      if (evaluate) await evaluateForecast(receipt.id, controller.signal)
      const [record, history] = await Promise.all([getForecastRecord(receipt.id, controller.signal), getEvaluationHistory(receipt.id, controller.signal)])
      if (!active(owner, generation)) return null
      if (!validReceipt(record, snapshot) || history.some(e => e.forecastId !== record.id)) throw new Error('研究详情与冻结版本不一致')
      const value = { record, history, view: evaluationViewFromHistory(history) }
      setDetails(old => ({ ...old, [key]: value })); return value
    } catch (cause) { if (active(owner, generation)) setError(cause instanceof Error ? cause.message : '价格核对不可用'); return null }
    finally { controllers.current.delete(controller); if (active(owner, generation)) setLoading(false) }
  }, [active, symbol])
  const exportSaved = useCallback(async () => {
    const owner = identity.current, generation = epoch.current
    const exports = [], missing: string[] = []
    for (const snapshot of recordsRef.current.filter(r => r.input.symbol === symbol)) {
      const key = cloudRecordKey(snapshot)
      if (!entriesRef.current[key]?.receipt) { missing.push(key + ':local_only'); continue }
      const value = await loadDetails(snapshot)
      if (owner && !active(owner, generation)) throw new Error('身份已变化，已取消本次导出')
      if (value) exports.push(buildResearchExport(value.record, value.view, value.history))
      else missing.push(key + ':cloud_evidence_unavailable')
    }
    return { exports, missing }
  }, [active, loadDetails, symbol])
  return { ready, identityScope, entries: useMemo(() => Object.fromEntries(Object.entries(entries).filter(([, e]) => e.symbol === symbol)), [entries, symbol]), details,
    error, loading, saveFrozen, retry, loadDetails, exportSaved }
}
