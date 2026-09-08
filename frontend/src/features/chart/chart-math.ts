import type { Candle } from '../workspace/stock-workspace-types'
import type { ChartPeriod } from './chart-types'

export function aggregateCandles(candles: Candle[], period: ChartPeriod): Candle[] {
  const groups: Candle[] = []
  const buckets = new Map<string, Candle[]>()
  for (const candle of candles) {
    const key = candlePeriodKey(candle.day, period)
    buckets.set(key, [...(buckets.get(key) ?? []), candle])
  }
  for (const group of buckets.values()) {
    if (!group.length) continue
    groups.push({
      day: group[0].day,
      open: group[0].open,
      high: Math.max(...group.map((candle) => candle.high)),
      low: Math.min(...group.map((candle) => candle.low)),
      close: group[group.length - 1].close,
      volume: group.reduce((total, candle) => total + candle.volume, 0),
    })
  }
  return groups
}

function candlePeriodKey(day: string, period: ChartPeriod): string {
  if (period === 'day') return day
  if (period === 'month') return day.slice(0, 7)
  const [year, month, dateOfMonth] = day.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, dateOfMonth))
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
  return date.toISOString().slice(0, 10)
}

export function movingAverage(candles: Candle[], size: number): number[] {
  return candles.map((_, index) => {
    const values = candles.slice(Math.max(0, index - size + 1), index + 1).map((candle) => candle.close)
    return values.reduce((total, value) => total + value, 0) / values.length
  })
}

export function bollinger(candles: Candle[], size: number, multiplier: number): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = movingAverage(candles, size)
  const upper: number[] = []
  const lower: number[] = []
  candles.forEach((_, index) => {
    const values = candles.slice(Math.max(0, index - size + 1), index + 1).map((candle) => candle.close)
    const mean = middle[index]
    const deviation = Math.sqrt(values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length)
    upper.push(mean + deviation * multiplier)
    lower.push(mean - deviation * multiplier)
  })
  return { upper, middle, lower }
}
