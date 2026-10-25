import type { DailyPriceLimit, ScenarioAnalysis } from './scenario-types'
import { ANALYSIS_PERIODS } from './scenario-calendar'
import { displayTime, INDICATOR_NAMES, METHOD_NAMES, PERIOD_NAMES } from './scenario-labels'
import { roundDailyPrice } from './scenario-price-ladder'

function signedPercent(value: number, close: number) {
  const percent = (value - close) / close * 100
  return (percent >= 0 ? '+' : '') + percent.toFixed(2) + '%'
}

export function ScenarioPriceSummary({ analysis, autoLimit, limitChoice = 'auto', onLimitChange }: {
  analysis: ScenarioAnalysis; loading: boolean
  autoLimit?: DailyPriceLimit; limitChoice?: string
  onLimitChange?: (choice: string) => void
}) {
  const definition = analysis.consolidation
  const ladder = analysis.dailyPriceLadder
  const included = ANALYSIS_PERIODS.filter(period => analysis.mergedLevels.some(g => g.references.some(r => r.period === period)))
  const missing = ANALYSIS_PERIODS.filter(period => !included.includes(period) && (analysis.input.periods[period] || analysis.input.loadIssues[period]))
  return <section className="sa-section sa-price-summary" aria-label="跨周期综合结果">
    <h3>跨周期综合结果{definition ? ' · 1%合并平均价' : ' · 历史原值'}</h3>
    <p role="status">本次采用：{included.length ? included.map(period => PERIOD_NAMES[period]).join(' / ') : '暂无有效周期'} · {analysis.mergedLevels.length}组综合参考价</p>
    {definition ? <p className="sa-time">方法：{METHOD_NAMES[definition.method]}。MA/BOLL参考位按价格归组，每组原始参考位等权取算术平均。</p>
      : <p className="sa-note">此历史快照未记录1%合并口径，保留当时保存的价位。返回当前分析可按新口径重算。</p>}
    {missing.map(period => <p className="sa-time" key={period}>{PERIOD_NAMES[period]}{analysis.input.loadIssues[period]?.length ? '读取失败或数据不足'
      : analysis.input.periods[period] ? '没有可合并的有效参考位' : '尚未加入'}</p>)}
    {ANALYSIS_PERIODS.filter(period => analysis.input.periods[period]?.source.online === false).map(period => <p className="sa-note" key={period}>
      {PERIOD_NAMES[period]}使用离线缓存 · 采集 {displayTime(analysis.input.periods[period]!.source.fetchedAt)}</p>)}
    {definition?.method === 'rolling_close' ? <details><summary>本次各周期的条件路径</summary>{ANALYSIS_PERIODS.map(period => {
      const path = analysis.scenarios.find(s => s.id === definition.scenarioIds[period] && s.period === period)
      return path ? <p className="sa-time" key={period}>{PERIOD_NAMES[period]}：{path.condition}</p> : null
    })}</details> : null}
    {ladder ? <div className="sa-daily-ladder" aria-label="单日价格阶梯">
      <div className="sa-controls sa-price-controls">
        <label>单日涨跌幅规则<select aria-label="单日涨跌幅规则" disabled={!onLimitChange} value={limitChoice}
          onChange={e => onLimitChange?.(e.target.value)}>
          <option value="auto">自动识别 · {autoLimit?.label ?? ladder.selection.limit.label}</option>
          {[0.05, 0.1, 0.2, 0.3].map(ratio => <option key={ratio} value={ratio}>手动设定 ±{ratio * 100}%</option>)}
          <option value="unverified">不限幅／规则待核实</option></select></label>
      </div>
      {ladder.anchor ? <div className="sa-close-anchor"><strong>基准收盘价 {ladder.anchor.close.toFixed(2)}</strong><span>0.00% · {ladder.anchor.barKey} 已完成日K</span>
        {ladder.band ? <p>单日区间 {ladder.band.lower.toFixed(2)}～{ladder.band.upper.toFixed(2)} <small>{signedPercent(ladder.band.lower, ladder.anchor.close)}～{signedPercent(ladder.band.upper, ladder.anchor.close)}</small></p> : null}</div> : null}
      <p className="sa-time">{ladder.selection.limit.label}。此区间用于基准收盘后的一个交易日，百分比均相对该收盘价；具体交易日期待日历核实。</p>
      {ladder.selection.limit.source === 'board_default' ? <p className="sa-note">按股票代码推定常规规则，尚未核实风险警示、上市初期和除权参考价；特殊情况请调整规则。</p> : null}
      {ladder.selection.limit.source === 'manual' ? <p className="sa-time">涨跌幅由你手动设定，保存时一并记录。</p> : null}
      {ladder.definitionVersion === 'daily-close-ladder-v1' ? <p className="sa-note">此历史版本保留当时的固定档数和等分补位；返回当前分析可查看全部实际计算价位。</p> : null}
      {ladder.issues.map(issue => <p className="sa-note" key={issue}>{({ daily_close_missing: '缺少完整日K收盘价，暂不生成单日价位。',
        daily_close_invalid: '日K收盘数据未通过校验，暂不生成单日价位。', price_limit_unverified: '请选择适用的涨跌幅规则；不限幅或规则待核实时，暂不生成有边界的价位。',
        daily_close_stale: '日线收盘已落后于已确认完成的交易日，请刷新日线后再计算单日价位。',
        price_limit_tick_unverified: '价格取整后至少一侧区间与收盘价重合，需核实最小价格变动规则，暂不生成档位。',
        insufficient_price_ticks: '受0.01元最小价位限制，区间内不足指定档数，已列出可用的不重复价位。' } as Record<string, string>)[issue] ?? issue}</p>)}
      {ladder.band ? <><div className="sa-ladder-sides">{(['up', 'down'] as const).map(side => <section key={side} aria-label={side === 'up' ? '收盘价上方' : '收盘价下方'}>
        <h4>{side === 'up' ? '上方观察价' : '下方观察价'} · {ladder[side].length}个</h4>
        {!ladder[side].length ? <p className="sa-time">本侧暂无范围内的计算价位。</p> : null}
        {ladder[side].map((level, index) => {
          const sources = analysis.mergedLevels.filter(group => level.groupIds.includes(group.id)).flatMap(group => group.references)
          const periods = ANALYSIS_PERIODS.filter(period => sources.some(ref => ref.period === period))
          return <article className={'sa-ladder-level sa-ladder-' + side} key={level.id} aria-label={(side === 'up' ? '上方参考价' : '下方参考价') + (index + 1)}>
            <div><strong>{level.value.toFixed(2)}</strong><span>{signedPercent(level.value, ladder.anchor!.close)}</span></div>
            <small>{level.kind === 'merged' ? 'MA/BOLL合并位 · ' + periods.map(p => PERIOD_NAMES[p]).join(' / ') : '区间参考位 · 等分补位'}</small>
          </article>
        })}</section>)}</div>
        <p className="sa-time">{ladder.definitionVersion === 'daily-close-ladder-v1' ? '以上展示此历史版本保存的价位。'
          : '展示范围内全部实际计算的合并价位，按距收盘价由近到远排列，每个价位保留计算来源。'}</p>
        <p className="sa-time">{ladder.excludedGroupIds.length}组原始合并价超出单日区间，未纳入上下档位。原始值仍保留在下方。</p></> : null}
    </div> : <p className="sa-note">此历史快照未记录单日区间与收盘价阶梯，以下保留原始结果。</p>}
    <details className="sa-original-groups"><summary>查看全部原始合并价位 · {analysis.mergedLevels.length}组</summary>
    <div className="sa-price-groups">{analysis.mergedLevels.map((group, index) => {
      const values = group.references.map(r => r.value!), low = Math.min(...values), high = Math.max(...values)
      const spread = (high - low) / (high / 2 + low / 2)
      const periods = ANALYSIS_PERIODS.filter(period => group.references.some(r => r.period === period))
      return <article className="sa-price-group" key={group.id} aria-label={'综合参考价组' + (index + 1)}>
        <span className="sa-time">{definition ? '平均参考价' : '原合并参考价'}</span><strong className="sa-price-value" title={'未取整原值 ' + group.value}>{(ladder ? roundDailyPrice(group.value) : group.value).toFixed(2)}</strong>
        {ladder?.anchor ? <p>相对基准收盘 {signedPercent(roundDailyPrice(group.value), ladder.anchor.close)}{ladder.excludedGroupIds.includes(group.id) ? ' · 超出单日区间' : ''}</p> : null}
        <p>{periods.map(p => PERIOD_NAMES[p]).join(' / ')} · {group.references.length}个参考位</p>
        <small>原值范围 {low.toFixed(2)}–{high.toFixed(2)} · 最大相差 {(spread * 100).toFixed(2)}%</small>
        <details><summary>查看原始价位与来源</summary><ul className="sa-price-sources">{group.references.map(ref => <li key={ref.id}>
          <span>{PERIOD_NAMES[ref.period]} {INDICATOR_NAMES[ref.indicator]} · 未来第{ref.target.horizon}根<small>{ref.target.barKey ? displayTime(ref.target.barKey) : '目标日期待核实'}</small></span>
          <strong title={String(ref.value)}>{ref.value!.toFixed(4)}{ladder?.anchor ? <small>{signedPercent(ref.value!, ladder.anchor.close)}</small> : null}</strong>
        </li>)}</ul></details>
      </article>
    })}</div></details>
    {!analysis.mergedLevels.length ? <p className="sa-note">有效参考位不足，补充行情或调整情景后再合并。</p> : null}
    {definition ? <details><summary>1%合并规则</summary><p>以组内最高价和最低价的差，除以两者平均价，结果不超过1%才归为同组。相距更远的价位分开保留。</p>
      <p>平均价先使用完整精度计算，展示时保留两位小数。未来根数按每个来源周期分别计数；盘中暂估未加入正式综合结果。</p></details> : null}
  </section>
}
