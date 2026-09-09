import type { DrawingObject, DrawingStyle, DrawingTombstone, TimePricePoint } from './chart-types'

export type DrawingMove = {
  /** Number of entries in timeDomain. This is a trading-session delta, not calendar days. */
  timeIndexDelta: number
  /** Ordered chart sessions used to shift every point without landing in market gaps. */
  timeDomain?: readonly string[]
  priceDelta: number
}

type EngineSnapshot = {
  drawings: DrawingObject[]
  selectedId: string | null
}

const MAX_UNDO_STATES = 100

function cloneDrawing(drawing: DrawingObject): DrawingObject {
  return {
    ...drawing,
    points: drawing.points.map((point) => ({ ...point })),
    style: { ...drawing.style },
  }
}

function cloneDrawings(drawings: DrawingObject[]): DrawingObject[] {
  return drawings.map(cloneDrawing)
}

function normalizeRectangle(drawing: DrawingObject): DrawingObject {
  if (drawing.kind !== 'rectangle' || drawing.points.length < 2) return drawing
  const [first, second, ...rest] = drawing.points
  return {
    ...drawing,
    points: [
      { time: first.time < second.time ? first.time : second.time, price: Math.min(first.price, second.price) },
      { time: first.time < second.time ? second.time : first.time, price: Math.max(first.price, second.price) },
      ...rest,
    ],
  }
}

function boundedTimeIndexDelta(drawing: DrawingObject, move: DrawingMove): number {
  if (move.timeIndexDelta === 0) return 0
  const domain = move.timeDomain
  if (!domain?.length) throw new Error('Drawing session move requires a time domain')
  const pointIndexes = drawing.points.map((point) => domain.indexOf(point.time))
  if (pointIndexes.some((index) => index < 0)) throw new Error('Drawing point time must exist in the move time domain')
  const minimum = Math.min(...pointIndexes)
  const maximum = Math.max(...pointIndexes)
  return Math.max(-minimum, Math.min(domain.length - 1 - maximum, move.timeIndexDelta))
}

export class DrawingEngine {
  private drawings: DrawingObject[]
  private deletions = new Map<string, DrawingTombstone>()
  private versions = new Map<string, number>()
  private selectedId: string | null = null
  private past: EngineSnapshot[] = []
  private future: EngineSnapshot[] = []

  constructor(initial: DrawingObject[] = [], deletions: DrawingTombstone[] = []) {
    this.drawings = cloneDrawings(initial).map(normalizeRectangle)
    for (const item of deletions) this.deletions.set(item.id, { ...item })
    for (const item of [...initial, ...deletions]) this.versions.set(item.id, Math.max(item.version, this.versions.get(item.id) ?? 0))
  }

  current(): DrawingObject[] {
    return cloneDrawings(this.drawings)
  }

  currentDeletions(): DrawingTombstone[] {
    return [...this.deletions.values()].map((item) => ({ ...item }))
  }

  currentSelectedId(): string | null {
    return this.selectedId
  }

  select(id: string | null): void {
    this.selectedId = id !== null && this.drawings.some((drawing) => drawing.id === id) ? id : null
  }

  create(drawing: DrawingObject): DrawingObject[] {
    if (this.drawings.some((candidate) => candidate.id === drawing.id)) throw new Error(`Drawing id already exists: ${drawing.id}`)
    if (drawing.points.some((point) => !Number.isFinite(point.price))) throw new Error('Drawing point price must be finite')
    this.record()
    this.drawings = [...this.drawings, normalizeRectangle(this.touched(cloneDrawing(drawing)))]
    this.selectedId = drawing.id
    return this.current()
  }

  copy(sourceId: string, newId: string): DrawingObject[] {
    const source = this.drawings.find((drawing) => drawing.id === sourceId)
    if (!source) throw new Error(`Drawing not found: ${sourceId}`)
    if (source.locked) return this.current()
    if (this.drawings.some((drawing) => drawing.id === newId)) throw new Error(`Drawing id already exists: ${newId}`)
    this.record()
    this.drawings = [...this.drawings, this.touched({ ...cloneDrawing(source), id: newId })]
    this.selectedId = newId
    return this.current()
  }

  move(delta: DrawingMove): DrawingObject[] {
    const selected = this.selectedDrawing()
    if (!selected || selected.locked) return this.current()
    if (!Number.isInteger(delta.timeIndexDelta) || !Number.isFinite(delta.priceDelta)) throw new Error('Drawing move requires a whole-session index delta and finite price delta')
    const timeIndexDelta = boundedTimeIndexDelta(selected, delta)
    if (timeIndexDelta === 0 && delta.priceDelta === 0) return this.current()
    return this.updateSelected((drawing) => ({
      ...drawing,
      points: drawing.points.map((point) => {
        const price = point.price + delta.priceDelta
        if (!Number.isFinite(price)) throw new Error('Drawing point price must be finite')
        const time = timeIndexDelta === 0
          ? point.time
          : delta.timeDomain![delta.timeDomain!.indexOf(point.time) + timeIndexDelta]
        return { time, price }
      }),
    }))
  }

