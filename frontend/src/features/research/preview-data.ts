import type { MarketSnapshot } from '../workspace/stock-workspace-types'
import type { PredictionSnapshot } from '../chart/chart-types'
import { bollinger, movingAverage } from '../chart/chart-math'
import { aggregateCandles } from '../chart/chart-math'
import { isMinutePeriod, type ChartPeriod } from '../chart/chart-periods'
import type { ChartSeries } from '../chart/chart-market-types'

// Explicit, fictional interaction example. Never returned by a market API or stored under a real security.
export function createPreviewData(): { market: MarketSnapshot; prediction: PredictionSnapshot } {
  const candles: MarketSnapshot['dailyCandles'] = []
  const date = new Date('2024-03-04T00:00:00Z')
  let previous = 28
  while (candles.length < 640) {
    if (date.getUTCDay() > 0 && date.getUTCDay() < 6) {
      const index = candles.length
      const close = 28 + index * 0.055 + Math.sin(index * 0.19) * 1.9 + Math.sin(index * 1.47) * 0.3
      const open = previous + Math.sin(index * 1.3) * 0.23
      candles.push({ day: date.toISOString().slice(0, 10), open, close, high: Math.max(open, close) + 0.2 + (index % 5) * 0.07, low: Math.min(open, close) - 0.23 - (index % 3) * 0.1, volume: 30000000 + (Math.sin(index * 2.1) + 1) * 13000000 })
      previous = close
    }
    date.setUTCDate(date.getUTCDate() + 1)
  }
  const last = candles.at(-1)!
  const extended = [...candles]
  const days = []
  for (let index = 0; index < 3; index++) {
    while (date.getUTCDay() === 0 || date.getUTCDay() === 6) date.setUTCDate(date.getUTCDate() + 1)
    const open = extended.at(-1)!.close
    const candle = { day: date.toISOString().slice(0, 10), open, close: open + 0.32 - index * 0.12, high: open + 0.65, low: open - 0.4, volume: 0 }
    extended.push(candle)
    const boll = bollinger(extended, 20, 2)
    days.push({ ...candle, rangeLow: candle.low - 0.2 * (index + 1), rangeHigh: candle.high + 0.2 * (index + 1), confidence: 0.7 - 0.05 * index, ma5: movingAverage(extended, 5).at(-1)!, ma10: movingAverage(extended, 10).at(-1)!, ma20: boll.middle.at(-1)!, bollUpper: boll.upper.at(-1)!, bollMiddle: boll.middle.at(-1)!, bollLower: boll.lower.at(-1)! })
    date.setUTCDate(date.getUTCDate() + 1)
  }
  return {
    market: { quote: { security: { code: 'DEMO', name: '示例股票', exchange: '交互体验' }, price: last.close, previousClose: candles.at(-2)!.close, open: last.open, high: last.high, low: last.low, volume: last.volume }, dailyCandles: candles, source: { name: '合成示例', fetchedAt: `${last.day}T07:00:00Z`, state: 'DEMO', online: false } },
    prediction: { symbol: 'DEMO', period: 'day', generatedAt: `${last.day}T07:00:00Z`, modelVersion: 'interaction-example', days: [days[0], days[1], days[2]] },
  }
}

export async function loadPreviewSeries(symbol: string, period: ChartPeriod): Promise<ChartSeries> {
  if (symbol !== 'DEMO') throw new Error('示例数据仅限 DEMO 工作区')
  const { market } = createPreviewData()
  let bars = market.dailyCandles
  if (period === 'intraday' || isMinutePeriod(period)) {
    const interval = period === 'intraday' ? 1 : Number(period.slice(0, -1))
    const perDay = 240 / interval
    const dayCount = period === 'intraday' ? 1 : Math.ceil(640 / perDay)
    const dates: string[] = []
    const date = new Date(`${market.dailyCandles.at(-1)!.day}T00:00:00Z`)
    while (dates.length < dayCount) {
      if (date.getUTCDay() > 0 && date.getUTCDay() < 6) dates.unshift(date.toISOString().slice(0, 10))
      date.setUTCDate(date.getUTCDate() - 1)
    }
    const base = market.quote.price
    bars = dates.flatMap((day, dayIndex) => {
      let cumulativeAmount = 0, cumulativeVolume = 0
      return Array.from({ length: perDay }, (_, index) => {
        const minute = (index < perDay / 2 ? 570 + (index + 1) * interval : 780 + (index + 1 - perDay / 2) * interval)
        const time = `${day}T${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}:00+08:00`
        const offset = (dayIndex * perDay + index - dayCount * perDay) * .002
        const close = base + offset + Math.sin(index / 9 + dayIndex * .4) * base * .009
        const open = close + Math.cos(index * 1.4) * base * .002
        const volume = Math.round(20000 + (Math.sin(index * 1.7) + 1) * 8000)
        const turnover = volume * (open + close) / 2
        cumulativeAmount += turnover; cumulativeVolume += volume
        return { day: time, open, close, high: Math.max(open, close) + base * .003, low: Math.min(open, close) - base * .003, volume, turnover, averagePrice: cumulativeAmount / cumulativeVolume }
      })
    }).slice(-640)
  } else bars = aggregateCandles(bars, period)
  return { symbol: 'DEMO', period, adjustment: 'none', kind: period === 'intraday' ? 'intraday' : 'candles', bars, source: market.source, previousClose: market.quote.previousClose, limitedHistory: true, note: '明确标注的合成交互示例，不对应真实证券' }
}
