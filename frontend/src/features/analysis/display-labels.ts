import type { DecisionAction, RuleConditionField } from '../workspace/stock-workspace-types'

export const ACTION_LABELS: Record<DecisionAction, string> = { ENTER: '买入', HOLD: '持有', REDUCE: '减仓', EXIT: '卖出', AVOID: '回避', WAIT: '等待' }
export const DIRECTION_LABELS = { bullish: '偏多', neutral: '中性', bearish: '偏空' }
export const CONDITION_LABELS: Record<RuleConditionField, string> = {
  closeAboveMa5: '收盘价在 MA5 上方', closeAboveMa20: '收盘价在 MA20 上方', closeAboveBollMiddle: '收盘价在布林中轨上方',
  ma5SlopePositive: 'MA5 向上', bollMiddleSlopePositive: '布林中轨向上', volumeRatio: '量比', supportDistance: '距支撑位',
  granvilleDay: '葛兰碧阶段天数', phase: '当前阶段', marketPanic: '市场恐慌', relativeStrength: '相对强度', phase3Opening: '三期开口', mirrorRetest: '镜像回踩',
}
const modes: Record<string, string> = { BASE_GRANVILLE: '基础葛兰碧', PHASE3_OPENING: '三期开口', SEA_TURTLE: '海龟模式', REBOUND: '反弹模式', MIRROR_RETEST: '镜像回踩', SIDEWAYS_PHASE3: '横盘三期', MONTHLY_WAIT: '月线观察', DEMON_STOCK: '强势股模式', EXCLUSION: '排除条件' }
export function ruleModeLabel(value?: string) { return value ? modes[value] ?? ACTION_LABELS[value as DecisionAction] ?? value : '未定义' }
