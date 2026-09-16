import type { Candle } from '../workspace/stock-workspace-types'

export function summarizeRecent(candles: Candle[]) {
  if (candles.length < 20) return null
  const recent = candles.slice(-20)
  const last = recent.at(-1)!
  const ma20 = recent.reduce((sum, candle) => sum + candle.close, 0) / 20
  const previous = candles.slice(-21, -1)
  const averageVolume = previous.reduce((sum, candle) => sum + candle.volume, 0) / previous.length
  return {
    high: Math.max(...recent.map((candle) => candle.high)),
    low: Math.min(...recent.map((candle) => candle.low)),
    ma20,
    aboveMa20: last.close >= ma20,
    volumeRatio: previous.length === 20 && averageVolume > 0 ? last.volume / averageVolume : null,
    returnPercent: (last.close / recent[0].close - 1) * 100,
    startDay: recent[0].day,
    endDay: last.day,
  }
}

export type HistoricalMatch = { startDay: string; endDay: string; followThroughDay: string; distance: number; followThroughReturn: number; closes: number[] }

/** Compare ten-session cumulative-return paths. All candidate outcomes precede the current window. */
export function findHistoricalMatches(candles: Candle[]): HistoricalMatch[] {
  const window = 10
  const horizon = 3
  if (candles.length < window * 2 + horizon) return []
  const currentStart = candles.length - window
  const current = candles.slice(currentStart).map((candle) => candle.close / candles[currentStart].close - 1)
  const candidates: Array<HistoricalMatch & { start: number }> = []
  for (let start = 0; start + window + horizon <= currentStart; start += 1) {
    const end = start + window - 1
    if (candles[start].close <= 0 || candles[end].close <= 0) continue
    const path = candles.slice(start, start + window).map((candle) => candle.close / candles[start].close - 1)
    const distance = Math.sqrt(path.reduce((sum, value, index) => sum + (value - current[index]) ** 2, 0) / window) * 100
    candidates.push({ start, startDay: candles[start].day, endDay: candles[end].day, followThroughDay: candles[end + horizon].day, distance, followThroughReturn: (candles[end + horizon].close / candles[end].close - 1) * 100, closes: path })
  }
  const selected: typeof candidates = []
  for (const candidate of candidates.sort((a, b) => a.distance - b.distance)) {
    if (selected.every((other) => Math.abs(other.start - candidate.start) >= window + horizon)) selected.push(candidate)
    if (selected.length === 3) break
  }
  return selected
}
