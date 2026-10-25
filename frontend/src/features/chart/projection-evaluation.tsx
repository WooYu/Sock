import type { Candle } from '../workspace/stock-workspace-types'
import { indicatorSeries } from '../scenario/scenario-calculator'
import type { IndicatorProjection, ProjectionKey } from './indicator-projection'

export function compareIndicatorProjection(points: IndicatorProjection[], candles: Candle[], fetchedAt: string, recordedAt?: string) {
  const actual = indicatorSeries(candles)
  const cutoff = Date.parse(fetchedAt)
  return points.map(point => {
    const index = candles.findIndex(bar => bar.day === point.day)
    const targetClose = Date.parse(point.day + 'T15:00:00+08:00')
    const late = recordedAt !== undefined && targetClose <= Date.parse(recordedAt)
    return { day: point.day, late, values: (Object.keys(point.values) as ProjectionKey[]).map(key => {
      const predicted = point.values[key], observed = !late && index >= 0 && targetClose <= cutoff ? actual[key][index] : null
      return { key, predicted, actual: observed, error: predicted != null && observed != null ? Math.abs(predicted - observed) : null }
    }) }
  })
}

export function ProjectionEvaluation({ points, candles, fetchedAt, basisValid, recordedAt }: { points: IndicatorProjection[]; candles: Candle[]; fetchedAt: string; basisValid: boolean; recordedAt?: string }) {
  return <details><summary>预测与后续实际指标对照</summary>{!basisValid ? <p>原记录与当前数据的价格口径或复权基准不同，暂不计算误差。</p> : <><p>只核对已收盘目标日，绝对误差＝预测值与实际指标值之差的绝对值。此处不是命中率。</p>{compareIndicatorProjection(points, candles, fetchedAt, recordedAt).map(row => <details key={row.day}><summary>{row.day} · {row.late ? '记录晚于目标时段，不计入前向验证' : row.values.some(v => v.error !== null) ? '已有实际值' : '等待目标日或足够历史'}</summary><div className="rs-projection-comparison"><table><thead><tr><th>指标</th><th>当时预测</th><th>后续实际</th><th>绝对误差</th></tr></thead><tbody>{row.values.map(v => <tr key={v.key}><th>{v.key.toUpperCase()}</th><td>{v.predicted?.toFixed(2) ?? '—'}</td><td>{v.actual?.toFixed(2) ?? '—'}</td><td>{v.error?.toFixed(2) ?? '—'}</td></tr>)}</tbody></table></div></details>)}</>}</details>
}
