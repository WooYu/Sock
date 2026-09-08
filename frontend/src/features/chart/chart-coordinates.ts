export type ChartRect = {
  left: number
  top: number
  width: number
  height: number
}

export type TransformInput = {
  times: string[]
  minPrice: number
  maxPrice: number
  rect: ChartRect
}

export type ChartTransform = {
  readonly times: readonly string[]
  readonly rect: ChartRect
  hasTime: (time: string) => boolean
  xForTime: (time: string) => number
  timeForX: (x: number) => string
  yForPrice: (price: number) => number
  priceForY: (y: number) => number
}

export function createChartTransform(input: TransformInput): ChartTransform {
  if (!input.times.length) throw new Error('Chart transform requires at least one time')
  if (input.maxPrice <= input.minPrice) throw new Error('Chart transform requires maxPrice greater than minPrice')

  const times = [...input.times]
  const rect = { ...input.rect }
  const step = rect.width / times.length
  const clampX = (x: number) => Math.max(rect.left, Math.min(rect.left + rect.width, x))
  const clampY = (y: number) => Math.max(rect.top, Math.min(rect.top + rect.height, y))

  return {
    times,
    rect,
    hasTime: (time) => times.includes(time),
    xForTime: (time) => rect.left + (times.indexOf(time) + 0.5) * step,
    timeForX: (x) => times[Math.min(times.length - 1, Math.floor((clampX(x) - rect.left) / step))],
    yForPrice: (price) => rect.top + ((input.maxPrice - price) / (input.maxPrice - input.minPrice)) * rect.height,
    priceForY: (y) => input.maxPrice - ((clampY(y) - rect.top) / rect.height) * (input.maxPrice - input.minPrice),
  }
}
