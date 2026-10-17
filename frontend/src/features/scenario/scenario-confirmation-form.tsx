import { useState, type FormEvent } from 'react'
import type { AnalysisAnnotations, AnalysisInput, AnalysisPeriod, CloseScenario, Confirmation, Indicator, RiseStyle, ScenarioMode, TrendDirection } from './scenario-types'
import { barEndAt } from './scenario-calendar'
import { isIsoTimestamp } from '../chart/chart-periods'
import { INDICATOR_NAMES, MODE_NAMES, PERIOD_NAMES } from './scenario-labels'

export function ScenarioConfirmationForm({ input, period, previous, requiredCloses, busy, onConfirm }: {
  input: AnalysisInput; period: AnalysisPeriod; previous: AnalysisAnnotations; requiredCloses: number; busy: boolean
  onConfirm: (annotations: AnalysisAnnotations, path: CloseScenario | null) => Promise<void>
}) {
  const bars = input.periods[period]?.closed ?? []
  const latest = bars.at(-1)
  const previousTrend = previous.trends?.[period]
  const [direction, setDirection] = useState<TrendDirection>(previousTrend?.direction ?? 'unknown')
  const [style, setStyle] = useState<RiseStyle>(previousTrend?.style ?? 'unknown')
  const [mode, setMode] = useState<ScenarioMode>(previous.mode?.period === period ? previous.mode.id : 'trend_climb')
  const [holding, setHolding] = useState(previous.holding ?? 'unknown')
  const [bottom, setBottom] = useState<string>(previous.bottom?.period === period ? previous.bottom.indicator ?? 'price' : 'ma5')
  const [bottomPrice, setBottomPrice] = useState(previous.bottom?.price?.toString() ?? '')
  const [reason, setReason] = useState('')
  const [shock, setShock] = useState(!!previous.shocks?.[period])
  const [anchor, setAnchor] = useState('')
  const [context, setContext] = useState<'up' | 'down'>('up')
  const [eventKind, setEventKind] = useState<'anchor' | 'reset'>('anchor')
  const [phase3, setPhase3] = useState('unknown'), [dualHigh, setDualHigh] = useState('unknown')
  const [pathKind, setPathKind] = useState<'continuation' | 'pullback'>('pullback')
  const [closesText, setClosesText] = useState(''), [pathReason, setPathReason] = useState('')
  const [linePrice, setLinePrice] = useState(''), [selectedAt, setSelectedAt] = useState('')
  const [breakKey, setBreakKey] = useState(''), [retestKey, setRetestKey] = useState('')
  const [mirrorDirection, setMirrorDirection] = useState<'up' | 'down'>('up'), [tolerance, setTolerance] = useState('')
  const [rangeLow, setRangeLow] = useState(''), [rangeHigh, setRangeHigh] = useState('')
  const [discontinuity, setDiscontinuity] = useState(''), [discontinuityReason, setDiscontinuityReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const barOptions = <><option value="">尚未选择</option>{bars.slice(-60).map(b => <option key={b.day} value={b.day}>{b.day}</option>)}</>
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!latest) return
    setError(null)
    try {
      if (!reason.trim()) throw new Error('请填写本次确认依据。')
      const confirmedAt = new Date().toISOString()
      const c: Confirmation = { period, barKey: latest.day, eventAt: barEndAt(period, latest.day), confirmedAt, reason: reason.trim() }
      const next: AnalysisAnnotations = { ...previous, trends: { ...previous.trends, [period]: { ...c, direction, style } },
        mode: { ...c, id: mode }, holding, shocks: { ...previous.shocks }, flags: { ...previous.flags } }
      if (shock) next.shocks![period] = c
      else delete next.shocks![period]
      next.bottom = bottom === 'price'
        ? { period, kind: 'price', price: Number(bottomPrice), selectedAt: confirmedAt, reason: reason.trim() }
        : { period, kind: 'indicator', indicator: bottom as Indicator, selectedAt: confirmedAt, reason: reason.trim() }
      if (bottom === 'price' && (!Number.isFinite(Number(bottomPrice)) || Number(bottomPrice) <= 0)) throw new Error('请填写正的底线价格。')
      for (const [flag, value] of [['phase3Opening', phase3], ['doubleHigh', dualHigh]] as const) {
        if (value !== 'unknown') next.flags![flag] = { ...c, value: value === 'yes' }
      }
      if (anchor) next.granvilleEvents = [...(previous.granvilleEvents ?? []), { ...c, barKey: anchor, eventAt: barEndAt(period, anchor), context, kind: eventKind }]
      if (mode === 'mirror_retest') {
        if ([linePrice, selectedAt, breakKey, retestKey, tolerance].some(Boolean)) {
          const timestamp = selectedAt + ':00+08:00'
          if (!Number.isFinite(Number(linePrice)) || Number(linePrice) <= 0 || !isIsoTimestamp(timestamp) || !breakKey || !retestKey
            || !tolerance.trim() || !Number.isFinite(Number(tolerance)) || Number(tolerance) < 0) throw new Error('请完整填写照镜子的预选线、选线时点、突破／回抽和容差。')
          next.mirror = { period, linePrice: Number(linePrice), selectedAt: timestamp, breakBarKey: breakKey, retestBarKey: retestKey,
            direction: mirrorDirection, touchTolerance: Number(tolerance) / 100, reason: reason.trim() }
        } else delete next.mirror
      }
      if (mode === 'range') {
        if (rangeLow || rangeHigh) {
          if (!Number.isFinite(Number(rangeLow)) || !Number.isFinite(Number(rangeHigh)) || Number(rangeLow) <= 0 || Number(rangeHigh) <= Number(rangeLow)) throw new Error('请填写有效的箱体上下边界。')
          next.range = { ...c, lower: Number(rangeLow), upper: Number(rangeHigh) }
        } else delete next.range
      }
      if (discontinuity) {
        if (!discontinuityReason.trim()) throw new Error('请填写价格口径事件的原因及来源。')
        next.discontinuities = [...(previous.discontinuities ?? []), { period, barKey: discontinuity, reason: discontinuityReason.trim() }]
      }
      let path: CloseScenario | null = null
      if (closesText.trim()) {
        const closes = closesText.trim().split(/[,，\s]+/).map(Number)
        if (closes.length < requiredCloses || !closes.every(p => Number.isFinite(p) && p > 0) || !pathReason.trim()) throw new Error('请填写覆盖目标根数的正收盘价及情景条件。')
        path = { id: crypto.randomUUID(), symbol: input.symbol, period, originBarKey: latest.day, kind: pathKind, closes,
          selectedAt: confirmedAt, condition: pathReason.trim(), evidence: [] }
      }
      const selections = { ...previous.periodSelections }
      if (previous.mode) selections[previous.mode.period] = { mode: previous.mode, bottom: previous.bottom,
        mirror: previous.mirror, range: previous.range, flags: previous.flags }
      selections[period] = { mode: next.mode!, bottom: next.bottom, mirror: next.mirror, range: next.range, flags: next.flags }
      next.periodSelections = selections
      await onConfirm(next, path)
    } catch (e) { setError(e instanceof Error ? e.message : '确认未完成') }
  }
  return <form className="sa-confirmation" onSubmit={submit} aria-label="人工确认形态与模式">
    <fieldset disabled={busy || !latest}><legend>{PERIOD_NAMES[period]}人工核对 · {latest?.day ?? '暂无完整K线'}</legend>
      <div className="sa-form-grid">
        <label>趋势方向<select aria-label="趋势方向" value={direction} onChange={e => setDirection(e.target.value as TrendDirection)}><option value="unknown">待确认</option><option value="rising">上涨</option><option value="falling">下跌</option><option value="sideways">震荡</option></select></label>
        <label>上涨形态<select aria-label="上涨形态" value={style} onChange={e => setStyle(e.target.value as RiseStyle)}><option value="unknown">尚未区分</option><option value="climbing">攀升</option><option value="surging">飙升</option></select></label>
        <label>盈利模式<select aria-label="盈利模式" value={mode} onChange={e => setMode(e.target.value as ScenarioMode)}>{Object.entries(MODE_NAMES).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label>
        <label>持仓状态<select aria-label="持仓状态" value={holding} onChange={e => setHolding(e.target.value as typeof holding)}><option value="unknown">尚未提供</option><option value="flat">未持仓</option><option value="held">已有持仓</option></select></label>
        <label>本周期风险底线<select aria-label="本周期风险底线" value={bottom} onChange={e => setBottom(e.target.value)}>{Object.entries(INDICATOR_NAMES).map(([id, label]) => <option value={id} key={id}>{PERIOD_NAMES[period]} {label}</option>)}<option value="price">明确价格</option></select></label>
        {bottom === 'price' ? <label>底线价格<input type="number" min="0.01" step="any" value={bottomPrice} onChange={e => setBottomPrice(e.target.value)} /></label> : null}
        <label>葛起点<select aria-label="葛起点" value={anchor} onChange={e => setAnchor(e.target.value)}>{barOptions}</select></label>
        <label>葛语境<select aria-label="葛语境" value={context} onChange={e => setContext(e.target.value as typeof context)}><option value="up">上涨起步</option><option value="down">下跌破五</option></select></label>
        <label>起点事件<select aria-label="起点事件" value={eventKind} onChange={e => setEventKind(e.target.value as typeof eventKind)}><option value="anchor">确认起点</option><option value="reset">确认新起点并重置</option></select></label>
        <label>摸线三期开口<select aria-label="摸线三期开口" value={phase3} onChange={e => setPhase3(e.target.value)}><option value="unknown">待确认</option><option value="yes">人工确认是</option><option value="no">人工确认否</option></select></label>
        <label>双高例外<select aria-label="双高例外" value={dualHigh} onChange={e => setDualHigh(e.target.value)}><option value="unknown">待确认</option><option value="yes">人工确认是</option><option value="no">人工确认否</option></select></label>
      </div>
      <label className="sa-checkbox"><input type="checkbox" checked={shock} onChange={e => setShock(e.target.checked)} />确认{PERIOD_NAMES[period]}大阳线</label>
      <label>确认依据<textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="记录位置、MA/BOLL、量能及本次判断依据" required /></label>
      {mode === 'mirror_retest' ? <div className="sa-form-grid">
        <label>照镜子参考线价格<input type="number" step="any" value={linePrice} onChange={e => setLinePrice(e.target.value)} /></label>
        <label className="sa-wide">实际选线时点（北京时间）<input type="datetime-local" value={selectedAt} onChange={e => setSelectedAt(e.target.value)} /></label>
        <label>突破K线<select aria-label="突破K线" value={breakKey} onChange={e => setBreakKey(e.target.value)}>{barOptions}</select></label>
        <label>回抽K线<select aria-label="回抽K线" value={retestKey} onChange={e => setRetestKey(e.target.value)}>{barOptions}</select></label>
        <label>角色互换<select aria-label="角色互换" value={mirrorDirection} onChange={e => setMirrorDirection(e.target.value as typeof mirrorDirection)}><option value="up">压力转支撑</option><option value="down">支撑转压力</option></select></label>
        <label>触线容差（%）<input type="number" min="0" step="any" value={tolerance} onChange={e => setTolerance(e.target.value)} placeholder="由本次分析明确选择" /></label>
      </div> : null}
      {mode === 'range' ? <div className="sa-form-grid"><label>箱体下边界<input type="number" step="any" value={rangeLow} onChange={e => setRangeLow(e.target.value)} /></label><label>箱体上边界<input type="number" step="any" value={rangeHigh} onChange={e => setRangeHigh(e.target.value)} /></label></div> : null}
      <details><summary>延续／回撤情景与价格口径事件</summary><div className="sa-form-grid">
        <label>条件情景<select aria-label="条件情景" value={pathKind} onChange={e => setPathKind(e.target.value as typeof pathKind)}><option value="pullback">回撤／回踩</option><option value="continuation">上涨延续</option></select></label>
        <label className="sa-wide">假设收盘路径<input value={closesText} onChange={e => setClosesText(e.target.value)} placeholder={'至少' + requiredCloses + '个价格，用逗号分隔'} /></label>
        <label className="sa-wide">情景条件<input value={pathReason} onChange={e => setPathReason(e.target.value)} placeholder="填写预先选定的价位依据或历史路径来源" /></label>
        <label>价格不连续事件K线<select aria-label="价格不连续事件K线" value={discontinuity} onChange={e => setDiscontinuity(e.target.value)}>{barOptions}</select></label>
        <label className="sa-wide">口径事件原因及来源<input value={discontinuityReason} onChange={e => setDiscontinuityReason(e.target.value)} /></label>
      </div></details>
      {error ? <p role="alert">{error}</p> : null}
      <button className="sa-primary" type="submit">{busy ? '正在更新确认依据' : '保存本次人工确认'}</button>
    </fieldset>
  </form>
}
