import { DrawingEngine, type DrawingMove } from './drawing-engine'
import type { DrawingObject, DrawingStyle, TimePricePoint } from './chart-types'

export type ChartTool =
  | 'pointer'
  | 'trend-line'
  | 'horizontal-line'
  | 'rectangle'
  | 'marker'
  | 'buy'
  | 'sell'
  | 'target'
  | 'stop-loss'
  | 'text'

function isDrawingObject(item: DrawingObject): boolean {
  return typeof item === 'object' && item !== null && Array.isArray(item.points)
}

/** Compatibility module path backed exclusively by time-price drawings. */
export class ChartAnnotationStore {
  private engine: DrawingEngine

  constructor(initial: DrawingObject[] = []) {
    if (!initial.every(isDrawingObject)) throw new Error('ChartAnnotationStore accepts only time-price drawings')
    this.engine = new DrawingEngine(initial)
  }

  current(): DrawingObject[] {
    return this.engine.current()
  }

  list(): DrawingObject[] {
    return this.current()
  }

  replace(items: DrawingObject[]): DrawingObject[] {
    if (!items.every(isDrawingObject)) throw new Error('ChartAnnotationStore accepts only time-price drawings')
    this.engine = new DrawingEngine(items)
    return this.current()
  }

  create(item: DrawingObject): DrawingObject[] {
    return this.engine.create(item)
  }

  select(id: string | null): void {
    this.engine.select(id)
  }

  move(delta: DrawingMove): DrawingObject[] {
    return this.engine.move(delta)
  }

  movePoint(index: number, point: TimePricePoint): DrawingObject[] {
    return this.engine.movePoint(index, point)
  }

  copy(sourceId: string, newId: string): DrawingObject[] {
    return this.engine.copy(sourceId, newId)
  }

  updateStyle(patch: Partial<DrawingStyle>): DrawingObject[] {
    return this.engine.updateStyle(patch)
  }

  updateText(text: string | undefined): DrawingObject[] {
    return this.engine.updateText(text)
  }

  setVisible(visible: boolean): DrawingObject[] {
    return this.engine.setVisible(visible)
  }

  setLocked(locked: boolean): DrawingObject[] {
    return this.engine.setLocked(locked)
  }

  remove(id?: string): DrawingObject[] {
    return this.engine.remove(id)
  }

  undo(): DrawingObject[] {
    return this.engine.undo()
  }

  redo(): DrawingObject[] {
    return this.engine.redo()
  }
}

export { DrawingEngine }
export type { DrawingMove }