  movePoint(index: number, point: TimePricePoint): DrawingObject[] {
    const selected = this.selectedDrawing()
    if (!selected || selected.locked) return this.current()
    if (!Number.isFinite(point.price)) throw new Error('Drawing point price must be finite')
    if (!Number.isInteger(index) || index < 0 || index >= selected.points.length) throw new Error('Invalid drawing point index')
    return this.updateSelected((drawing) => normalizeRectangle({
      ...drawing,
      points: drawing.points.map((candidate, pointIndex) => pointIndex === index ? { ...point } : candidate),
    }))
  }

  updateStyle(patch: Partial<DrawingStyle>): DrawingObject[] {
    const selected = this.selectedDrawing()
    if (!selected || selected.locked) return this.current()
    if (patch.width !== undefined && !Number.isFinite(patch.width)) throw new Error('Drawing style width must be finite')
    if (patch.opacity !== undefined && !Number.isFinite(patch.opacity)) throw new Error('Drawing style opacity must be finite')
    return this.updateSelected((drawing) => ({ ...drawing, style: { ...drawing.style, ...patch } }))
  }

  updateText(text: string | undefined): DrawingObject[] {
    return this.updateSelected((drawing) => {
      if (text === undefined) {
        const { text: _text, ...withoutText } = drawing
        void _text
        return withoutText
      }
      return { ...drawing, text }
    })
  }

  setVisible(visible: boolean): DrawingObject[] {
    return this.updateSelected((drawing) => ({ ...drawing, visible }))
  }

  setLocked(locked: boolean): DrawingObject[] {
    return this.updateSelected((drawing) => ({ ...drawing, locked }), !locked)
  }

  remove(id: string | null = this.selectedId): DrawingObject[] {
    if (id === null) return this.current()
    const drawing = this.drawings.find((candidate) => candidate.id === id)
    if (!drawing || drawing.locked) return this.current()
    this.record()
    this.markDeleted(drawing)
    this.drawings = this.drawings.filter((candidate) => candidate.id !== id)
    if (this.selectedId === id) this.selectedId = null
    return this.current()
  }

  undo(): DrawingObject[] {
    const previous = this.past.pop()
    if (!previous) return this.current()
    this.future = [...this.future, this.snapshot()].slice(-MAX_UNDO_STATES)
    this.restore(previous)
    return this.current()
  }

  redo(): DrawingObject[] {
    const next = this.future.pop()
    if (!next) return this.current()
    this.past = [...this.past, this.snapshot()].slice(-MAX_UNDO_STATES)
    this.restore(next)
    return this.current()
  }

  private selectedDrawing(): DrawingObject | undefined {
    return this.drawings.find((drawing) => drawing.id === this.selectedId)
  }

  private updateSelected(
    update: (drawing: DrawingObject) => DrawingObject,
    allowLocked = false,
  ): DrawingObject[] {
    const selected = this.selectedDrawing()
    if (!selected || (selected.locked && !allowLocked)) return this.current()
    const next = this.touched(update(cloneDrawing(selected)))
    this.record()
    this.drawings = this.drawings.map((drawing) => drawing.id === selected.id ? next : drawing)
    return this.current()
  }

  private record(): void {
    this.past = [...this.past, this.snapshot()].slice(-MAX_UNDO_STATES)
    this.future = []
  }

  private snapshot(): EngineSnapshot {
    return { drawings: cloneDrawings(this.drawings), selectedId: this.selectedId }
  }

  private restore(snapshot: EngineSnapshot): void {
    const targetIds = new Set(snapshot.drawings.map((item) => item.id))
    for (const current of this.drawings) if (!targetIds.has(current.id)) this.markDeleted(current)
    this.drawings = snapshot.drawings.map((item) => {
      const current = this.drawings.find((candidate) => candidate.id === item.id)
      const content = (drawing: DrawingObject) => JSON.stringify({ ...drawing, version: 0, updatedAt: '', restoredFromVersion: undefined })
      if (current && content(current) === content(item)) return cloneDrawing(current)
      const deleted = this.deletions.get(item.id)
      return this.touched({ ...cloneDrawing(item), ...(deleted ? { restoredFromVersion: deleted.version } : {}) })
    })
    this.selectedId = snapshot.selectedId
  }

  private touched(drawing: DrawingObject): DrawingObject {
    const version = Math.max(drawing.version, this.versions.get(drawing.id) ?? 0) + 1
    this.versions.set(drawing.id, version)
    return { ...drawing, version, updatedAt: new Date().toISOString() }
  }

  private markDeleted(drawing: DrawingObject): void {
    const { id, version, updatedAt } = this.touched(drawing)
    this.deletions.set(id, { id, version, updatedAt })
  }
}
