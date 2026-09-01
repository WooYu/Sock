import type { StockAnalysis } from '../workspace/stock-workspace-types'

export function PatternsPanel({ analysis }: { analysis?: StockAnalysis | null }) {
  if (!analysis) return <p className="rounded-2xl border border-dashed border-[var(--sc-border)] p-6 text-sm text-[var(--sc-muted)]">盈利模式等待行情快照。</p>
  const rules = analysis.matchedRules
  const evaluations = analysis.ruleEvaluations ?? analysis.decision.ruleEvaluations ?? []
  const ruleName = new Map(rules.map((rule) => [rule.ruleId, rule.name]))
  return <section className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5"><p className="text-sm text-[var(--sc-muted)]">规则命中 {rules.length} 条 · 决策门 {decisionLabel(analysis.decision.action)}</p><h2 className="mt-1 text-xl font-semibold">盈利模式</h2><p className="mt-2 text-sm text-[var(--sc-muted)]">{analysis.decision.reason}</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{(rules.length ? rules : [{ ruleId: 'none', version: 0, name: '等待已发布规则', score: 0, band: '待确认', action: 'WAIT', priority: 0, evidence: [] }]).map((rule) => <article className="rounded-xl bg-[var(--sc-surface-muted)] p-4" key={rule.name}><p className="font-semibold">{rule.name}</p><p className="mt-2 text-sm text-[var(--sc-muted)]">匹配分数 {rule.score ?? '—'} · {rule.band ?? '待确认'} · {rule.action}</p></article>)}</div>{analysis.decision.conflicts.length ? <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><p className="font-semibold">规则冲突</p><p className="mt-1">{analysis.decision.conflicts.join('、')} · 当前决策已降级为等待确认</p></div> : null}{evaluations.length ? <div className="mt-5 rounded-xl border border-[var(--sc-border)] p-4"><p className="font-semibold">规则条件核验</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{evaluations.map((evaluation) => <article className="rounded-xl bg-[var(--sc-surface-muted)] p-3" key={evaluation.ruleId}><div className="flex items-center justify-between gap-3"><p className="font-medium">{ruleName.get(evaluation.ruleId) ?? evaluation.ruleId}</p><span className="text-xs text-[var(--sc-muted)]">{statusLabel(evaluation.status)}</span></div><div className="mt-2 space-y-1 text-xs text-[var(--sc-muted)]">{evaluation.conditions.map((condition) => <p key={`${evaluation.ruleId}-${condition.field}`}><span className="font-medium text-[var(--sc-text)]">{condition.field}</span> · {formatActual(condition.actual)} · <span>{condition.passed === true ? '已满足' : condition.passed === false ? '未满足' : '条件缺失'}</span></p>)}{evaluation.missingFacts.map((fact) => <p className="text-amber-700" key={`${evaluation.ruleId}-missing-${fact}`}>缺少数据：{fact}</p>)}{evaluation.failedConditions.map((condition) => <p className="text-rose-700" key={`${evaluation.ruleId}-failed-${condition}`}>未通过：{condition}</p>)}</div></article>)}</div></div> : null}</section>
}


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

function statusLabel(status: NonNullable<StockAnalysis['ruleEvaluations']>[number]['status']) {
  return { matched: '已命中', 'not-matched': '未命中', insufficient: '条件不足' }[status]
}

function formatActual(actual: number | boolean | string | null) {
  if (actual === null) return '暂无实际值'
  if (typeof actual === 'boolean') return actual ? '是' : '否'
  return typeof actual === 'number' ? actual.toFixed(2) : actual
}
