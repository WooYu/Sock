'use client'

import { useMemo, useSyncExternalStore } from 'react'
import type { ChartPeriod, ChartWorkspaceV2, DrawingObject, DrawingStyle, TimePricePoint } from './chart-types'
import { DrawingEngine, type DrawingMove } from './drawing-engine'
import { deserializeChartWorkspace, serializeChartWorkspace } from './chart-workspace-state'
import { chartWorkspaceChangedEvent, enqueueChartWorkspace, hasChartSyncRecovery, loadChartSyncCursor, loadChartSyncQueue, loadChartWorkspace, pullChartWorkspace, replayChartSyncQueue, saveChartWorkspace } from './chart-workspace-sync'

export type ChartSyncStatus = '本机保存' | '同步中' | '已同步' | '待同步' | '离线'
type WorkspaceState = { workspace: ChartWorkspaceV2; selectedId: string | null; syncStatus: ChartSyncStatus }
type Update<T> = T | ((current: T) => T)
const resolve = <T,>(update: Update<T>, current: T): T => typeof update === 'function' ? (update as (current: T) => T)(current) : update
const authorization = () => { const token = localStorage.getItem('stockcal.accessToken'); return token ? `Bearer ${token}` : undefined }
function clientId() {
  const key = 'stockcal:sync-client-id'
  const existing = localStorage.getItem(key)
  if (existing) return existing
  const id = crypto.randomUUID()
  localStorage.setItem(key, id)
  return id
}

function emptyWorkspace(symbol: string, period: ChartPeriod): ChartWorkspaceV2 {
  return { version: 2, symbol, period, drawings: [], deletions: [], recovery: [], indicators: { ma5: true, ma10: true, ma20: true, boll: true }, indicatorConfig: {}, layers: { keyLevels: true, annotations: true, prediction: true }, view: { zoom: 100, panX: 0, panY: 0 }, crosshair: false, updatedAt: '1970-01-01T00:00:00.000Z', revision: 0 }
}

/** A per-entity external store keeps hydration and persistence out of render effects.
 * Only commands write; selection, market refreshes and pointer previews cannot save.
 */
class ChartWorkspaceController {
  private engine = new DrawingEngine()
  private state: WorkspaceState
  private readonly serverState: WorkspaceState
  private listeners = new Set<() => void>()
  private timer: ReturnType<typeof setTimeout> | undefined
  private saving = false

  constructor(private readonly symbol: string, private readonly period: ChartPeriod) {
    this.state = { workspace: emptyWorkspace(symbol, period), selectedId: null, syncStatus: '本机保存' }
    this.serverState = this.state
  }

