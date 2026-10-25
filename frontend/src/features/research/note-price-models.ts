import sources from './note-price-sources.json'
import { indicatorSeries } from '../scenario/scenario-calculator'
import { barEndAt, futureBarTargets } from '../scenario/scenario-calendar'
import { validCandle } from '../scenario/scenario-inputs'
import { isCalendarDate, isIsoTimestamp } from '../chart/chart-periods'
import type { AnalysisInput, BarTarget, Horizon } from '../scenario/scenario-types'

export const NOTE_PRICE_VERSION = 'note-price-research-v1'
export type NotePriceConfig = { upperMapping: 1 | 2; touchBars: number; touchDistance: number }
export const DEFAULT_NOTE_PRICE_CONFIG: NotePriceConfig = { upperMapping: 2, touchBars: 3, touchDistance: .01 }
export type NotePriceModelId = 'ma5_boundary' | 'climb_high' | 'rebound_high'
export type NotePriceSource = typeof sources.ma5
export type NotePriceRuleCard = {
  id: NotePriceModelId; version: string; name: string; role: 'boundary' | 'high'; source: NotePriceSource
  formula: string; researchDefinition: string; invalidation: string; validation: 'not_validated'
}
export const NOTE_PRICE_CARDS: NotePriceRuleCard[] = [
  { id: 'ma5_boundary', version: NOTE_PRICE_VERSION, name: '明日收盘站上MA5的临界价', role: 'boundary', source: sources.ma5,
    formula: 'x >= (最近4根收盘之和 + x) / 5 ⇒ x >= 最近4根收盘均值',
    researchDefinition: '由原文MA5定义作代数推导，计算条件阈值；不是明日收盘预测。',
    invalidation: '日线不完整、行情口径变化或不足4根时不计算。', validation: 'not_validated' },
  { id: 'climb_high', version: NOTE_PRICE_VERSION, name: '攀升高点／上轨假设', role: 'high', source: sources.climb,
    formula: '上轨估计 = U(t) + [U(t) - U(t-2)] / 2 × 指标目标根数',
    researchDefinition: '程序研究定义：MA5向上，连续N根收盘距各自BOLL20/2上轨不超过阈值。价格目标为下一根日K最高；指标目标另选第1或第2根。参数与外推法不是原文承诺。',
    invalidation: '贴轨或向上条件不成立、不足完整历史时不输出；下一窗口未延续攀升也保留为失败样本。', validation: 'not_validated' },
  { id: 'rebound_high', version: NOTE_PRICE_VERSION, name: '下跌反抽MA5高点假设', role: 'high', source: sources.rebound,
    formula: '反抽高点代理 = MA5(t) + [MA5(t) - MA5(t-2)] / 2',
    researchDefinition: '程序研究定义：完整收盘低于MA5且MA5向下；将下一根MA5外推作次日最高的实验代理。原文是动态压力线，代理不保证一定反抽或触及。',
    invalidation: '收盘已在MA5上或MA5未向下时不适用；持续下跌没有反抽仍计失败，不事后删样本。', validation: 'not_validated' },
]
export type NotePriceResult = {
  card: NotePriceRuleCard; status: 'computed' | 'not_applicable' | 'insufficient'; reason: string
  value: number | null; priceTarget: BarTarget; indicatorTarget: BarTarget | null
  inputs: Record<string, number>; baselines: { previousHigh: number; previousClose: number; unconditional: number | null }
}
export type NotePriceRun = {
  definitionVersion: typeof NOTE_PRICE_VERSION; symbol: string; asOf: string; origin: string | null
  adjustment: 'none' | 'qfq' | null; config: NotePriceConfig; results: NotePriceResult[]
}

export function validNotePriceConfig(config: NotePriceConfig): boolean {
  return !!config && [1, 2].includes(config.upperMapping) && Number.isInteger(config.touchBars)
    && config.touchBars >= 1 && config.touchBars <= 10 && Number.isFinite(config.touchDistance)
    && config.touchDistance > 0 && config.touchDistance <= .1
}

