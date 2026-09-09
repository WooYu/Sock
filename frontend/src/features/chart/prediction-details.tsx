'use client'

import { useState } from 'react'
import type { PredictionDay, PredictionSnapshot } from './chart-types'

type PredictionDetailsProps = {
  prediction: PredictionSnapshot
  selectedDay: string | null
  onSelectDay: (day: string) => void
  mode: 'desktop-table' | 'mobile-sheet'
}

export function predictionRows(day: PredictionDay): Array<[string, number | string]> {
  return [
    ['预测开盘', day.open],
    ['预测最高', day.high],
    ['预测最低', day.low],
    ['预测收盘', day.close],
    ['预测区间', `${day.rangeLow.toFixed(2)}–${day.rangeHigh.toFixed(2)}`],
    ['MA5', day.ma5],
    ['MA10', day.ma10],
    ['MA20', day.ma20],
    ['BOLL上轨', day.bollUpper],
    ['BOLL中轨', day.bollMiddle],
    ['BOLL下轨', day.bollLower],
    ['置信度', `${Math.round(day.confidence * 100)}%`],
  ]
}

function predictionValue(value: number | string) {
  return typeof value === 'number' ? value.toFixed(2) : value
}

function WarningCopy() {
  return <p className="sc-prediction-warning"><strong>推演数据，不是实际行情</strong><span>结果仅供参考，不构成投资建议。</span></p>
}

export function PredictionDetails({ prediction, selectedDay, onSelectDay, mode }: PredictionDetailsProps) {
  const [expanded, setExpanded] = useState(true)
  const selectedIndex = Math.max(0, prediction.days.findIndex((day) => day.day === selectedDay))
  const rowsByDay = prediction.days.map(predictionRows)

  if (mode === 'mobile-sheet') {
    const day = prediction.days[selectedIndex]
    const rows = rowsByDay[selectedIndex]
    return (
      <section aria-label="未来三日推演详情" className="sc-prediction-details sc-prediction-mobile-sheet">
        <header><div><p className="sc-eyebrow">未来三日</p><h2>推演详情</h2></div><span>{prediction.modelVersion}</span></header>
        <div aria-label="预测日期" className="sc-prediction-tabs" role="tablist">
          {prediction.days.map((candidate, index) => (
            <button aria-controls={`prediction-day-${candidate.day}`} aria-selected={selectedIndex === index} id={`prediction-tab-${candidate.day}`} key={candidate.day} onClick={() => onSelectDay(candidate.day)} role="tab" type="button">
              <strong>第{index + 1}日</strong><span>{candidate.day}</span>
            </button>
          ))}
        </div>
        <dl aria-labelledby={`prediction-tab-${day.day}`} className="sc-prediction-values" id={`prediction-day-${day.day}`} role="tabpanel">
          {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{predictionValue(value)}</dd></div>)}
        </dl>
        <WarningCopy />
      </section>
    )
  }

  return (
    <section aria-label="未来三日推演详情" className="sc-prediction-details sc-prediction-desktop-table">
      <header>
        <div><p className="sc-eyebrow">未来三日</p><h2>推演详情</h2></div>
        <button aria-expanded={expanded} onClick={() => setExpanded((value) => !value)} type="button">{expanded ? '收起预测详情' : '展开预测详情'}</button>
      </header>
      {expanded ? (
        <div className="sc-prediction-table-scroll">
          <table aria-label="未来三日推演详情">
            <thead><tr><th scope="col">指标</th>{prediction.days.map((day, index) => <th key={day.day} scope="col"><button aria-pressed={selectedDay === day.day} onClick={() => onSelectDay(day.day)} type="button"><strong>第{index + 1}日</strong><span>{day.day}</span></button></th>)}</tr></thead>
            <tbody>{rowsByDay[0].map(([label], rowIndex) => <tr key={label}><th scope="row">{label}</th>{rowsByDay.map((rows, dayIndex) => <td className={selectedDay === prediction.days[dayIndex].day ? 'is-selected' : undefined} key={prediction.days[dayIndex].day}>{predictionValue(rows[rowIndex][1])}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ) : null}
      <WarningCopy />
    </section>
  )
}
