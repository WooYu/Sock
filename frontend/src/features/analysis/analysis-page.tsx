'use client'

import Link from 'next/link'
import type { AnalysisTab } from '../navigation/navigation-config'
import { useStockWorkspace } from '../workspace/stock-workspace-provider'
import { AiStrategyPanel } from './ai-strategy-panel'
import { FutureIndicatorsPanel } from './future-indicators-panel'
import { KeyLevelsPanel } from './key-levels-panel'
import { PatternsPanel } from './patterns-panel'
import { StockHeader } from './stock-header'

const tabs: Array<[AnalysisTab, string]> = [['key-levels', '关键位'], ['patterns', '盈利模式'], ['future', '未来指标'], ['ai', 'AI 策略']]

export function AnalysisPage({ tab }: { tab: AnalysisTab }) {
  const workspace = useStockWorkspace()
  const analysis = workspace.current?.analysis
  return <div className="space-y-5"><StockHeader /><nav aria-label="分析页签" className="flex gap-2 overflow-x-auto border-b border-[var(--sc-border)] pb-2">{tabs.map(([value, label]) => <Link aria-current={tab === value ? 'page' : undefined} className={`min-h-12 shrink-0 rounded-xl px-4 py-3 text-sm font-semibold ${tab === value ? 'bg-[var(--sc-primary)] text-white' : 'bg-[var(--sc-surface)] text-[var(--sc-muted)]'}`} href={`/analysis/${value}${workspace.selectedSymbol ? `?symbol=${workspace.selectedSymbol}` : ''}`} key={value}>{label}</Link>)}</nav>{tab === 'key-levels' ? <KeyLevelsPanel analysis={analysis} /> : null}{tab === 'patterns' ? <PatternsPanel analysis={analysis} /> : null}{tab === 'future' ? <FutureIndicatorsPanel analysis={analysis} /> : null}{tab === 'ai' ? <AiStrategyPanel analysis={analysis} /> : null}<Link className="inline-flex min-h-12 items-center rounded-xl bg-[var(--sc-surface)] px-4 text-sm font-semibold text-[var(--sc-primary)]" href={`/chart${workspace.selectedSymbol ? `?symbol=${workspace.selectedSymbol}` : ''}`}>在专业 K 线中查看</Link></div>
}
