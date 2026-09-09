import { act, renderHook } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useChartWorkspace } from './use-chart-workspace'
import { loadChartSyncQueue, loadChartWorkspace, saveChartWorkspace } from './chart-workspace-sync'
import { drawingFixture, workspaceFixture } from './chart-workspace-test-fixtures'

const ok = () => new Response(JSON.stringify({ applied: true, cursor: 1 }), { status: 200 })

describe('chart workspace command persistence', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(async (url) => String(url).includes('changes') ? new Response(JSON.stringify({ nextCursor: 0, changes: [] })) : ok()))
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  test('hydrates without saving and never persists selection or rerenders', () => {
    saveChartWorkspace(workspaceFixture({ drawings: [drawingFixture()] }))
    const saved = localStorage.getItem('stockcal:chart-workspace:600519:day')
    const { result, rerender } = renderHook(() => useChartWorkspace({ symbol: '600519', period: 'day' }), { wrapper: StrictMode })
    expect(result.current.drawings[0].id).toBe('line-1')
    expect(result.current.syncStatus).toBe('本机保存')
    act(() => result.current.commands.select('line-1'))
    rerender()
    expect(result.current.selectedId).toBe('line-1')
    expect(loadChartSyncQueue()).toEqual([])
    expect(localStorage.getItem('stockcal:chart-workspace:600519:day')).toBe(saved)
  })

  test('saves and enqueues every completed command immediately but debounces only network by350ms', async () => {
    const { result } = renderHook(() => useChartWorkspace({ symbol: '600519', period: 'day' }))
    localStorage.setItem('stockcal.accessToken', 'token')
    act(() => result.current.commands.create(drawingFixture({ version: 0 })))
    expect(loadChartWorkspace('600519', 'day')?.drawings).toHaveLength(1)
    expect(loadChartSyncQueue()).toHaveLength(1)
    expect(result.current.syncStatus).toBe('待同步')
    await act(() => vi.advanceTimersByTimeAsync(300))
    act(() => result.current.commands.updateText('updated'))
    expect(loadChartSyncQueue()).toHaveLength(2)
    await act(() => vi.advanceTimersByTimeAsync(349))
    expect(fetch).not.toHaveBeenCalled()
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(loadChartSyncQueue()).toEqual([])
    expect(result.current.syncStatus).toBe('已同步')
  })

  test('flush forces replay and reports syncing then success', async () => {
    const { result } = renderHook(() => useChartWorkspace({ symbol: '600519', period: 'day' }))
    localStorage.setItem('stockcal.accessToken', 'token')
    let finish!: (value: Response) => void
    vi.mocked(fetch).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    act(() => result.current.commands.create(drawingFixture()))
    let flushing!: Promise<void>
    act(() => { flushing = result.current.flush() })
    expect(result.current.syncStatus).toBe('同步中')
    await act(async () => { finish(ok()); await flushing })
    expect(result.current.syncStatus).toBe('已同步')
    expect(loadChartSyncQueue()).toEqual([])
  })

  test('retains failed work offline and retries when online returns', async () => {
    const { result } = renderHook(() => useChartWorkspace({ symbol: '600519', period: 'day' }))
    localStorage.setItem('stockcal.accessToken', 'token')
    act(() => result.current.commands.create(drawingFixture()))
    vi.mocked(fetch).mockRejectedValueOnce(new Error('unavailable'))
    await act(() => result.current.flush())
    expect(result.current.syncStatus).toBe('待同步')
    expect(loadChartSyncQueue()).toHaveLength(1)
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    act(() => window.dispatchEvent(new Event('offline')))
    expect(result.current.syncStatus).toBe('离线')
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    await act(async () => { window.dispatchEvent(new Event('online')); await vi.advanceTimersByTimeAsync(0) })
    expect(loadChartSyncQueue()).toEqual([])
    expect(result.current.syncStatus).toBe('已同步')
  })

  test('switching to empty period never copies drawings and pending commands survive unmount', async () => {
    const { result, rerender, unmount } = renderHook(({ period }: { period: 'day' | 'week' }) => useChartWorkspace({ symbol: '600519', period }), { initialProps: { period: 'day' } })
    act(() => result.current.commands.create(drawingFixture()))
    rerender({ period: 'week' })
    expect(result.current.drawings).toEqual([])
    expect(loadChartWorkspace('600519', 'week')).toBeNull()
    expect(loadChartWorkspace('600519', 'day')?.drawings).toHaveLength(1)
    unmount()
    expect(loadChartSyncQueue()).toHaveLength(1)
    localStorage.setItem('stockcal.accessToken', 'token')
    const next = renderHook(() => useChartWorkspace({ symbol: '600519', period: 'week' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(350) })
    expect(loadChartSyncQueue()).toEqual([])
    expect(next.result.current.drawings).toEqual([])
  })

  test('delete undo redo persists explicit tombstones and monotonic object versions', () => {
    const { result } = renderHook(() => useChartWorkspace({ symbol: '600519', period: 'day' }))
    act(() => result.current.commands.create(drawingFixture({ version: 0 })))
    act(() => result.current.commands.remove())
    const deleted = loadChartWorkspace('600519', 'day')!
    expect(deleted.drawings).toEqual([])
    expect(deleted.deletions).toEqual([{ id: 'line-1', version: 2, updatedAt: expect.any(String) }])
    act(() => result.current.commands.undo())
    const restored = loadChartWorkspace('600519', 'day')!
    expect(restored.drawings[0]).toMatchObject({ id: 'line-1', version: 3, restoredFromVersion: 2 })
    act(() => result.current.commands.redo())
    expect(loadChartWorkspace('600519', 'day')?.deletions?.[0].version).toBe(4)
    expect(loadChartSyncQueue().map((entry) => entry.workspace.revision)).toEqual([1, 2, 3, 4])
  })

  test('persists settings as commands with strictly increasing revisions in the same millisecond', () => {
    const { result } = renderHook(() => useChartWorkspace({ symbol: '600519', period: 'day' }))
    act(() => {
      result.current.commands.setView({ zoom: 130, panX: 4, panY: 2 })
      result.current.commands.setIndicators({ ma5: false })
      result.current.commands.setLayers({ annotations: false })
      result.current.commands.setCrosshair(true)
    })
    expect(loadChartWorkspace('600519', 'day')).toMatchObject({ revision: 4, view: { zoom: 130, panX: 4, panY: 2 }, indicators: { ma5: false }, layers: { annotations: false }, crosshair: true })
    expect(loadChartSyncQueue().map((entry) => entry.workspace.revision)).toEqual([1, 2, 3, 4])
  })

  test('network acknowledgements preserve undo history for the current drawing', async () => {
    const { result } = renderHook(() => useChartWorkspace({ symbol: '600519', period: 'day' }))
    localStorage.setItem('stockcal.accessToken', 'token')
    act(() => result.current.commands.create(drawingFixture()))
    act(() => result.current.commands.updateText('edit'))
    await act(() => result.current.flush())
    act(() => result.current.commands.undo())
    expect(result.current.drawings[0].text).toBeUndefined()
    expect(loadChartSyncQueue()).toHaveLength(1)
  })
})
