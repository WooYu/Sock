import type { NoteTagRecord } from '../knowledge/note-tags'
import type { EvidenceRef, ScenarioCondition, ScenarioRule } from './scenario-types'

export const SCENARIO_DEFINITION_VERSION = 'scenario-research-v1'
type Definition = Omit<ScenarioRule, 'version' | 'definitionVersion' | 'semanticKey' | 'evidence'> & { sourceIds: string[] }
const eq = (fact: ScenarioCondition['fact'], value: ScenarioCondition['value']): ScenarioCondition => ({ fact, operator: 'eq', value })
const lt = (fact: ScenarioCondition['fact'], value: number): ScenarioCondition => ({ fact, operator: 'lt', value })
const definitions: Definition[] = [
  { id: 'daily_ma20_entry_filter', name: '日MA20下方的新参与过滤', mode: 'any', period: 'day', action: 'block_entry', holding: 'any',
    conditions: [lt('ma20Distance', 0)], exceptions: [], undefinedConditions: [], explanation: '研究定义：以完整日收盘低于日MA20确认，不自动退出已有持仓。', sourceIds: ['fragment:买股原则2.md:b3-r01'] },
  { id: 'daily_down_ma5_ma10_filter', name: '日MA5与MA10同时向下', mode: 'any', period: 'day', action: 'block_entry', holding: 'any',
    conditions: [lt('ma5Delta', 0), lt('ma10Delta', 0)], exceptions: [], undefinedConditions: [], explanation: '研究定义：两条日均线均低于上一根值。', sourceIds: ['fragment:买股原则2.md:b3-r03'] },
  { id: 'trend_selected_bottom', name: '攀升中的已选日线底线', mode: 'trend_climb', period: 'day', action: 'bottom', holding: 'held',
    conditions: [eq('riseStyle', 'climbing'), eq('modeConfirmed', true)], exceptions: [], undefinedConditions: [],
    explanation: '原文日线持有原则；底线由本次分析明确选择。', sourceIds: ['fragment:盈利模式.md:b1-r06'],
    risk: { kind: 'dynamic_line', condition: '按本次选定日线底线观察持有条件，失守时重新核对退出。' } },
  { id: 'phase3_climb_upper', name: '三期攀升的上轨条件', mode: 'trend_climb', period: 'day', action: 'bottom', holding: 'held',
    conditions: [eq('phase3Opening', true), eq('riseStyle', 'climbing')], exceptions: [], undefinedConditions: ['upper_touch_window'],
    explanation: '“摸不到上轨”的观察窗口尚未定义，不自动触发。', sourceIds: ['fragment:买股原则2.md:b3-r10'] },
  { id: 'surge_stage_two', name: '基础飙升分支的葛二期限', mode: 'trend_climb', period: 'day', action: 'deadline', holding: 'held',
    conditions: [eq('phase3Opening', true), eq('riseStyle', 'surging'), eq('granvilleContext', 'up'), { fact: 'granvilleStage', operator: 'gte', value: 2 }, eq('modeConfirmed', true)],
    exceptions: ['dual_high'], undefinedConditions: [], explanation: '须已确认三期开口、纯飙升及上涨起点；双高分支另行核对。',
    sourceIds: ['fragment:买股原则2.md:b3-r10'], risk: { kind: 'deadline', deadlineStage: 2, condition: '基础飙升分支在日线葛二核对退出期限；双高例外独立判断。' } },
  { id: 'phase3_reset_context', name: '循环起点与双高分支', mode: 'trend_climb', period: 'day', action: 'context', holding: 'any',
    conditions: [eq('phase3Opening', true)], exceptions: [], undefinedConditions: ['compound_reset_definition'],
    explanation: '复合起点尚需人工确认，不用连续上涨天数代替。', sourceIds: ['fragment:买股原则2.md:b3-r11'] },
  { id: 'mirror_roles', name: '照镜子的支撑压力互换', mode: 'mirror_retest', period: 'selected', action: 'context', holding: 'any',
    conditions: [eq('modeConfirmed', true)], exceptions: [], undefinedConditions: [], explanation: '预选线、突破与回抽顺序均须已确认。', sourceIds: ['fragment:照镜子.md:b3-r25'] },
  { id: 'mirror_upper_target', name: '日线照镜子的上轨参考', mode: 'mirror_retest', period: 'day', action: 'target', holding: 'any',
    conditions: [eq('modeConfirmed', true)], exceptions: [], undefinedConditions: [], explanation: '动态日BOLL上轨作为参考，未来上轨另见参数表。',
    sourceIds: ['fragment:盈利模式.md:b1-r21'], risk: { kind: 'dynamic_line', indicator: 'bollUpper', condition: '结合已确认的照镜子分支观察日BOLL上轨；回踩失败时重新核对模式。' } },
  { id: 'mirror_time_context', name: '照镜子两天与等待MA5', mode: 'mirror_retest', period: 'day', action: 'context', holding: 'any',
    conditions: [eq('modeConfirmed', true)], exceptions: [], undefinedConditions: ['mirror_time_exit_definition'],
    explanation: '原文“一般”不是固定退出期限；未定义起算与例外时保留条件不足。', sourceIds: ['fragment:盈利模式.md:b1-r21'] },
  { id: 'rebound_ma5_pressure', name: '下跌反抽的日MA5压力', mode: 'down_rebound', period: 'day', action: 'target', holding: 'any',
    conditions: [eq('modeConfirmed', true)], exceptions: [], undefinedConditions: [], explanation: '只在已确认下跌反抽模式中显示原文日MA5压力。',
    sourceIds: ['fragment:盈利模式.md:b1-r03'], risk: { kind: 'dynamic_line', indicator: 'ma5', condition: '反抽到日MA5后核对能否站回；回抽失败与转强分别记录。' } },
  { id: 'granville_up_anchor', name: '上涨葛起点的原文', mode: 'any', period: 'day', action: 'context', holding: 'any',
    conditions: [eq('granvilleContext', 'up')], exceptions: [], undefinedConditions: [], explanation: '起点来自人工确认；没有编造近线或大阳线幅度。',
    sourceIds: ['fragment:格兰碧_1.md:b2-r11'] },
  { id: 'granville_down_anchor', name: '下跌破五起点的原文', mode: 'any', period: 'day', action: 'context', holding: 'any',
    conditions: [eq('granvilleContext', 'down')], exceptions: [], undefinedConditions: [], explanation: '下跌起点与上涨起点分别计数。',
    sourceIds: ['fragment:格兰碧.md:b3-r06'] },
]
export function buildScenarioRuleRegistry(records: NoteTagRecord[]): ScenarioRule[] {
  const byId = new Map(records.map(r => [r.id, r]))
  return definitions.map(definition => {
    const { sourceIds, ...rule } = definition
    const missing: string[] = [], evidence: EvidenceRef[] = []
    for (const id of sourceIds) {
      const record = byId.get(id)
      if (!record || !/^[a-f0-9]{64}$/.test(record.sourceHash) || !record.evidence.length) { missing.push('source_missing:' + id); continue }
      const unique = new Map(record.evidence.map(e => [e.startLine + ':' + e.endLine + ':' + e.quote, e]))
      for (const e of unique.values()) evidence.push({ recordId: id, tagVersion: record.version, sourceHash: record.sourceHash,
        sourceUrl: record.sourceUrl, startLine: e.startLine, endLine: e.endLine, quote: e.quote })
    }
    return { ...rule, version: 1, definitionVersion: SCENARIO_DEFINITION_VERSION, semanticKey: JSON.stringify([rule.mode, rule.period, rule.action, rule.conditions, rule.exceptions]),
      evidence, undefinedConditions: [...rule.undefinedConditions, ...missing] }
  })
}
