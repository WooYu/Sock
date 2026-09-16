import type { Candle } from '../workspace/stock-workspace-types'
import type { PredictionSnapshot } from './chart-types'
import { canonicalPeriodTime, isCalendarDate, MA_PERIODS, type ChartPeriod, type IndicatorValue, type MaKey } from './chart-periods'

export { canonicalPeriodTime, formatChartTime } from './chart-periods'

export function aggregateCandles(candles: Candle[], period: ChartPeriod): Candle[] {
  const buckets = new Map<string, Candle>()
  for (const candle of [...candles].sort((a, b) => a.day.localeCompare(b.day))) {
    const day = canonicalPeriodTime(candle.day, period)
    const bucket = buckets.get(day)
    buckets.set(day, bucket ? {
      day,
      open: bucket.open,
      high: Math.max(bucket.high, candle.high),
      low: Math.min(bucket.low, candle.low),
      close: candle.close,
      volume: bucket.volume + candle.volume,
      ...(candle.endTime === undefined ? {} : { endTime: candle.endTime }),
    } : { ...candle, day })
  }
  return [...buckets.values()]
}

function validateWindow(size: number): void {
  if (!Number.isSafeInteger(size) || size <= 0) throw new RangeError('Indicator window must be a positive integer')
}

export function movingAverage(candles: Candle[], size: number): IndicatorValue[] {
  validateWindow(size)
  let sum = 0
  return candles.map((candle, index) => {
    if (!Number.isFinite(candle.close)) throw new RangeError('Indicator close must be finite')
    sum += candle.close
    if (index >= size) sum -= candles[index - size].close
    return index + 1 < size ? null : sum / size
  })
}

export function bollinger(candles: Candle[], size: number, multiplier: number): { upper: IndicatorValue[]; middle: IndicatorValue[]; lower: IndicatorValue[] } {
  if (!Number.isFinite(multiplier) || multiplier <= 0) throw new RangeError('BOLL multiplier must be positive and finite')
  const middle = movingAverage(candles, size)
  const upper: IndicatorValue[] = []
  const lower: IndicatorValue[] = []
  candles.forEach((_, index) => {
    const mean = middle[index]
    if (mean === null) {
      upper.push(null)
      lower.push(null)
      return
    }
    const values = candles.slice(index - size + 1, index + 1).map((candle) => candle.close)
    const deviation = Math.sqrt(values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length)
    upper.push(mean + deviation * multiplier)
    lower.push(mean - deviation * multiplier)
  })
  return { upper, middle, lower }
}

/** Recompute daily MAs and BOLL20/2 from one history plus predicted closes. The existing export name stays compatible. */
export function withPredictionMovingAverages(history: Candle[], prediction: PredictionSnapshot): PredictionSnapshot {
  if (prediction.period !== 'day') return prediction
  if (history.some((candle) => !isCalendarDate(candle.day))) throw new RangeError('Prediction moving averages require daily history')
  const preceding = aggregateCandles(history.filter((candle) => candle.day < prediction.days[0].day), 'day')
  const candles = [...preceding, ...prediction.days.map((day) => ({ day: day.day, open: day.open, high: day.high, low: day.low, close: day.close, volume: 0 }))]
  const averages = Object.fromEntries(MA_PERIODS.map((size) => [`ma${size}`, movingAverage(candles, size)])) as Record<MaKey, IndicatorValue[]>
  const bands = bollinger(candles, 20, 2)
  return {
    ...prediction,
    days: prediction.days.map((day, index) => ({
      ...day,
      ...Object.fromEntries(MA_PERIODS.map((size) => [`ma${size}`, averages[`ma${size}`][preceding.length + index]])),
      bollUpper: bands.upper[preceding.length + index],
      bollMiddle: bands.middle[preceding.length + index],
      bollLower: bands.lower[preceding.length + index],
    })) as PredictionSnapshot['days'],
  }
}
