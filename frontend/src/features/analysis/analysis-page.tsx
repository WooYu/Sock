'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { AnalysisTab } from '../navigation/navigation-config'
import { useStockWorkspace } from '../workspace/stock-workspace-provider'
import { addRecord, createRecordId } from '../records/record-store'
import type { PredictionRecord } from '../records/record-types'
import { syncRecord } from '../records/record-sync'
import { AiStrategyPanel } from './ai-strategy-panel'
import { FutureIndicatorsPanel } from './future-indicators-panel'
import { KeyLevelsPanel } from './key-levels-panel'
import { PatternsPanel } from './patterns-panel'
import { StockHeader } from './stock-header'

const tabs: Array<[AnalysisTab, string]> = [['key-levels', '关键位'], ['patterns', '盈利模式'], ['future', '未来指标'], ['ai', 'AI 策略']]

export function AnalysisPage({ tab }: { tab: AnalysisTab }) {
  const workspace = useStockWorkspace()
  const analysis = workspace.current?.analysis
  const [saved, setSaved] = useState(false)
  const savePrediction = () => {
    if (!analysis || !workspace.current) return
    const record: PredictionRecord = {
      id: createRecordId('prediction'),
      symbol: workspace.current.symbol,
      securityName: workspace.current.security.name,
      cycle: workspace.current.cycle,
      createdAt: new Date().toISOString(),
      direction: analysis.decision.action,
      confidence: analysis.confidence ?? 0,
      support: analysis.support,
      resistance: analysis.resistance,
      target: analysis.target,
      reason: analysis.decision.reason,
    }
    addRecord('predictions', record)
    void syncRecord('predictions', record).catch(() => undefined)
    setSaved(true)
  }
  return <div className="space-y-5"><StockHeader /><nav aria-label="分析页签" className="flex gap-2 overflow-x-auto border-b border-[var(--sc-border)] pb-2">{tabs.map(([value, label]) => <Link aria-current={tab === value ? 'page' : undefined} className={`min-h-12 shrink-0 rounded-xl px-4 py-3 text-sm font-semibold ${tab === value ? 'bg-[var(--sc-primary)] text-white' : 'bg-[var(--sc-surface)] text-[var(--sc-muted)]'}`} href={`/analysis/${value}${workspace.selectedSymbol ? `?symbol=${workspace.selectedSymbol}` : ''}`} key={value}>{label}</Link>)}</nav>{tab === 'key-levels' ? <KeyLevelsPanel analysis={analysis} /> : null}{tab === 'patterns' ? <PatternsPanel analysis={analysis} /> : null}{tab === 'future' ? <FutureIndicatorsPanel analysis={analysis} /> : null}{tab === 'ai' ? <AiStrategyPanel analysis={analysis} /> : null}<div className="flex flex-wrap gap-3"><button className="min-h-12 rounded-xl bg-[var(--sc-primary)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!analysis} onClick={savePrediction} type="button">保存预测快照</button><Link className="inline-flex min-h-12 items-center rounded-xl bg-[var(--sc-surface)] px-4 text-sm font-semibold text-[var(--sc-primary)]" href={`/trading/predictions${workspace.selectedSymbol ? `?symbol=${workspace.selectedSymbol}` : ''}`}>查看预测记录</Link><Link className="inline-flex min-h-12 items-center rounded-xl border border-[var(--sc-border)] px-4 text-sm font-semibold" href={`/chart${workspace.selectedSymbol ? `?symbol=${workspace.selectedSymbol}` : ''}`}>在专业 K 线中查看</Link></div>{saved ? <p className="text-sm text-emerald-700" role="status">预测快照已保存</p> : null}</div>
}
