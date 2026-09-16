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
  futureCount?: number
  domainTimes?: string[]
}

export type ChartTransform = {
  readonly times: readonly string[]
  readonly domainTimes: readonly string[]
  readonly rect: ChartRect
  hasTime: (time: string) => boolean
  xForTime: (time: string) => number
  widthForTime: (time: string) => number
  timeForX: (x: number) => string
  yForPrice: (price: number) => number
  priceForY: (y: number) => number
}

export function createChartTransform(input: TransformInput): ChartTransform {
  if (!input.times.length) throw new Error('Chart transform requires at least one time')
  if (input.maxPrice <= input.minPrice) throw new Error('Chart transform requires maxPrice greater than minPrice')

  const times = [...input.times]
  const domainTimes = input.domainTimes ? [...input.domainTimes] : times
  const firstVisibleIndex = domainTimes.indexOf(times[0])
  const rect = { ...input.rect }
  const futureCount = Math.max(0, Math.min(times.length, input.futureCount ?? 0))
  const historyCount = times.length - futureCount
  const historyWidth = futureCount > 0 && historyCount > 0 ? rect.width * 0.85 : rect.width
  const step = historyWidth / (historyCount || times.length)
  const futureStep = futureCount > 0 && historyCount > 0 ? (rect.width - historyWidth) / futureCount : step
  const centers = times.map((_, index) => index < historyCount ? rect.left + (index + 0.5) * step : rect.left + historyWidth + (index - historyCount + 0.5) * futureStep)
  if (historyCount === 0) times.forEach((_, index) => { centers[index] = rect.left + (index + 0.5) * step })
  const clampX = (x: number) => Math.max(rect.left, Math.min(rect.left + rect.width, x))
  const clampY = (y: number) => Math.max(rect.top, Math.min(rect.top + rect.height, y))

  return {
    times,
    domainTimes,
    rect,
    hasTime: (time) => domainTimes.includes(time),
    xForTime: (time) => centers[times.indexOf(time)] ?? rect.left + (domainTimes.indexOf(time) - firstVisibleIndex + 0.5) * step,
    widthForTime: (time) => times.indexOf(time) < historyCount ? step : futureStep,
    timeForX: (x) => {
      const offset = clampX(x) - rect.left
      const index = historyCount && offset >= historyWidth ? historyCount + Math.floor((offset - historyWidth) / futureStep) : Math.floor(offset / step)
      return times[Math.min(times.length - 1, index)]
    },
    yForPrice: (price) => rect.top + ((input.maxPrice - price) / (input.maxPrice - input.minPrice)) * rect.height,
    priceForY: (y) => input.maxPrice - ((clampY(y) - rect.top) / rect.height) * (input.maxPrice - input.minPrice),
  }
}
