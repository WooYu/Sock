export type ChartTool =
  | 'pointer'
  | 'trend-line'
  | 'horizontal-line'
  | 'rectangle'
  | 'buy'
  | 'sell'
  | 'target'
  | 'stop-loss'
  | 'text'

export type ChartAnnotation = {
  id: string
  kind: Exclude<ChartTool, 'pointer'>
  start: { x: number; y: number }
  end?: { x: number; y: number }
  text?: string
  hidden?: boolean
}

export class ChartAnnotationStore {
  private current: ChartAnnotation[] = []
  private past: ChartAnnotation[][] = []
  private future: ChartAnnotation[][] = []

  list() {
    return this.current.map((item) => ({ ...item, start: { ...item.start }, end: item.end && { ...item.end } }))
  }

  create(annotation: ChartAnnotation) {
    this.record()
    this.current = [...this.current, annotation]
    this.future = []
    return this.list()
  }

  update(id: string, patch: Partial<ChartAnnotation>) {
    this.record()
    this.current = this.current.map((item) => item.id === id ? { ...item, ...patch } : item)
    this.future = []
    return this.list()
  }

  delete(id: string) {
    this.record()
    this.current = this.current.filter((item) => item.id !== id)
    this.future = []
    return this.list()
  }

  undo() {
    if (!this.past.length) return this.list()
    this.future = [this.list(), ...this.future]
    this.current = this.past.pop()!
    return this.list()
  }

  redo() {
    if (!this.future.length) return this.list()
    this.past = [...this.past, this.list()]
    this.current = this.future.shift()!
    return this.list()
  }

  private record() {
    this.past = [...this.past, this.list()]
  }
}
