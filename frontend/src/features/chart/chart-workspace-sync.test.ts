import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { enqueueChartWorkspace, loadChartSyncCursor, loadChartSyncQueue, loadChartWorkspace, pullChartWorkspace, pushChartWorkspace, replayChartSyncQueue, saveChartWorkspace } from './chart-workspace-sync'
import { drawingFixture, workspaceFixture } from './chart-workspace-test-fixtures'

const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
const change = (payload = workspaceFixture(), cursor = 1) => ({ cursor, entityType: 'CHART_WORKSPACE', entityId: `${payload.symbol}:${payload.period}`, operation: 'UPSERT', revision: payload.revision, payload, changedAt: payload.updatedAt, idempotencyKey: `remote-${cursor}` })

describe('chart workspace v2 persistence and sync', () => {
  beforeEach(() => { localStorage.clear(); vi.stubGlobal('fetch', vi.fn()) })
  afterEach(() => vi.unstubAllGlobals())

  test('keeps day week and month in separate keys and validates requested identity', () => {
    for (const period of ['day', 'week', 'month'] as const) saveChartWorkspace(workspaceFixture({ period, drawings: [drawingFixture({ period, text: period })] }))
    expect(loadChartWorkspace('600519', 'day')?.drawings[0].text).toBe('day')
    expect(loadChartWorkspace('600519', 'week')?.drawings[0].text).toBe('week')
    expect(loadChartWorkspace('600519', 'month')?.drawings[0].text).toBe('month')
    localStorage.setItem('stockcal:chart-workspace:other:day', JSON.stringify(workspaceFixture()))
    expect(loadChartWorkspace('other', 'day')).toBeNull()
  })

  test('migrates v1, discards pixel drawings and rewrites the same key as canonical v2', () => {
    localStorage.setItem('stockcal:chart-workspace:600519:week', JSON.stringify({ ...workspaceFixture({ period: 'week' }), version: 1, stockCode: '600519', drawings: [{ id: 'pixels', start: { x: 10, y: 20 } }] }))
    const loaded = loadChartWorkspace('600519', 'week')
    expect(loaded?.version).toBe(2)
    expect(loaded?.drawings).toEqual([])
    expect(JSON.parse(localStorage.getItem('stockcal:chart-workspace:600519:week')!)).toEqual(loaded)
  })

  test('does not rewrite malformed or mismatched legacy storage', () => {
    const invalid = JSON.stringify({ ...workspaceFixture(), version: 1, stockCode: 'other' })
    localStorage.setItem('stockcal:chart-workspace:600519:day', invalid)
    expect(loadChartWorkspace('600519', 'day')).toBeNull()
    expect(localStorage.getItem('stockcal:chart-workspace:600519:day')).toBe(invalid)
  })

  test('rejects malformed legacy settings rather than silently resetting them', () => {
    const raw = JSON.stringify({ ...workspaceFixture(), version: 1, stockCode: '600519', indicators: false, updatedAt: 42 })
    localStorage.setItem('stockcal:chart-workspace:600519:day', raw)
    expect(loadChartWorkspace('600519', 'day')).toBeNull()
    expect(localStorage.getItem('stockcal:chart-workspace:600519:day')).toBe(raw)
  })

  test('recovers a queued snapshot before dropping the acknowledged durable head', async () => {
    enqueueChartWorkspace(workspaceFixture({ drawings: [drawingFixture()] }))
    vi.mocked(fetch).mockImplementation(async () => response({ applied: true, cursor: 1 }))
    await replayChartSyncQueue('browser-1')
    expect(loadChartWorkspace('600519', 'day')?.drawings[0].id).toBe('line-1')
    expect(loadChartSyncQueue()).toEqual([])
  })

  test('uses browser relative BFF routes with canonical v2 and authenticated headers', async () => {
    vi.mocked(fetch).mockResolvedValue(response({ applied: true, cursor: 7 }))
    await pushChartWorkspace(workspaceFixture(), 'browser-1', 'Bearer token')
    expect(fetch).toHaveBeenCalledWith('/api/sync/mutations', expect.objectContaining({ headers: expect.objectContaining({ 'X-Client-Id': 'browser-1', Authorization: 'Bearer token' }), body: expect.any(String) }))
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
    expect(body).toMatchObject({ entityType: 'CHART_WORKSPACE', entityId: '600519:day', revision: 1, payload: workspaceFixture() })
  })

  test('persists FIFO immediately, keeps the failed head, then retries in order', async () => {
    enqueueChartWorkspace(workspaceFixture())
    enqueueChartWorkspace(workspaceFixture({ revision: 2 }))
    expect(JSON.parse(localStorage.getItem('stockcal:chart-sync-queue:v2')!)).toHaveLength(2)
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'))
    await expect(replayChartSyncQueue('browser-1')).rejects.toThrow('offline')
    expect(loadChartSyncQueue().map((item) => item.workspace.revision)).toEqual([1, 2])
    vi.mocked(fetch).mockImplementation(async () => response({ applied: true, cursor: 1 }))
    await replayChartSyncQueue('browser-1')
    expect(loadChartSyncQueue()).toEqual([])
    expect(vi.mocked(fetch).mock.calls.slice(1).map(([, init]) => JSON.parse(init!.body as string).revision)).toEqual([1, 2])
  })

  test('processes all pulled entities in cursor order before advancing cursor', async () => {
    const weekly = workspaceFixture({ period: 'week', revision: 2 })
    vi.mocked(fetch).mockResolvedValue(response({ nextCursor: 3, changes: [change(workspaceFixture(), 1), change(weekly, 2), change(workspaceFixture({ revision: 3, crosshair: true }), 3)] }))
    await pullChartWorkspace(0, 'browser-1')
    expect(loadChartWorkspace('600519', 'week')).toEqual(weekly)
    expect(loadChartWorkspace('600519', 'day')?.crosshair).toBe(true)
    expect(loadChartSyncCursor()).toBe(3)
  })

  test('never advances cursor when any chart entity fails validation or persistence', async () => {
    vi.mocked(fetch).mockResolvedValue(response({ nextCursor: 2, changes: [change(), { ...change(workspaceFixture(), 2), entityId: 'wrong:day' }] }))
    await expect(pullChartWorkspace(0)).rejects.toThrow()
    expect(loadChartSyncCursor()).toBe(0)
    vi.mocked(fetch).mockResolvedValue(response({ nextCursor: 1, changes: [change()] }))
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full') })
    await expect(pullChartWorkspace(0)).rejects.toThrow('full')
    write.mockRestore()
    expect(loadChartSyncCursor()).toBe(0)
  })

  test('409 pulls merges bumps revision and retries without losing another entity', async () => {
    enqueueChartWorkspace(workspaceFixture({ drawings: [drawingFixture()] }))
    const remote = workspaceFixture({ revision: 5, drawings: [drawingFixture({ id: 'remote' })] })
    vi.mocked(fetch).mockResolvedValueOnce(response({ message: 'conflict' }, 409))
      .mockResolvedValueOnce(response({ nextCursor: 2, changes: [change(remote), change(workspaceFixture({ period: 'month' }), 2)] }))
      .mockResolvedValueOnce(response({ applied: true, cursor: 3 }))
    await replayChartSyncQueue('browser-1')
    const retried = JSON.parse(vi.mocked(fetch).mock.calls[2][1]!.body as string)
    expect(retried.revision).toBe(6)
    expect(retried.payload.drawings.map((item: { id: string }) => item.id)).toEqual(['line-1', 'remote'])
    expect(loadChartWorkspace('600519', 'month')).not.toBeNull()
    expect(loadChartWorkspace('600519', 'day')?.revision).toBe(6)
    expect(loadChartSyncQueue()).toEqual([])
  })

  test('bounds repeated conflicts and retains the rebased head for later retry', async () => {
    enqueueChartWorkspace(workspaceFixture())
    vi.mocked(fetch).mockImplementation(async (url) => String(url).includes('changes') ? response({ nextCursor: 1, changes: [change(workspaceFixture({ revision: 5 }))] }) : response({}, 409))
    await expect(replayChartSyncQueue('browser-1')).rejects.toThrow()
    expect(vi.mocked(fetch).mock.calls.length).toBeLessThanOrEqual(7)
    expect(loadChartSyncQueue()).toHaveLength(1)
    expect(loadChartSyncQueue()[0].workspace.revision).toBeGreaterThan(5)
  })
})
