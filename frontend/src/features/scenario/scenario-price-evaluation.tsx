import type { ActualTarget, EvaluationView } from './scenario-record-types'
import { displayTime } from './scenario-labels'

const TARGETS: Array<[ActualTarget, string]> = [['open', '开盘'], ['high', '最高'], ['low', '最低'], ['close', '收盘']]
const REASONS: Record<string, string> = { historical_replay: '历史回放', target_not_verified: '目标日未核实', legacy_level_definition: '旧价位定义', server_receipt_after_cutoff: '服务器首次接收晚于盘前截止', client_created_after_cutoff: '客户端生成晚于盘前截止', input_after_cutoff: '分析时点晚于盘前截止' }
export function ScenarioPriceEvaluation({ view }: { view: EvaluationView }) {
  const status = view.latestStatus, success = view.latestSuccessful, result = success?.result
  return <section className="sa-section sa-price-evaluation" aria-label="价格核对">
    <h3>价格核对</h3>
    {status?.status === 'source_error' ? <p role="status" className="sa-note">最近一次采集失败，{success ? '保留上次成功结果' : '等待重试，尚无评分'}。</p> : null}
    <p>{status?.targetResolution.targetDay ? '目标日 ' + status.targetResolution.targetDay : '等待后续首根完整日K'}</p>
    {status?.targetResolution.state === 'target_unverified' ? <p className="sa-note">候选目标日缺日原因未核实，暂不计入前瞻统计。</p> : null}
    {status ? <p>{status.eligibility.forwardEligible ? '符合盘前保存条件的前瞻样本' : '事后对照／资格待核实'} · {status.eligibility.reasons.map(r => REASONS[r] ?? '资格需进一步核实').join('；')}</p> : null}
    {result ? <>
      <div className="sa-evaluation-metrics"><div><span>接近价位 / 全部价位</span><strong>{result.closeLevels} / {result.totalLevels}</strong></div>
        <div><span>覆盖实际四价</span><strong>{result.coveredTargets} / 4</strong></div><div><span>精确到分相同的价位</span><strong>{result.exactLevels}</strong></div></div>
      {!result.totalLevels ? <p>暂无计算价位，接近比例未定义。</p> : null}
      <div className="sa-actual-targets">{TARGETS.map(([key, label]) => <p key={key}>{label} {(result.targets[key].priceCents / 100).toFixed(2)} · {result.targets[key].covered ? '已接近' : '未覆盖'}{result.targets[key].nearestError === null ? '' : ` · 最近偏差 ${(result.targets[key].nearestError! * 100).toFixed(2)}%`}</p>)}</div>
      <p>偏差以实际价为分母，严格小于1%判为接近；显示值已四舍五入。</p>
      <div className="sa-table-scroll"><table className="sa-reference-table"><caption>全部计算价与实际四价偏差</caption><thead><tr><th>计算价</th>{TARGETS.map(([key, label]) => <th key={key}>{label}偏差</th>)}<th>接近项</th></tr></thead>
        <tbody>{result.levels.map(level => <tr key={level.id}><th>{(level.priceCents / 100).toFixed(2)}</th>{TARGETS.map(([key]) => <td key={key} data-close={level.matches.includes(key) ? 'true' : undefined}>{(level.errors[key] * 100).toFixed(4)}%</td>)}<td>{level.matches.length ? level.matches.map(key => TARGETS.find(t => t[0] === key)![1]).join('、') : '未接近'}{level.exactMatch ? ' · 精确相同' : ''}</td></tr>)}</tbody>
      </table></div>
      <p className="sa-time">{success?.source?.provider} · 实际采集 {displayTime(success?.source?.fetchedAt ?? null)} · 核对 {displayTime(status?.evaluatedAt ?? null)}</p>
    </> : <p>尚无可用四价评分，待完整行情及目标日确认后核对。</p>}
    <p className="sa-time">盘中支撑／压力：未评估。价位接近与四价覆盖分别统计。</p>
    {status?.targetResolution.evidence.length ? <details><summary>目标日依据</summary><ul>{status.targetResolution.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul></details> : null}
  </section>
}
