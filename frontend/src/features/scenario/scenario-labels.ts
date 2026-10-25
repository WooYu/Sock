import type { AnalysisPeriod, Indicator, ScenarioMode } from './scenario-types'
export const PERIOD_NAMES: Record<AnalysisPeriod, string> = { day: '日线', '60m': '1小时', '30m': '30分钟', '15m': '15分钟' }
export const INDICATOR_NAMES: Record<Indicator, string> = { ma5: 'MA5', ma10: 'MA10', ma20: 'MA20', ma30: 'MA30', ma60: 'MA60', ma90: 'MA90', ma120: 'MA120', ma250: 'MA250', bollUpper: 'BOLL上轨', bollMiddle: 'BOLL中轨', bollLower: 'BOLL下轨' }
export const MODE_NAMES: Record<ScenarioMode, string> = { trend_climb: '上涨趋势', mirror_retest: '照镜子回抽', down_rebound: '下跌反抽', range: '箱体震荡' }
export const DIRECTION_NAMES = { rising: '上涨', falling: '下跌', sideways: '震荡', unknown: '待确认' }
export const STYLE_NAMES = { climbing: '攀升', surging: '飙升', unknown: '尚未区分' }
export const RULE_STATUS_NAMES = { adopted: '已采用', not_applicable: '不适用', insufficient: '条件不足', duplicate: '重复引用', manual_disabled: '人工停用' }
export const METHOD_NAMES = { average_delta: '前三后三平均增量', last_delta: '最近一根增量对照', rolling_close: '收盘情景滚动重算' }
const issues: Record<string, string> = {
  path_origin_changed: '完整K线原点已变化', path_horizon_insufficient: '路径长度不足以覆盖所选根数',
  range_invalidated: '完整收盘已越过箱体边界，区间假设失效',
  calendar_missing: '交易日历未核实', calendar_invalid: '交易日历格式无效', calendar_out_of_range: '目标超出已核实日历',
  calendar_history_unverified: '历史交易日历未核实，未补齐缺失K线', calendar_origin_not_trading: '原点不在已核实交易日历中',
  history_insufficient: '完整K线历史不足', closed_history_empty: '没有已结束的有效K线', limited_history: '来源提供的历史范围有限',
  invalid_boll_order: 'BOLL轨道次序无效', invalid_boll_values: 'BOLL缺少有效轨道', nonpositive_reference: '参考位不是正价格',
  nonfinite_reference: '计算结果无效', price_discontinuity: '已按价格不连续事件重新起算',
  trend_requires_confirmation: '趋势形态需人工核对', trend_confirmation_unavailable_at_asof: '该确认不适用于当前原点',
  granville_anchor_missing: '尚未确认葛起点', confirmed_trend: '趋势未人工确认', rising_context: '上涨背景未确认',
  confirmed_background: '日线背景未人工确认', falling_background: '下跌背景未确认', rise_style_definition: '攀升或飙升尚未区分',
  selected_bottom: '尚未选择对应周期底线', selected_line: '尚未选定照镜子参考线', preselected_line: '缺少突破前选线记录',
  ordered_break_and_retest: '突破与回抽顺序未确认', touch_tolerance: '触线容差未定义', break_not_confirmed: '突破尚未确认',
  retest_not_confirmed: '回抽尚未确认', confirmed_range_boundaries: '箱体上下边界未确认', period_data: '该周期行情不足',
  phase3Opening: '摸线三期开口状态', doubleHigh_exception: '双高例外状态', upper_touch_window: '上轨触及的观察窗口',
  compound_reset_definition: '复合形态的重置定义', mirror_time_exit_definition: '照镜子时间退出条件', holding_context: '持仓状态',
  bottom_value: '底线指标历史不足', risk_indicator: '风险参考指标历史不足', granvilleStage: '葛阶段', granvilleContext: '葛语境',
  modeConfirmed: '模式尚未确认', mirrorOutcome: '回抽结果', riseStyle: '上涨形态',
  not_a_live_forward_plan: '该记录是回放，不能计为盘前实盘计划', plan_after_window_start: '计划在执行窗口开始后生成',
  invalid_execution_window: '执行窗口时间无效', window_not_finished: '执行窗口尚未结束', finer_bars_required: '此窗口需要更小周期K线',
  execution_bars_missing: '执行窗口行情缺失', coverage_calendar_unverified: '跨日窗口的交易日历未核实',
  no_planned_valid_references: '缺少为此窗口预先保存的有效参考位', target_indicator_unavailable: '目标K线或指标尚不可用',
  adjustment_basis_changed: '复权基准已变化，暂不跨基准评分', invalid_reference: '参考位无效', actual_symbol_or_adjustment_mismatch: '核对行情的股票或价格口径不同', actual_period_mismatch: '核对行情周期不同',
}
export function issueLabel(issue: string): string {
  if (issue.startsWith('source_missing:')) return '缺少对应原文版本'
  if (issue.startsWith('invalid_ohlc:')) return 'K线价格数据无效：' + issue.slice(13)
  if (issue.startsWith('missing_bar:')) return '交易时段缺柱：' + issue.slice(12)
  if (issue.startsWith('conflicting_duplicate:')) return '同一K线存在冲突数据'
  return issues[issue] ?? issue.replace(/^day：/, '日线：').replace(/^60m：/, '1小时：').replace(/^30m：/, '30分钟：').replace(/^15m：/, '15分钟：')
}
export function displayTime(value: string | null): string {
  if (!value) return '待核实'
  if (!value.includes('T')) return value
  return new Date(Date.parse(value) + 8 * 3600_000).toISOString().slice(0, 16).replace('T', ' ') + ' +08:00'
}