/** Uses complete, as-of-known candles only. Research conditions never create a human confirmation. */
export function runNotePriceModels(input: AnalysisInput, config: NotePriceConfig = DEFAULT_NOTE_PRICE_CONFIG): NotePriceRun {
  if (!validNotePriceConfig(config)) throw new Error('研究定义无效：贴轨根数1～10，距离大于0且不超过10%，指标根数为1或2。')
  const day = input.periods.day
  const bars = day?.closed ?? []
  const origin = bars.at(-1) ?? null
  let problem = ''
  if (!day || !origin) problem = '缺少完整日线'
  else if (!isIsoTimestamp(input.asOf) || day.asOf !== input.asOf || day.symbol !== input.symbol || day.period !== 'day'
    || !['none', 'qfq'].includes(day.adjustment) || !isIsoTimestamp(day.source.fetchedAt)) problem = '行情时间或价格口径不一致'
  else if (bars.some((bar, i) => !validCandle(bar) || !isCalendarDate(bar.day)
    || Date.parse(barEndAt('day', bar.day)) > Math.min(Date.parse(input.asOf), Date.parse(day.source.fetchedAt))
    || i > 0 && bar.day <= bars[i - 1].day)) problem = '包含未结束、无效或重复日线'
  const calendar = input.calendar && Date.parse(input.calendar.verifiedAt) <= Date.parse(input.asOf) ? input.calendar : null
  const target = (horizon: Horizon): BarTarget => origin && !problem
    ? futureBarTargets('day', origin.day, [horizon], calendar)[0]
    : { horizon, barKey: null, endAt: null, issues: ['history_insufficient'] }
  const indicators = !problem ? indicatorSeries(bars) : null
  const ma5 = indicators?.ma5.at(-1) ?? null, priorMa5 = indicators?.ma5.at(-2) ?? null
  const meanDelta = (key: 'ma5' | 'bollUpper', horizon: number) => {
    const last = indicators?.[key].at(-1), earlier = indicators?.[key].at(-3)
    return last != null && earlier != null ? last + (last - earlier) / 2 * horizon : null
  }
  const results = NOTE_PRICE_CARDS.map(card => {
    const result: NotePriceResult = { card: structuredClone(card), status: 'insufficient', reason: problem || '完整历史不足', value: null,
      priceTarget: target(1), indicatorTarget: card.id === 'ma5_boundary' ? target(1) : target(card.id === 'climb_high' ? config.upperMapping : 1),
      inputs: {}, baselines: { previousHigh: origin?.high ?? 0, previousClose: origin?.close ?? 0,
        unconditional: card.id === 'ma5_boundary' ? null : meanDelta(card.id === 'climb_high' ? 'bollUpper' : 'ma5', card.id === 'climb_high' ? config.upperMapping : 1) } }
    if (problem || !origin) return result
    if (card.id === 'ma5_boundary') {
      if (bars.length < 4) return result
      const closes = bars.slice(-4).map(bar => bar.close)
      result.inputs = Object.fromEntries(closes.map((close, i) => ['close' + (i + 1), close]))
      result.value = closes.reduce((sum, close) => sum + close, 0) / 4
    } else {
      const estimate = result.baselines.unconditional
      if (ma5 === null || priorMa5 === null || estimate === null || !indicators) return result
      result.inputs = { ma5, previousMa5: priorMa5, close: origin.close }
      let applies: boolean
      if (card.id === 'climb_high') {
        if (bars.length < 20 + config.touchBars - 1) return result
        const distances = bars.slice(-config.touchBars).map((bar, i) => {
          const upper = indicators.bollUpper[bars.length - config.touchBars + i]
          return upper != null && upper > 0 ? Math.abs(bar.close - upper) / upper : Infinity
        })
        applies = ma5 > priorMa5 && distances.every(distance => distance <= config.touchDistance)
        result.inputs = { ...result.inputs, upper: indicators.bollUpper.at(-1)!, upperTwoBarsAgo: indicators.bollUpper.at(-3)!,
          maxObservedDistance: Math.max(...distances), touchBars: config.touchBars, maxAllowedDistance: config.touchDistance }
      } else applies = origin.close < ma5 && ma5 < priorMa5
      if (!applies) return { ...result, status: 'not_applicable' as const, reason: '原点行情不满足本卡的程序研究条件' }
      result.value = estimate
    }
    if (result.value === null || !Number.isFinite(result.value) || result.value <= 0) return { ...result, value: null, reason: '算式未产生有效正价格' }
    return { ...result, status: 'computed' as const, reason: card.role === 'boundary' ? '代数临界价已算出，不是收盘预测' : '条件成立，生成待验证的次日高点假设' }
  })
  return { definitionVersion: NOTE_PRICE_VERSION, symbol: input.symbol, asOf: input.asOf, origin: origin?.day ?? null,
    adjustment: day?.adjustment ?? null, config: { ...config }, results }
}
