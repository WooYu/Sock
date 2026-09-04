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
import { MarketFeedback, MarketLoadingState } from '../workspace/market-state'

const tabs: Array<[AnalysisTab, string]> = [['key-levels', '关键位'], ['patterns', '盈利模式'], ['future', '未来指标'], ['ai', 'AI 策略']]

export function AnalysisPage({ tab }: { tab: AnalysisTab }) {
  const workspace = useStockWorkspace()
  const analysis = workspace.current?.analysis
  const hasMarketSnapshot = Boolean(workspace.current ?? workspace.lastSuccessful)
  const initialLoading = !hasMarketSnapshot && (workspace.status === 'loading' || workspace.status === 'refreshing' || (workspace.status === 'idle' && workspace.selectedSymbol))
  const initialError = !hasMarketSnapshot && workspace.status === 'error'
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
  return <div className="sc-analysis-page">
    <StockHeader />
    {!initialLoading && !initialError ? <section aria-label="规则结论" className="sc-analysis-decision"><p className="sc-eyebrow">规则结论</p><strong>{decisionLabel(analysis?.decision.action)}</strong><p>{analysis?.decision.reason ?? '正在等待可计算的规则与行情条件。'}</p>{analysis?.decision.missingFacts.length ? <p>待补充：{analysis.decision.missingFacts.join('、')}</p> : null}<Link href={`/chart${workspace.selectedSymbol ? `?symbol=${workspace.selectedSymbol}` : ''}`}>查看 K 线与预测路径</Link></section> : null}
    <nav aria-label="分析页签" className="sc-analysis-tabs">
      {tabs.map(([value, label]) => <Link aria-current={tab === value ? 'page' : undefined} className={tab === value ? 'is-active' : ''} href={`/analysis/${value}${workspace.selectedSymbol ? `?symbol=${workspace.selectedSymbol}` : ''}`} key={value}>{label}</Link>)}
    </nav>
    <div className="sc-analysis-content">
      {initialLoading ? <MarketLoadingState variant="analysis" /> : initialError ? <MarketFeedback errorMessage={workspace.errorMessage} onRetry={() => void workspace.refresh()} status={workspace.status} /> : <MarketFeedback errorMessage={workspace.errorMessage} hasSnapshot={hasMarketSnapshot} onRetry={() => void workspace.refresh()} status={workspace.status} />}
      {!initialLoading && !initialError && tab === 'key-levels' ? <KeyLevelsPanel analysis={analysis} /> : null}
      {!initialLoading && !initialError && tab === 'patterns' ? <PatternsPanel analysis={analysis} /> : null}
      {!initialLoading && !initialError && tab === 'future' ? <FutureIndicatorsPanel analysis={analysis} /> : null}
      {!initialLoading && !initialError && tab === 'ai' ? <AiStrategyPanel analysis={analysis} /> : null}
    </div>
    <div className="sc-analysis-actions">
      <button disabled={!analysis} onClick={savePrediction} type="button">保存预测快照</button>
      <Link href={`/trading/predictions${workspace.selectedSymbol ? `?symbol=${workspace.selectedSymbol}` : ''}`}>查看预测记录</Link>
      <Link href={`/chart${workspace.selectedSymbol ? `?symbol=${workspace.selectedSymbol}` : ''}`}>在专业 K 线中查看</Link>
    </div>
    {saved ? <p className="sc-analysis-saved" role="status">预测快照已保存</p> : null}
  </div>
}

function decisionLabel(action?: 'ENTER' | 'EXIT' | 'HOLD' | 'REDUCE' | 'AVOID' | 'WAIT') {
  return ({ ENTER: '买入', EXIT: '卖出', HOLD: '持有', REDUCE: '减仓', AVOID: '回避', WAIT: '等待' } as const)[action ?? 'WAIT']
}
