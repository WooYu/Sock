import { describe, expect, test } from 'vitest'
import { deserializeChartWorkspace, isChartWorkspaceV2, mergeChartWorkspace, serializeChartWorkspace } from './chart-workspace-state'
import { drawingFixture, workspaceFixture } from './chart-workspace-test-fixtures'

describe('chart workspace v2 state', () => {
  test('round trips canonical v2 without market data or transient properties', () => {
    const workspace = workspaceFixture({ drawings: [drawingFixture()] })
    const transient = { ...workspace, candles: [], selectedId: 'line-1', drawings: [{ ...workspace.drawings[0], pixel: 10 }] }
    const serialized = serializeChartWorkspace(transient)
    expect(deserializeChartWorkspace(serialized)).toEqual(workspace)
    expect(serialized).not.toMatch(/candles|selectedId|pixel/)
  })

  test.each([
    { revision: -1 }, { revision: 1.5 }, { updatedAt: 'yesterday' },
    { updatedAt: '2026-02-30T00:00:00Z' }, { indicators: { ma5: 1 } },
    { layers: [] }, { view: { zoom: 0, panX: 0, panY: 0 } },
    { indicatorConfig: { bollPeriod: Number.NaN } },
    { drawings: [drawingFixture({ version: -1 })] },
    { drawings: [drawingFixture({ points: [{ time: '2026-02-30', price: 3 }] })] },
    { drawings: [drawingFixture({ symbol: 'other' })] },
    { drawings: [drawingFixture({ style: { color: '#fff', width: 1, lineStyle: 'solid', opacity: 2 } })] },
    { deletions: [{ id: '', version: 1, updatedAt: '2026-09-07T00:00:00Z' }] },
    { recovery: [{ id: 'line-1', reason: 'DELETE_EDIT_CONFLICT' }] },
  ])('rejects invalid nested v2: %j', (patch) => {
    const value = { ...workspaceFixture(), ...patch }
    expect(isChartWorkspaceV2(value)).toBe(false)
    expect(() => serializeChartWorkspace(value as ReturnType<typeof workspaceFixture>)).toThrow()
    expect(deserializeChartWorkspace(JSON.stringify(value))).toBeNull()
  })

  test('chooses object versions before timestamps and workspace revisions before settings', () => {
    const local = workspaceFixture({ revision: 10, view: { zoom: 120, panX: 4, panY: 0 }, drawings: [drawingFixture({ version: 8 })] })
    const remote = workspaceFixture({ revision: 2, updatedAt: '2026-09-08T00:00:00Z', drawings: [drawingFixture({ version: 7, text: 'older version', updatedAt: '2026-09-08T00:00:00Z' })] })
    const merged = mergeChartWorkspace(local, remote)
    expect(merged.drawings).toEqual(local.drawings)
    expect(merged.view).toEqual(local.view)
    expect(merged.revision).toBe(10)
    expect(merged.recovery).toContainEqual({ id: 'line-1', reason: 'VERSION_CONFLICT', drawing: remote.drawings[0] })
  })

  test('breaks equal versions using parsed timestamps', () => {
    const local = workspaceFixture({ drawings: [drawingFixture({ updatedAt: '2026-09-07T08:30:00+08:00' })] })
    const remote = workspaceFixture({ drawings: [drawingFixture({ text: 'newer', updatedAt: '2026-09-07T01:00:00Z' })] })
    expect(mergeChartWorkspace(local, remote).drawings[0].text).toBe('newer')
  })

  test('keeps a delete active with a deduplicated recovery copy of the remote edit', () => {
    const local = workspaceFixture({ deletions: [{ id: 'line-1', version: 3, updatedAt: '2026-09-07T00:00:00Z' }] })
    const remote = workspaceFixture({ drawings: [drawingFixture({ version: 4, text: 'remote edit' })] })
    const merged = mergeChartWorkspace(local, remote)
    expect(merged.drawings).toEqual([])
    expect(merged.deletions).toEqual(local.deletions)
    expect(merged.recovery).toEqual([{ id: 'line-1', reason: 'DELETE_EDIT_CONFLICT', drawing: remote.drawings[0] }])
    expect(mergeChartWorkspace(merged, remote)).toEqual(merged)
  })

  test('explicit restoration supersedes the acknowledged delete but not a later delete', () => {
    const restored = workspaceFixture({ drawings: [drawingFixture({ version: 4, restoredFromVersion: 3 })] })
    const deleted = workspaceFixture({ deletions: [{ id: 'line-1', version: 3, updatedAt: '2026-09-07T00:00:00Z' }] })
    expect(mergeChartWorkspace(restored, deleted).drawings).toEqual(restored.drawings)
    expect(mergeChartWorkspace(restored, { ...deleted, deletions: [{ ...deleted.deletions![0], version: 5 }] }).drawings).toEqual([])
  })

  test('refuses merges across symbols or periods', () => {
    expect(() => mergeChartWorkspace(workspaceFixture(), workspaceFixture({ period: 'week' }))).toThrow()
  })
})
