import { describe, expect, test } from 'vitest'
import { ChartAnnotationStore } from './chart-annotation-store'
import type { DrawingObject, DrawingStyle } from './chart-types'
import { DrawingEngine } from './drawing-engine'

const style: DrawingStyle = { color: '#ef4444', width: 2, lineStyle: 'solid', opacity: 1 }

function drawing(overrides: Partial<DrawingObject> = {}): DrawingObject {
  return {
    id: 'line-1',
    symbol: '600519',
    period: 'day',
    kind: 'horizontal-line',
    points: [{ time: '2026-09-07', price: 10 }],
    style,
    locked: false,
    visible: true,
    version: 1,
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('DrawingEngine', () => {
  test('moves a selected horizontal line in price space and undoes it', () => {
    const engine = new DrawingEngine([drawing()])
    engine.select('line-1')

    engine.move({ timeIndexDelta: 0, priceDelta: 2.5 })

    expect(engine.current()[0].points[0].price).toBe(12.5)
    engine.undo()
    expect(engine.current()[0].points[0].price).toBe(10)
  })

  test('moves every point by a chart-session index across a weekend gap', () => {
    const engine = new DrawingEngine([drawing({
      kind: 'trend-line',
      points: [
        { time: '2026-09-04', price: 10 },
        { time: '2026-09-07', price: 12 },
      ],
    })])
    engine.select('line-1')

    engine.move({
      timeIndexDelta: 1,
      priceDelta: -1,
      timeDomain: ['2026-09-04', '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10'],
    })

    expect(engine.current()[0].points).toEqual([
      { time: '2026-09-07', price: 9 },
      { time: '2026-09-08', price: 11 },
    ])
  })

  test('clamps a whole-object session move at the domain boundary without changing its span', () => {
    const engine = new DrawingEngine([drawing({
      kind: 'trend-line',
      points: [
        { time: '2026-09-04', price: 10 },
        { time: '2026-09-07', price: 12 },
      ],
    })])
    engine.select('line-1')

    engine.move({
      timeIndexDelta: 10,
      priceDelta: 1,
      timeDomain: ['2026-09-04', '2026-09-07', '2026-09-08', '2026-09-09'],
    })

    expect(engine.current()[0].points).toEqual([
      { time: '2026-09-08', price: 11 },
      { time: '2026-09-09', price: 13 },
    ])

    const versionAtBoundary = engine.current()[0].version
    engine.move({
      timeIndexDelta: 1,
      priceDelta: 0,
      timeDomain: ['2026-09-04', '2026-09-07', '2026-09-08', '2026-09-09'],
    })
    expect(engine.current()[0].version).toBe(versionAtBoundary)
  })

  test('does not move locked objects', () => {
    const engine = new DrawingEngine([drawing({ locked: true })])
    engine.select('line-1')

    expect(() => engine.move({ timeIndexDelta: 0, priceDelta: 1 })).not.toThrow()
    expect(engine.current()[0]).toMatchObject({ version: 1, points: [{ price: 10 }] })
  })

  test('locked objects ignore visibility, copy, and redundant lock commands', () => {
    const engine = new DrawingEngine([drawing({ locked: true })])
    engine.select('line-1')

    engine.setVisible(false)
    engine.copy('line-1', 'line-2')
    engine.setLocked(true)

    expect(engine.current()).toEqual([drawing({ locked: true })])
    engine.setLocked(false)
    expect(engine.current()[0]).toMatchObject({ locked: false, version: 2 })
  })

  test('locked objects ignore invalid move, point, and style inputs without throwing', () => {
    const engine = new DrawingEngine([drawing({ locked: true })])
    engine.select('line-1')

    expect(() => engine.move({ timeIndexDelta: 0.5, priceDelta: Number.NaN })).not.toThrow()
    expect(() => engine.movePoint(99, { time: 'not-a-date', price: Number.NaN })).not.toThrow()
    expect(() => engine.updateStyle({ width: Number.POSITIVE_INFINITY })).not.toThrow()

    expect(engine.current()).toEqual([drawing({ locked: true })])
  })

  test('edits a trend-line endpoint and rejects invalid point updates', () => {
    const engine = new DrawingEngine([drawing({
      kind: 'trend-line',
      points: [
        { time: '2026-09-07', price: 10 },
        { time: '2026-09-08', price: 12 },
      ],
    })])
    engine.select('line-1')

    engine.movePoint(1, { time: '2026-09-09', price: 15 })

    expect(engine.current()[0].points).toEqual([
      { time: '2026-09-07', price: 10 },
      { time: '2026-09-09', price: 15 },
    ])
    expect(() => engine.movePoint(2, { time: '2026-09-10', price: 16 })).toThrow('Invalid drawing point index')
    expect(() => engine.movePoint(0, { time: '2026-09-10', price: Number.NaN })).toThrow('Drawing point price must be finite')
  })

  test('normalizes rectangle corners after creation and endpoint editing', () => {
    const engine = new DrawingEngine()
    engine.create(drawing({
      id: 'rectangle-1',
      kind: 'rectangle',
      points: [
        { time: '2026-09-10', price: 20 },
        { time: '2026-09-08', price: 10 },
      ],
    }))

    expect(engine.current()[0].points).toEqual([
      { time: '2026-09-08', price: 10 },
      { time: '2026-09-10', price: 20 },
    ])

    engine.select('rectangle-1')
    engine.movePoint(0, { time: '2026-09-12', price: 25 })
    expect(engine.current()[0].points).toEqual([
      { time: '2026-09-10', price: 20 },
      { time: '2026-09-12', price: 25 },
    ])
  })

  test('rejects non-finite point prices on create without changing state or history', () => {
    const engine = new DrawingEngine([drawing()])

    expect(() => engine.create(drawing({
      id: 'invalid-line',
      points: [{ time: '2026-09-08', price: Number.POSITIVE_INFINITY }],
    }))).toThrow('Drawing point price must be finite')

    expect(engine.current()).toEqual([drawing()])
    engine.undo()
    expect(engine.current()).toEqual([drawing()])
  })

  test('copies a drawing deeply with a new id and selects the copy', () => {
    const engine = new DrawingEngine([drawing()])

    engine.copy('line-1', 'line-2')
    engine.move({ timeIndexDelta: 0, priceDelta: 4 })

    expect(engine.current().map(({ id, points }) => ({ id, price: points[0].price }))).toEqual([
      { id: 'line-1', price: 10 },
      { id: 'line-2', price: 14 },
    ])
  })

  test('deletes the selected drawing and restores it with undo', () => {
    const engine = new DrawingEngine([drawing()])
    engine.select('line-1')

    engine.remove()
    expect(engine.current()).toEqual([])

    engine.undo()
    expect(engine.current()).toHaveLength(1)
    engine.move({ timeIndexDelta: 0, priceDelta: 1 })
    expect(engine.current()[0].points[0].price).toBe(11)
  })

  test('invalidates redo after a new command', () => {
    const engine = new DrawingEngine([drawing()])
    engine.select('line-1')
    engine.move({ timeIndexDelta: 0, priceDelta: 1 })
    engine.undo()

    engine.updateText('new branch')
    engine.redo()

    expect(engine.current()[0]).toMatchObject({ text: 'new branch', points: [{ price: 10 }] })
  })

  test('rejects non-finite move results atomically without invalidating redo', () => {
    const engine = new DrawingEngine([drawing({ points: [{ time: '2026-09-07', price: Number.MAX_VALUE }] })])
    engine.select('line-1')
    engine.move({ timeIndexDelta: 0, priceDelta: -1 })
    engine.undo()

    expect(() => engine.move({ timeIndexDelta: 0, priceDelta: Number.MAX_VALUE })).toThrow('Drawing point price must be finite')
    engine.redo()
    expect(engine.current()[0].version).toBe(2)
  })

  test('updates style, text, visibility and lock state with version metadata', () => {
    const engine = new DrawingEngine([drawing()])
    engine.select('line-1')

    engine.updateStyle({ color: '#2563eb', opacity: 0.5 })
    engine.updateText('压力位')
    engine.setVisible(false)
    engine.setLocked(true)

    const result = engine.current()[0]
    expect(result).toMatchObject({
      style: { color: '#2563eb', width: 2, lineStyle: 'solid', opacity: 0.5 },
      text: '压力位',
      visible: false,
      locked: true,
      version: 5,
    })
    expect(result.updatedAt).not.toBe('2026-09-01T00:00:00.000Z')

    engine.updateText('blocked while locked')
    expect(engine.current()[0]).toMatchObject({ text: '压力位', version: 5 })
    engine.setLocked(false)
    expect(engine.current()[0]).toMatchObject({ locked: false, version: 6 })
  })

  test('returns immutable snapshots and keeps at most 100 undo states', () => {
    const engine = new DrawingEngine([drawing({ points: [{ time: '2026-09-07', price: 0 }] })])
    engine.select('line-1')
    const leaked = engine.current()
    leaked[0].points[0].price = 999
    leaked[0].style.color = '#000000'
    expect(engine.current()[0]).toMatchObject({ points: [{ price: 0 }], style: { color: '#ef4444' } })

    for (let count = 0; count < 101; count += 1) engine.move({ timeIndexDelta: 0, priceDelta: 1 })
    for (let count = 0; count < 101; count += 1) engine.undo()

    expect(engine.current()[0].points[0].price).toBe(1)
  })

  test('keeps the previous store import path as a DrawingEngine delegate', () => {
    const store = new ChartAnnotationStore([drawing()])
    store.select('line-1')

    store.move({ timeIndexDelta: 0, priceDelta: 3 })

    expect(store.current()[0].points[0].price).toBe(13)
  })

  test('rejects legacy pixel annotations at the store boundary', () => {
    const legacy = {
      id: 'legacy-line',
      kind: 'horizontal-line',
      start: { x: 10, y: 20 },
    }

    expect(() => new ChartAnnotationStore([legacy as unknown as DrawingObject])).toThrow('ChartAnnotationStore accepts only time-price drawings')
  })
})
