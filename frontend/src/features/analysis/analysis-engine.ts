import type { Candle, MarketSnapshot, OperationCycle, StockAnalysis } from '../workspace/stock-workspace-types'

const MIN_HISTORY = 20

export function analyzeMarketSnapshot(
  market: MarketSnapshot,
  cycle: OperationCycle = 'swing',
): StockAnalysis {
  const candles = [...(market.dailyCandles ?? [])].sort((a, b) => a.day.localeCompare(b.day))
  if (candles.length < MIN_HISTORY) {
    return emptyAnalysis('历史数据不足，等待至少20根日K线', ['至少20根日K线'])
  }

  const last = candles[candles.length - 1]
  const ma5 = sma(candles, 5)
  const ma20 = sma(candles, 20)
  const previousMa5 = sma(candles.slice(0, -1), 5)
  const currentBoll = bollinger(candles, 20)
  const previousBoll = bollinger(candles.slice(0, -1), 20)
  const support = Math.min(...candles.slice(-20).map((candle) => candle.low))
  const resistance = Math.max(...candles.slice(-20).map((candle) => candle.high))
  const range = resistance - support
  const volumeRatio = volumeAverageRatio(candles, 5)
  const closeAboveMa20 = last.close >= ma20
  const closeAboveMa5 = last.close >= ma5
  const ma5SlopePositive = ma5 >= previousMa5
  const closeAboveBollMiddle = last.close >= currentBoll.middle
  const trendConfirmed =
    closeAboveMa20 &&
    closeAboveMa5 &&
    ma5SlopePositive &&
    closeAboveBollMiddle &&
    ma5 >= ma20
  const direction: StockAnalysis['direction'] = trendConfirmed
    ? 'bullish'
    : ma5 >= ma20
      ? 'neutral'
      : 'bearish'
  const evidence = [
    {
      id: 'indicator:ma5',
      label: 'MA5 斜率向上',
      detail: `当前 ${ma5.toFixed(2)}，上一值 ${previousMa5.toFixed(2)}`,
    },
    {
      id: 'indicator:boll-middle',
      label: '收盘站上 BOLL 中轨',
      detail: `收盘 ${last.close.toFixed(2)}，中轨 ${currentBoll.middle.toFixed(2)}`,
    },
  ]
  const matchedRules = trendConfirmed
    ? [
        {
          ruleId: 'local-trend-confirmation',
          version: 1,
          name: '趋势、MA5 与 BOLL 中轨确认',
          score: 86,
          band: 'primary',
          action: 'ENTER' as const,
          priority: 50,
          evidence,
        },
      ]
    : []
  const state = market.source.state.toLowerCase()
  const stale = !market.source.online || state === 'stale' || state === 'offline'
  const decision = stale
    ? {
        action: 'WAIT' as const,
        reason: '行情数据已过期或离线，等待刷新后再判断',
        matchedRules: [],
        missingFacts: ['行情新鲜度'],
        conflicts: [],
        invalidationConditions: [],
        evidence: [],
      }
    : trendConfirmed
      ? {
          action: 'ENTER' as const,
          mode: 'baseGranville' as const,
          reason: '命中规则：趋势、MA5 与 BOLL 中轨确认',
          matchedRules,
          missingFacts: [],
          conflicts: [],
          invalidationConditions: ['收盘跌破 MA5', '收盘跌破 BOLL 中轨'],
          evidence,
        }
      : {
          action: 'WAIT' as const,
          reason: '当前没有已确认的适用规则，等待方向确认',
          matchedRules: [],
          missingFacts: [],
          conflicts: [],
          invalidationConditions: [],
          evidence: [],
        }
  const target = decision.action === 'ENTER' ? resistance + range : null
  return {
    support,
    resistance,
    target,
    direction,
    confidence: null,
    directionStrength: trendConfirmed ? 100 : 0,
    matchedRules,
    future: buildFuture(candles, cycle, ma5, ma20, currentBoll),
    decision,
  }
}

function emptyAnalysis(reason: string, missingFacts: string[]): StockAnalysis {
  return {
    support: null,
    resistance: null,
    target: null,
    direction: 'neutral',
    confidence: null,
    directionStrength: 0,
    matchedRules: [],
    future: [],
    decision: {
      action: 'WAIT',
      reason,
      matchedRules: [],
      missingFacts,
      conflicts: [],
      invalidationConditions: [],
      evidence: [],
    },
  }
}

function sma(candles: Candle[], period: number) {
  const values = candles.slice(-period).map((candle) => candle.close)
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function bollinger(candles: Candle[], period: number) {
  const values = candles.slice(-period).map((candle) => candle.close)
  const middle = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - middle) ** 2, 0) / values.length
  const deviation = Math.sqrt(variance)
  return { middle, upper: middle + deviation * 2, lower: middle - deviation * 2 }
}

function volumeAverageRatio(candles: Candle[], period: number) {
  const current = candles[candles.length - 1].volume
  const values = candles.slice(-period).map((candle) => candle.volume)
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  return average === 0 ? 0 : current / average
}

function buildFuture(
  candles: Candle[],
  cycle: OperationCycle,
  ma5: number,
  ma20: number,
  boll: { upper: number; middle: number; lower: number },
) {
  const sessions = cycle === 'short' ? 1 : cycle === 'long' ? 5 : 3
  const result: StockAnalysis['future'] = []
  let day = new Date(candles[candles.length - 1].day)
  for (let index = 0; index < sessions; index += 1) {
    day = nextWeekday(day)
    result.push({
      day: day.toISOString(),
      maValues: { '5': ma5, '20': ma20 },
      bollUpper: boll.upper,
      bollMiddle: boll.middle,
      bollLower: boll.lower,
    })
  }
  return result
}

function nextWeekday(day: Date) {
  const next = new Date(day)
  do {
    next.setUTCDate(next.getUTCDate() + 1)
  } while (next.getUTCDay() === 0 || next.getUTCDay() === 6)
  return next
}
