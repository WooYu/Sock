import { isIsoTimestamp } from '../chart/chart-periods'
import { indicatorSeries } from './scenario-calculator'
import { ANALYSIS_PERIODS, barEndAt } from './scenario-calendar'
import type { AnalysisAnnotations, AnalysisKind, AnalysisPeriod, Confirmation, GranvilleStage, ModeCandidate, PeriodFacts, PeriodInput, PeriodState, ScenarioMode } from './scenario-types'

export function confirmationIsKnown(c: Confirmation | undefined, input: Pick<PeriodInput, 'period' | 'closed' | 'asOf'>, kind: AnalysisKind): boolean {
  if (!c || c.period !== input.period || !c.reason.trim() || !input.closed.some(b => b.day === c.barKey)
    || !isIsoTimestamp(c.eventAt) || !isIsoTimestamp(c.confirmedAt)) return false
  return Date.parse(c.eventAt) >= Date.parse(barEndAt(c.period, c.barKey)) && Date.parse(c.eventAt) <= Date.parse(input.asOf)
    && Date.parse(c.confirmedAt) >= Date.parse(c.eventAt) && (kind === 'replay' || Date.parse(c.confirmedAt) <= Date.parse(input.asOf))
}
export function continuousScenarioInput(input: PeriodInput, annotations: AnalysisAnnotations): PeriodInput {
  const indices = (annotations.discontinuities ?? []).filter(d => d.period === input.period && d.reason.trim())
    .map(d => input.closed.findIndex(b => b.day === d.barKey)).filter(i => i >= 0)
  if (!indices.length) return input
  const closed = input.closed.slice(Math.max(...indices))
  return { ...input, closed, issues: [...new Set([...input.issues, 'price_discontinuity'])] }
}
export function derivePeriodState(original: PeriodInput, annotations: AnalysisAnnotations, kind: AnalysisKind): PeriodState {
  const input = continuousScenarioInput(original, annotations)
  const bars = input.closed
  const indicators = indicatorSeries(bars)
  const current = bars.at(-1), previous = bars.at(-2)
  const last = (key: keyof typeof indicators) => indicators[key].at(-1) ?? null
  const delta = (key: keyof typeof indicators) => {
    const a = last(key), b = indicators[key].at(-2)
    return a !== null && b != null ? a - b : null
  }
  const ma5 = last('ma5'), ma10 = last('ma10'), ma20 = last('ma20')
  const middle = last('bollMiddle'), upper = last('bollUpper'), lower = last('bollLower')
  const priorVolumes = bars.slice(-6, -1).map(b => b.volume)
  const avgVolume = priorVolumes.length === 5 ? priorVolumes.reduce((a, b) => a + b, 0) / 5 : null
  const facts: PeriodFacts = {
    close: current?.close ?? null, ma5, ma10, ma20, ma30: last('ma30'), ma60: last('ma60'), ma90: last('ma90'), ma120: last('ma120'), ma250: last('ma250'), bollUpper: upper, bollMiddle: middle, bollLower: lower,
    ma5Delta: delta('ma5'), ma10Delta: delta('ma10'), ma20Delta: delta('ma20'), bollMiddleDelta: delta('bollMiddle'),
    closeAboveMa5: current && ma5 !== null ? current.close > ma5 : null,
    closeAboveMa20: current && ma20 !== null ? current.close > ma20 : null,
    closeAboveBollMiddle: current && middle !== null ? current.close > middle : null,
    ma5Distance: current && ma5 !== null && ma5 > 0 ? (current.close - ma5) / ma5 : null,
    ma20Distance: current && ma20 !== null && ma20 > 0 ? (current.close - ma20) / ma20 : null,
    bandwidth: middle !== null && middle > 0 && upper !== null && lower !== null ? (upper - lower) / middle : null,
    volumeRatio: current && avgVolume !== null && avgVolume > 0 ? current.volume / avgVolume : null,
    body: current ? Math.abs(current.close - current.open) : null,
    upperWick: current ? current.high - Math.max(current.open, current.close) : null,
    lowerWick: current ? Math.min(current.open, current.close) - current.low : null,
    range: current ? current.high - current.low : null,
    higherHigh: current && previous ? current.high > previous.high : null,
    higherLow: current && previous ? current.low > previous.low : null,
  }
  for (const key of Object.keys(facts) as Array<keyof PeriodFacts>) {
    if (typeof facts[key] === 'number' && !Number.isFinite(facts[key])) Object.assign(facts, { [key]: null })
  }
  const directionCandidate = facts.ma5Delta !== null && facts.ma5Distance !== null
    ? facts.ma5Delta > 0 && facts.ma5Distance > 0 ? 'rising' : facts.ma5Delta < 0 && facts.ma5Distance < 0 ? 'falling' : 'unknown' : 'unknown'
  const trend = annotations.trends?.[input.period]
  const confirmed = confirmationIsKnown(trend, input, kind) && trend?.barKey === bars.at(-1)?.day
  const direction = confirmed ? trend!.direction : directionCandidate
  const events = (annotations.granvilleEvents ?? []).filter(e => confirmationIsKnown(e, input, kind))
    .sort((a, b) => a.barKey.localeCompare(b.barKey) || a.confirmedAt.localeCompare(b.confirmedAt))
  const stageFor = (context: 'up' | 'down'): GranvilleStage => {
    const anchor = events.filter(e => e.context === context).at(-1)
    const index = anchor ? bars.findIndex(b => b.day === anchor.barKey) : -1
    return { anchorBarKey: anchor?.barKey ?? null, stage: index >= 0 ? bars.length - index : null }
  }
  const contextStages = { up: stageFor('up'), down: stageFor('down') }
  const context = events.at(-1)?.context ?? null
  const issues = [...input.issues]
  if (!confirmed) issues.push('trend_requires_confirmation')
  if (trend && !confirmed) issues.push('trend_confirmation_unavailable_at_asof')
  if (!events.length) issues.push('granville_anchor_missing')
  return {
    period: input.period, asOf: input.asOf, kind, facts, bars: bars.map(b => ({ ...b })), directionCandidate, direction,
    style: confirmed && direction === 'rising' ? trend!.style : 'unknown', confirmed,
    shockConfirmed: confirmationIsKnown(annotations.shocks?.[input.period], input, kind),
    granville: { ...(context ? contextStages[context] : { anchorBarKey: null, stage: null }), context,
      events: events.map(e => ({ ...e })), contextStages }, issues,
  }
}
export function annotationsForPeriod(annotations: AnalysisAnnotations, period: AnalysisPeriod): AnalysisAnnotations {
  if (annotations.mode?.period === period) return annotations
  const selection = annotations.periodSelections?.[period]
  return { ...annotations, mode: selection?.mode, bottom: selection?.bottom, mirror: selection?.mirror,
    range: selection?.range, flags: selection?.flags }
}
export function selectionPeriods(annotations: AnalysisAnnotations): AnalysisPeriod[] {
  const primary = annotations.mode?.period ?? annotations.mirror?.period ?? annotations.range?.period ?? 'day'
  return [primary, ...ANALYSIS_PERIODS.filter(p => p !== primary && annotations.periodSelections?.[p]?.mode.period === p)]
}
export function matchModeCandidates(states: Partial<Record<AnalysisPeriod, PeriodState>>, annotations: AnalysisAnnotations): ModeCandidate[] {
  return selectionPeriods(annotations).flatMap(period => matchSelectedModeCandidates(states, annotationsForPeriod(annotations, period)))
}
export function matchSelectedModeCandidates(states: Partial<Record<AnalysisPeriod, PeriodState>>, annotations: AnalysisAnnotations, period: AnalysisPeriod = annotations.mode?.period ?? annotations.mirror?.period ?? annotations.range?.period ?? 'day'): ModeCandidate[] {
  const state = states[period]
  const kinds: ScenarioMode[] = ['trend_climb', 'mirror_retest', 'down_rebound', 'range']
  return kinds.map(id => {
    const missing: string[] = []
    let mirrorOutcome: ModeCandidate['mirrorOutcome']
    let notApplicable = false
    if (!state?.bars.length) missing.push('period_data')
    else if (id === 'trend_climb') {
      if (!state.confirmed) missing.push('confirmed_trend')
      if (state.direction !== 'rising') { if (state.confirmed) notApplicable = true; else missing.push('rising_context') }
      if (state.style !== 'climbing' && state.style !== 'surging') missing.push('rise_style_definition')
      if (!annotations.bottom || annotations.bottom.period !== period) missing.push('selected_bottom')
    } else if (id === 'down_rebound') {
      const background = states.day ?? state
      if (!background.confirmed) missing.push('confirmed_background')
      if (background.direction !== 'falling') { if (background.confirmed) notApplicable = true; else missing.push('falling_background') }
      if (state.facts.ma5 === null) missing.push('ma5')
    } else if (id === 'range') {
      const range = annotations.range
      if (!range || !confirmationIsKnown(range, { ...state, closed: state.bars }, state.kind)
        || !Number.isFinite(range.lower) || !Number.isFinite(range.upper) || range.lower <= 0 || range.upper <= range.lower) missing.push('confirmed_range_boundaries')
      else if (state.facts.close !== null && (state.facts.close < range.lower || state.facts.close > range.upper)) {
        notApplicable = true; missing.push('range_invalidated')
      }
    } else {
      const mirror = annotations.mirror
      if (!mirror || mirror.period !== period || !Number.isFinite(mirror.linePrice) || mirror.linePrice <= 0) missing.push('selected_line')
      else {
        const breakIndex = state.bars.findIndex(b => b.day === mirror.breakBarKey)
        const retestIndex = state.bars.findIndex(b => b.day === mirror.retestBarKey)
        if (!isIsoTimestamp(mirror.selectedAt) || breakIndex < 0
          || Date.parse(mirror.selectedAt) > Date.parse(barEndAt(period, mirror.breakBarKey))) missing.push('preselected_line')
        if (breakIndex < 0 || retestIndex <= breakIndex) missing.push('ordered_break_and_retest')
        if (mirror.touchTolerance === null || !Number.isFinite(mirror.touchTolerance) || mirror.touchTolerance < 0) missing.push('touch_tolerance')
        if (!missing.length) {
          const broken = state.bars[breakIndex], retest = state.bars[retestIndex], line = mirror.linePrice, tolerance = mirror.touchTolerance!
          const breakConfirmed = mirror.direction === 'up' ? broken.close > line : broken.close < line
          if (!breakConfirmed) missing.push('break_not_confirmed')
          const touched = retest.low <= line * (1 + tolerance) && retest.high >= line * (1 - tolerance)
          if (!touched) missing.push('retest_not_confirmed')
          if (breakConfirmed && touched) mirrorOutcome = mirror.direction === 'up'
            ? retest.close >= line ? 'support_confirmed' : 'support_failed'
            : retest.close <= line ? 'resistance_confirmed' : 'turned_stronger'
        }
      }
    }
    const modeConfirmed = state && annotations.mode?.id === id
      && confirmationIsKnown(annotations.mode, { ...state, closed: state.bars }, state.kind)
    return { id, period, status: notApplicable ? 'not_applicable' : missing.length ? 'insufficient' : modeConfirmed ? 'confirmed' : 'candidate',
      missing: [...new Set(missing)], ...(mirrorOutcome ? { mirrorOutcome } : {}), evidence: [] }
  })
}