  getSnapshot = () => this.state
  getServerSnapshot = () => this.serverState

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    if (this.listeners.size === 1) {
      this.refresh()
      this.setStatus(this.idleStatus())
      window.addEventListener(chartWorkspaceChangedEvent, this.onStored)
      window.addEventListener('storage', this.onStored)
      window.addEventListener('online', this.onOnline)
      window.addEventListener('offline', this.onOffline)
      if (this.symbol && navigator.onLine && authorization()) {
        void this.pull()
        this.schedule()
      }
    }
    return () => {
      this.listeners.delete(listener)
      if (!this.listeners.size) {
        clearTimeout(this.timer)
        window.removeEventListener(chartWorkspaceChangedEvent, this.onStored)
        window.removeEventListener('storage', this.onStored)
        window.removeEventListener('online', this.onOnline)
        window.removeEventListener('offline', this.onOffline)
      }
    }
  }

  private publish(patch: Partial<WorkspaceState>) {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
  }

  private setStatus(syncStatus: ChartSyncStatus) {
    if (syncStatus !== this.state.syncStatus) this.publish({ syncStatus })
  }

  private idleStatus(): ChartSyncStatus {
    const pending = loadChartSyncQueue().length
    if (!navigator.onLine) return '离线'
    if (hasChartSyncRecovery()) return '待同步'
    if (!authorization()) return '本机保存'
    return pending ? '待同步' : '已同步'
  }

  private refresh() {
    if (!this.symbol || this.saving) return
    const saved = loadChartWorkspace(this.symbol, this.period)
    if (!saved || serializeChartWorkspace(saved) === serializeChartWorkspace(this.state.workspace)) return
    const byId = (a: { id: string }, b: { id: string }) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    const drawingContent = (value: ChartWorkspaceV2) => JSON.stringify({ drawings: [...value.drawings].sort(byId), deletions: [...(value.deletions ?? [])].sort(byId) })
    if (drawingContent(saved) !== drawingContent(this.state.workspace)) {
      this.engine = new DrawingEngine(saved.drawings, saved.deletions)
      this.engine.select(this.state.selectedId)
    }
    this.publish({ workspace: saved, selectedId: this.engine.currentSelectedId() })
  }

  private onStored = () => {
    this.refresh()
    if (this.state.syncStatus !== '同步中') this.setStatus(this.idleStatus())
  }
  private onOffline = () => { clearTimeout(this.timer); this.setStatus('离线') }
  private onOnline = () => { void this.flush(); void this.pull() }

  private async pull() {
    const auth = authorization()
    if (!auth || !navigator.onLine || !this.symbol) return
    try {
      await pullChartWorkspace(loadChartSyncCursor(), clientId(), auth)
      this.refresh()
    } catch {
      this.setStatus(navigator.onLine ? '待同步' : '离线')
    }
  }

  private schedule() {
    clearTimeout(this.timer)
    if (navigator.onLine && authorization()) this.timer = setTimeout(() => { void this.flush() }, 350)
  }

  flush = async (): Promise<void> => {
    clearTimeout(this.timer)
    const auth = authorization()
    if (!navigator.onLine || !auth) { this.setStatus(this.idleStatus()); return }
    if (!loadChartSyncQueue().length) { this.setStatus(this.idleStatus()); return }
    this.setStatus('同步中')
    try {
      await replayChartSyncQueue(clientId(), auth)
      this.refresh()
      this.setStatus(this.idleStatus())
    } catch {
      this.setStatus(navigator.onLine ? '待同步' : '离线')
    }
  }

  private persist(workspace: ChartWorkspaceV2) {
    if (!this.symbol) return
    if (serializeChartWorkspace(workspace) === serializeChartWorkspace(this.state.workspace)) return
    const previous = loadChartWorkspace(this.symbol, this.period)
    const outgoing = deserializeChartWorkspace(serializeChartWorkspace({ ...workspace, revision: Math.max(workspace.revision, previous?.revision ?? 0) + 1, updatedAt: new Date().toISOString() }))!
    // Queue first: this is the durable write-ahead copy if the local snapshot write fails.
    enqueueChartWorkspace(outgoing)
    this.saving = true
    try { saveChartWorkspace(outgoing) } finally { this.saving = false }
    this.publish({ workspace: outgoing, selectedId: this.engine.currentSelectedId(), syncStatus: this.idleStatus() })
    this.schedule()
  }

  private drawingCommand(command: () => void) {
    command()
    this.persist({ ...this.state.workspace, drawings: this.engine.current(), deletions: this.engine.currentDeletions() })
    if (this.state.selectedId !== this.engine.currentSelectedId()) this.publish({ selectedId: this.engine.currentSelectedId() })
  }

  commands = {
    select: (id: string | null) => { this.engine.select(id); this.publish({ selectedId: this.engine.currentSelectedId() }) },
    create: (drawing: DrawingObject) => this.drawingCommand(() => this.engine.create(drawing)),
    copy: (sourceId: string, newId: string) => this.drawingCommand(() => this.engine.copy(sourceId, newId)),
    move: (delta: DrawingMove) => this.drawingCommand(() => this.engine.move(delta)),
    movePoint: (index: number, point: TimePricePoint) => this.drawingCommand(() => this.engine.movePoint(index, point)),
    updateStyle: (patch: Partial<DrawingStyle>) => this.drawingCommand(() => this.engine.updateStyle(patch)),
    updateText: (text: string | undefined) => this.drawingCommand(() => this.engine.updateText(text)),
    setVisible: (visible: boolean) => this.drawingCommand(() => this.engine.setVisible(visible)),
    setLocked: (locked: boolean) => this.drawingCommand(() => this.engine.setLocked(locked)),
    remove: (id?: string | null) => this.drawingCommand(() => this.engine.remove(id)),
    undo: () => this.drawingCommand(() => this.engine.undo()),
    redo: () => this.drawingCommand(() => this.engine.redo()),
    setIndicators: (update: Update<ChartWorkspaceV2['indicators']>) => this.persist({ ...this.state.workspace, indicators: resolve(update, this.state.workspace.indicators) }),
    setIndicatorConfig: (update: Update<ChartWorkspaceV2['indicatorConfig']>) => this.persist({ ...this.state.workspace, indicatorConfig: resolve(update, this.state.workspace.indicatorConfig) }),
    setLayers: (update: Update<ChartWorkspaceV2['layers']>) => this.persist({ ...this.state.workspace, layers: resolve(update, this.state.workspace.layers) }),
    setView: (update: Update<ChartWorkspaceV2['view']>) => this.persist({ ...this.state.workspace, view: resolve(update, this.state.workspace.view) }),
    setCrosshair: (update: Update<boolean>) => this.persist({ ...this.state.workspace, crosshair: resolve(update, this.state.workspace.crosshair) }),
  }
}

export function useChartWorkspace({ symbol, period }: { symbol: string; period: ChartPeriod }) {
  const controller = useMemo(() => new ChartWorkspaceController(symbol, period), [symbol, period])
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getServerSnapshot)
  return { ...state, drawings: state.workspace.drawings, commands: controller.commands, flush: controller.flush }
}
