'use client'

import { useState } from 'react'
import type { StockAnalysis } from '../workspace/stock-workspace-types'

type Explanation = {
  decision: StockAnalysis['decision']['action']
  summary: string
  evidenceIds: string[]
  risks: string[]
  unknowns: string[]
}

const actionLabels: Record<StockAnalysis['decision']['action'], string> = {
  ENTER: '允许进入',
  HOLD: '继续持有',
  REDUCE: '减仓',
  EXIT: '退出',
  AVOID: '回避',
  WAIT: '等待 / 不可判断',
}

export function AiStrategyPanel({ analysis }: { analysis?: StockAnalysis | null }) {
  const [explanation, setExplanation] = useState<Explanation | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!analysis) {
    return <p className="sc-analysis-empty rounded-2xl border border-dashed border-[var(--sc-border)] p-6 text-sm text-[var(--sc-muted)]">请先加载行情，未生成伪 AI 结果。</p>
  }

  const decision = analysis.decision
  const explain = async () => {
    setLoading(true)
    setError(null)
    try {
      const token = window.localStorage.getItem('stockcal.accessToken')
      const response = await fetch('/api/analysis/strategy-explanation', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          decision: decision.action,
          primaryMode: decision.mode,
          reason: decision.reason,
          matchedRules: decision.matchedRules.map((rule) => rule.name),
          missingFacts: decision.missingFacts,
          conflicts: decision.conflicts,
          invalidationConditions: decision.invalidationConditions,
          snapshot: {
            support: analysis.support,
            resistance: analysis.resistance,
            target: analysis.target,
          },
          evidence: decision.evidence,
          calibration: analysis.confidence == null ? undefined : {
            confidence: analysis.confidence,
            calibrated: true,
          },
        }),
      })
      const result = (await response.json()) as Partial<Explanation> & { message?: string }
      if (!response.ok) throw new Error(result.message ?? 'AI 策略解释暂不可用')
      if (result.decision !== decision.action || typeof result.summary !== 'string') {
        throw new Error('AI 返回结果未保持规则引擎决策')
      }
      setExplanation({
        decision: result.decision,
        summary: result.summary,
        evidenceIds: result.evidenceIds ?? [],
        risks: result.risks ?? [],
        unknowns: result.unknowns ?? [],
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'AI 策略解释暂不可用')
    } finally {
      setLoading(false)
    }
  }

  return <section className="sc-analysis-panel sc-analysis-secondary-panel rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5">
    <p className="text-sm text-[var(--sc-muted)]">数值计算 → 规则匹配 → AI 解释</p>
    <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold">AI 策略</h2>
      <span className="rounded-full bg-[var(--sc-surface-muted)] px-3 py-1 text-sm font-semibold">决策门：{actionLabels[decision.action]}</span>
    </div>
    <p className="mt-3 text-sm text-[var(--sc-muted)]">{decision.reason}</p>
    {decision.action === 'WAIT' ? <p className="mt-2 rounded-xl bg-[var(--sc-surface-muted)] p-3 text-sm">条件不完整或规则冲突时，系统只输出等待；AI 只能解释原因，不能改成买卖结论。</p> : null}
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <article className="rounded-xl bg-[var(--sc-surface-muted)] p-4">
        <p className="font-semibold">数值计算</p>
        <p className="mt-2 text-sm text-[var(--sc-muted)]">支撑 {formatValue(analysis.support)} · 压力 {formatValue(analysis.resistance)}</p>
        <p className="mt-1 text-sm text-[var(--sc-muted)]">目标 {decision.action === 'ENTER' ? formatValue(analysis.target) : '不生成'}</p>
      </article>
      <article className="rounded-xl bg-[var(--sc-surface-muted)] p-4">
        <p className="font-semibold">规则匹配</p>
        <p className="mt-2 text-sm text-[var(--sc-muted)]">{decision.matchedRules.length ? decision.matchedRules.map((rule) => rule.name).join('、') : '没有已确认的适用规则'}</p>
        {decision.conflicts.length ? <p className="mt-1 text-sm text-[var(--sc-muted)]">冲突：{decision.conflicts.join('、')}</p> : null}
        {decision.missingFacts.length ? <p className="mt-1 text-sm text-[var(--sc-muted)]">缺失：{decision.missingFacts.join('、')}</p> : null}
      </article>
      <article className="rounded-xl bg-[var(--sc-surface-muted)] p-4">
        <p className="font-semibold">AI 解释</p>
        <p className="mt-2 text-sm text-[var(--sc-muted)]">{explanation?.summary ?? 'AI 不参与规则判断，只解释已确定输入。'}</p>
        {explanation?.risks.length ? <p className="mt-1 text-sm text-[var(--sc-muted)]">风险：{explanation.risks.join('、')}</p> : null}
        {explanation?.unknowns.length ? <p className="mt-1 text-sm text-[var(--sc-muted)]">未知：{explanation.unknowns.join('、')}</p> : null}
      </article>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button className="min-h-12 rounded-xl bg-[var(--sc-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={loading} onClick={() => void explain()} type="button">{loading ? '解释中…' : '解释当前确定结果'}</button>
      {analysis.confidence == null ? <span className="text-sm text-[var(--sc-muted)]">历史样本不足，暂不显示校准置信度。</span> : <span className="text-sm text-[var(--sc-muted)]">历史校准置信度 {Math.round(analysis.confidence * 100)}%</span>}
    </div>
    {error ? <p className="mt-3 text-sm text-[var(--sc-danger)]">{error}</p> : null}
  </section>
}

function formatValue(value: number | null) {
  return value == null ? '—' : value.toFixed(2)
}
