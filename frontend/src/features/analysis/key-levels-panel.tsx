import { useState } from 'react'
import type { StockAnalysis } from '../workspace/stock-workspace-types'

type KeyLevelsPanelProps = { analysis?: StockAnalysis | null }

export function KeyLevelsPanel({ analysis }: KeyLevelsPanelProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  if (!analysis) return <EmptyPanel text="关键位分析等待行情快照。" />

  const cards = [
    { id: 'upside', title: '上涨关键区', value: analysis.resistance, probability: '—' },
    { id: 'target', title: '上涨目标区', value: analysis.target, probability: analysis.confidence == null ? '未校准' : `${Math.round(analysis.confidence * 100)}%` },
    { id: 'support', title: '下跌支撑区', value: analysis.support, probability: '—' },
  ].filter((card) => card.id !== 'target' || analysis.decision.action === 'ENTER')
  return (
    <section className="sc-analysis-panel rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-4 sm:p-5">
      <div className="sc-analysis-panel-heading"><div><p className="sc-eyebrow">决策地图</p><h2>关键位分析</h2></div><span>方向：{analysis.direction}</span></div>
      <div className="sc-decision-status">
        <p className="text-sm font-semibold">决策门：{decisionLabel(analysis.decision.action)}</p>
        <p className="mt-2 text-sm text-[var(--sc-muted)]">{analysis.decision.reason}</p>
        {analysis.decision.missingFacts.length ? <p className="mt-2 text-sm text-[var(--sc-muted)]">缺失条件：{analysis.decision.missingFacts.join('、')}</p> : null}
        {analysis.decision.conflicts.length ? <p className="mt-2 text-sm text-[var(--sc-muted)]">冲突规则：{analysis.decision.conflicts.join('、')}</p> : null}
      </div>
      <div className="sc-key-level-grid">
        {cards.map((card) => (
          <article className={`sc-key-level-card ${card.id}`} key={card.id}>
            <div className="flex items-start justify-between gap-3"><div><p className="text-sm text-[var(--sc-muted)]">{card.title}</p><p className="mt-2 text-2xl font-semibold">{card.value == null ? '—' : card.value.toFixed(2)}</p></div><span className="text-sm text-[var(--sc-muted)]">概率 {card.probability}</span></div>
            <button className="sc-key-level-toggle" onClick={() => setExpanded((old) => ({ ...old, [card.id]: !old[card.id] }))} type="button">{expanded[card.id] ? '收起' : `展开${card.title}`}</button>
            {expanded[card.id] ? <div className="mt-3 space-y-2 border-t border-[var(--sc-border)] pt-3 text-sm text-[var(--sc-muted)]"><p className="font-semibold text-[var(--sc-foreground)]">计算依据</p><p>触发条件：价格与指标形成共振。</p><p>失效条件：行情快照过期或结构破坏。</p></div> : null}
          </article>
        ))}
      </div>
    </section>
  )
}

function EmptyPanel({ text }: { text: string }) { return <section className="rounded-2xl border border-dashed border-[var(--sc-border)] p-6 text-sm text-[var(--sc-muted)]">{text}</section> }


function decisionLabel(action: StockAnalysis['decision']['action']) {
  return {
    ENTER: '允许进入',
    HOLD: '继续持有',
    REDUCE: '减仓',
    EXIT: '退出',
    AVOID: '回避',
    WAIT: '等待 / 不可判断',
  }[action]
}
