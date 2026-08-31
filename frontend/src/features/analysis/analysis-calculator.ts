import type { Candle, Security, StockAnalysis } from '../workspace/stock-workspace-types'

const WINDOW = 20

export type CalculatedStockAnalysis = StockAnalysis & {
  status: 'ready' | 'waiting'
  reason: string
  indicators: NonNullable<StockAnalysis['indicators']>
}

export function calculateStockAnalysis(security: Security, candles: Candle[]): CalculatedStockAnalysis {
  if (candles.length < WINDOW) return waitingAnalysis()

  const recent = candles.slice(-WINDOW)
  const closes = recent.map((candle) => candle.close)
  const ma5 = average(closes.slice(-5))
  const ma10 = average(closes.slice(-10))
  const ma20 = average(closes)
  const deviation = Math.sqrt(average(closes.map((close) => (close - ma20) ** 2)))
  const bollMiddle = round(ma20)
  const bollUpper = round(ma20 + deviation * 2)
  const bollLower = round(ma20 - deviation * 2)
  const support = round(Math.min(...recent.map((candle) => candle.low)))
  const resistance = round(Math.max(...recent.map((candle) => candle.high)))
  const latest = closes.at(-1) ?? ma20
  const direction = latest > ma20 && ma5 >= ma20 ? 'bullish' : latest < ma20 && ma5 <= ma20 ? 'bearish' : 'neutral'
  const directionStrength = round(Math.min(1, Math.abs(latest - ma20) / ma20 * 5))
  const confidence = round(0.5 + directionStrength * 0.4)
  const target = round(resistance + Math.max(0, resistance - support) * 0.5)
  const indicators = { ma5: round(ma5), ma10: round(ma10), ma20: bollMiddle, bollUpper, bollMiddle, bollLower }

  return {
    status: 'ready',
    reason: `基于${security.name}最近${WINDOW}个交易日 K 线计算。`,
    indicators,
    support,
    resistance,
    target,
    direction,
    confidence,
    directionStrength,
    matchedRules: [],
    future: [1, 2, 3].map((offset) => futureIndicator(offset, indicators, latest - (candles.at(-2)?.close ?? latest))),
  }
}

function waitingAnalysis(): CalculatedStockAnalysis {
  return {
    status: 'waiting',
    reason: `至少需要${WINDOW}根日线 K 线，当前数据不足，暂不判断。`,
    indicators: { ma5: 0, ma10: 0, ma20: 0, bollUpper: 0, bollMiddle: 0, bollLower: 0 },
    support: 0,
    resistance: 0,
    target: 0,
    direction: 'neutral',
    confidence: 0,
    directionStrength: 0,
    matchedRules: [],
    future: [],
  }
}

function futureIndicator(offset: number, base: NonNullable<StockAnalysis['indicators']>, slope: number) {
  const maShift = slope * offset * 0.35
  return {
    day: `T+${offset}`,
    maValues: { MA5: round(base.ma5 + maShift), MA10: round(base.ma10 + maShift * 0.7), MA20: round(base.ma20 + maShift * 0.4) },
    bollUpper: round(base.bollUpper + maShift),
    bollMiddle: round(base.bollMiddle + maShift * 0.4),
    bollLower: round(base.bollLower + maShift),
  }
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function round(value: number) {
  return Math.round(value * 100) / 100
}
