import type { AnalysisAnnotations, AnalysisInput, AnalysisPeriod, PeriodState, RiskReference, RuleApplication, ScenarioRule } from './scenario-types'
import { isIsoTimestamp } from '../chart/chart-periods'
import { annotationsForPeriod, confirmationIsKnown, matchModeCandidates, selectionPeriods } from './scenario-state'

export function evaluateScenarioRules(input: AnalysisInput, states: Partial<Record<AnalysisPeriod, PeriodState>>, annotations: AnalysisAnnotations, registry: ScenarioRule[]): { rules: RuleApplication[]; risk: RiskReference[]; entryBlocked: boolean } {
  const rules = new Map<string, RuleApplication>(), risk = new Map<string, RiskReference>()
  let entryBlocked = false
  for (const period of selectionPeriods(annotations)) {
    const result = evaluateSelectedRules(input, states, annotationsForPeriod(annotations, period), registry)
    entryBlocked ||= result.entryBlocked
    for (const rule of result.rules) {
      const key = rule.ruleId + ':' + rule.period, existing = rules.get(key)
      if (!existing || rule.status === 'adopted' && existing.status !== 'adopted') rules.set(key, rule)
    }
    for (const reference of result.risk) risk.set(reference.id, reference)
  }
  return { rules: [...rules.values()], risk: [...risk.values()], entryBlocked }
}
function evaluateSelectedRules(input: AnalysisInput, states: Partial<Record<AnalysisPeriod, PeriodState>>, annotations: AnalysisAnnotations, registry: ScenarioRule[]): { rules: RuleApplication[]; risk: RiskReference[]; entryBlocked: boolean } {
  const rules: RuleApplication[] = [], risk: RiskReference[] = [], seen = new Map<string, RuleApplication>()
  const candidates = matchModeCandidates(states, annotations)
  let entryBlocked = false
  for (const rule of registry) {
    const period = rule.period === 'selected' ? annotations.mode?.period ?? 'day' : rule.period
    const state = states[period]
    const result: RuleApplication = { ruleId: rule.id, name: rule.name, version: rule.version, definitionVersion: rule.definitionVersion,
      period, status: 'insufficient', reason: '', missing: [], evidence: rule.evidence.map(e => ({ ...e })), conditions: rule.conditions.map(c => ({ ...c })) }
    rules.push(result)
    const disabled = annotations.disabledRules?.[rule.id]
    if (disabled !== undefined) { result.status = disabled.trim() ? 'manual_disabled' : 'insufficient'; result.reason = disabled.trim() || '人工停用需要理由'; continue }
    if (rule.mode !== 'any' && (annotations.mode?.id !== rule.mode || annotations.mode.period !== period)) {
      result.status = 'not_applicable'; result.reason = '本次选择的模式或周期不同'; continue
    }
    if (!state?.bars.length) { result.missing = ['period_data']; result.reason = '缺少该周期完整行情'; continue }
    const signature = JSON.stringify([rule.definitionVersion, rule.mode, period, rule.action, rule.holding,
      rule.conditions.map(c => JSON.stringify([c.fact, c.operator, c.value])).sort(),
      [...rule.exceptions].sort(), [...rule.undefinedConditions].sort(), rule.risk])
    const prior = seen.get(signature)
    if (prior) {
      prior.evidence = [...new Map([...prior.evidence, ...result.evidence].map(e => [e.recordId + ':' + e.sourceHash + ':' + e.tagVersion + ':' + e.startLine + ':' + e.endLine + ':' + e.quote, e])).values()]
      result.status = 'duplicate'; result.reason = '条件、动作与例外相同，合并到 ' + prior.ruleId; continue
    }
    seen.set(signature, result)
    const candidate = candidates.find(m => m.id === rule.mode && m.period === period)
    const flagValue = (name: 'phase3Opening' | 'doubleHigh') => {
      const flag = annotations.flags?.[name]
      return flag && confirmationIsKnown(flag, { ...state, closed: state.bars }, state.kind) ? flag.value : null
    }
    const facts = { ...state.facts, granvilleStage: state.granville.stage, granvilleContext: state.granville.context,
      phase3Opening: flagValue('phase3Opening'), doubleHigh: flagValue('doubleHigh'), riseStyle: state.style,
      modeConfirmed: candidate?.status === 'confirmed', mirrorOutcome: candidate?.mirrorOutcome ?? null }
    result.missing.push(...rule.undefinedConditions)
    if (rule.holding === 'held' && annotations.holding === 'unknown') result.missing.push('holding_context')
    if (rule.holding === 'held' && !annotations.holding) result.missing.push('holding_context')
    if (rule.holding === 'held' && annotations.holding === 'flat') { result.status = 'not_applicable'; result.reason = '该原则适用于已有持仓'; continue }
    let failed = false
    for (const condition of rule.conditions) {
      const actual = facts[condition.fact]
      if (actual == null) { result.missing.push(condition.fact); continue }
      if (condition.operator === 'eq') { if (actual !== condition.value) failed = true }
      else if (typeof actual !== 'number' || typeof condition.value !== 'number') failed = true
      else if (!(condition.operator === 'lt' ? actual < condition.value : condition.operator === 'lte' ? actual <= condition.value
        : condition.operator === 'gt' ? actual > condition.value : actual >= condition.value)) failed = true
    }
    for (const exception of rule.exceptions) {
      if (exception === 'dual_high') {
        if (facts.doubleHigh === null) result.missing.push('doubleHigh_exception')
        else if (facts.doubleHigh) failed = true
      } else result.missing.push('exception:' + exception)
    }
    let riskReference: RiskReference | null = null
    if (rule.action === 'bottom') {
      const bottom = annotations.bottom
      if (!bottom || bottom.period !== period || !bottom.reason.trim() || !isIsoTimestamp(bottom.selectedAt)
        || Date.parse(bottom.selectedAt) > Date.parse(input.asOf)) result.missing.push('selected_bottom')
      else {
        const value = bottom.kind === 'price' ? bottom.price ?? null : bottom.indicator ? state.facts[bottom.indicator] : null
        if (value === null || !Number.isFinite(value) || value <= 0) result.missing.push('bottom_value')
        else riskReference = { id: rule.id + ':' + period, ruleId: rule.id, period, kind: bottom.kind === 'price' ? 'price' : 'dynamic_line',
          ...(bottom.indicator ? { indicator: bottom.indicator } : {}), value, condition: rule.risk?.condition ?? '所选底线失守时重新核对', evidence: result.evidence }
      }
    } else if (rule.risk) {
      const value = rule.risk.indicator ? state.facts[rule.risk.indicator] : null
      if (rule.risk.indicator && (value === null || !Number.isFinite(value) || value <= 0)) result.missing.push('risk_indicator')
      else riskReference = { id: rule.id + ':' + period, ruleId: rule.id, period, ...rule.risk, value, evidence: result.evidence }
    }
    result.missing = [...new Set(result.missing)]
    if (result.missing.length) { result.status = 'insufficient'; result.reason = '条件不足：' + result.missing.join('、') }
    else if (failed) { result.status = 'not_applicable'; result.reason = '已知条件不满足或命中例外：' + rule.explanation }
    else {
      result.status = 'adopted'; result.reason = rule.explanation
      if (rule.action === 'block_entry') entryBlocked = true
      if (riskReference) risk.push(riskReference)
    }
  }
  // These references come from explicit user selections, not a wider interpretation of a daily note.
  const selected = annotations.mode
  const mode = candidates.find(m => m.id === selected?.id && m.period === selected.period)
  const state = selected && states[selected.period]
  if (selected && state && mode) {
    const bottom = annotations.bottom
    if (mode.status === 'confirmed' && mode.id === 'trend_climb' && annotations.holding === 'held'
      && bottom?.period === selected.period && bottom.reason.trim() && isIsoTimestamp(bottom.selectedAt)
      && Date.parse(bottom.selectedAt) <= Date.parse(input.asOf) && !risk.some(r => r.period === bottom.period && r.ruleId === 'trend_selected_bottom')) {
      const value = bottom.kind === 'price' ? bottom.price : bottom.indicator ? state.facts[bottom.indicator] : null
      if (value != null && Number.isFinite(value) && value > 0) risk.push({ id: 'manual_selected_bottom:' + bottom.period,
        ruleId: 'manual_selected_bottom', period: bottom.period, kind: bottom.kind === 'price' ? 'price' : 'dynamic_line',
        ...(bottom.kind === 'indicator' ? { indicator: bottom.indicator } : {}), value,
        condition: '人工选定底线，失守时重新核对模式与退出条件。依据：' + bottom.reason, evidence: [] })
    }
    const mirror = annotations.mirror
    if (mode.id === 'mirror_retest' && mode.status === 'confirmed' && mirror) risk.push({
      id: 'manual_mirror_line:' + selected.period, ruleId: 'manual_mirror_line', period: selected.period, kind: 'price', value: mirror.linePrice,
      condition: mirror.direction === 'up' ? '预选压力转支撑；回踩失守为失败分支，重新站回需另行核对。' : '预选支撑转压力；反抽不能站回为受阻分支，重新站回为转强分支。', evidence: [] })
    if (mode.id === 'range' && annotations.range && (mode.status === 'confirmed' || mode.missing.includes('range_invalidated'))) {
      const range = annotations.range
      if (mode.missing.includes('range_invalidated')) risk.push({ id: 'manual_range_invalid:' + selected.period, ruleId: 'manual_range_invalid',
        period: selected.period, kind: 'condition', value: null, condition: '完整K线收盘越过已确认边界，箱体已失效；重新核对突破或跌破，不沿用区间假设。', evidence: [] })
      else for (const [side, value] of [['lower', range.lower], ['upper', range.upper]] as const) risk.push({
        id: 'manual_range:' + selected.period + ':' + side, ruleId: 'manual_range', period: selected.period, kind: 'price', value,
        condition: side === 'lower' ? '人工确认箱体下界；完整收盘跌破时区间假设失效。' : '人工确认箱体上界；完整收盘突破时区间假设失效。', evidence: [] })
    }
  }
  return { rules, risk, entryBlocked }
}
