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
  const [savedKey, setSavedKey] = useState('')
  const [saveError, setSaveError] = useState('')
  const snapshotKey = `${workspace.current?.symbol}:${workspace.cycle}:${workspace.current?.market.source.fetchedAt}`
  const saved = savedKey === snapshotKey
  const savePrediction = () => {
    if (!analysis || !workspace.current || saved) return
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
    setSaveError('')
    try { addRecord('predictions', record) } catch { setSaveError('本机保存失败，请检查存储权限后重试。'); return }
    void syncRecord('predictions', record).catch(() => undefined)
    setSavedKey(snapshotKey)
  }
  return <div className="sc-analysis-page">
    <StockHeader />
    <nav aria-label="分析页签" className="sc-analysis-tabs">
      {tabs.map(([value, label]) => <Link aria-current={tab === value ? 'page' : undefined} className={tab === value ? 'is-active' : ''} href={`/analysis/${value}${workspace.selectedSymbol ? `?symbol=${workspace.selectedSymbol}` : ''}`} key={value}>{label}</Link>)}
    </nav>
    {!initialLoading && !initialError ? <section aria-label="规则结论" className="sc-analysis-decision"><p className="sc-eyebrow">当前结论</p><strong>{decisionLabel(analysis?.decision.action)}</strong><p>{analysis?.decision.reason ?? '正在等待可计算的规则与行情条件。'}</p>{analysis?.decision.missingFacts.length ? <details><summary>查看待补充条件</summary><p>{analysis.decision.missingFacts.join('、')}</p></details> : null}</section> : null}
    <div className="sc-analysis-content">
      {initialLoading ? <MarketLoadingState variant="analysis" /> : initialError ? <MarketFeedback errorMessage={workspace.errorMessage} onRetry={() => void workspace.refresh()} status={workspace.status} /> : <MarketFeedback errorMessage={workspace.errorMessage} hasSnapshot={hasMarketSnapshot} onRetry={() => void workspace.refresh()} status={workspace.status} />}
      {!initialLoading && !initialError && tab === 'key-levels' ? <KeyLevelsPanel analysis={analysis} /> : null}
      {!initialLoading && !initialError && tab === 'patterns' ? <PatternsPanel analysis={analysis} /> : null}
      {!initialLoading && !initialError && tab === 'future' ? <FutureIndicatorsPanel analysis={analysis} /> : null}
      {!initialLoading && !initialError && tab === 'ai' ? <AiStrategyPanel analysis={analysis} /> : null}
    </div>
    <aside aria-label="分析操作" className="sc-analysis-actions sc-context-rail">
      <button disabled={!analysis || saved} onClick={savePrediction} type="button">{saved ? '当前快照已保存' : '保存预测快照'}</button>
      <Link href={`/trading/predictions${workspace.selectedSymbol ? `?symbol=${workspace.selectedSymbol}` : ''}`}>查看预测记录</Link>
      <Link href={`/chart${workspace.selectedSymbol ? `?symbol=${workspace.selectedSymbol}` : ''}`}>在专业 K 线中查看</Link>
    </aside>
    {saveError ? <p role="alert" className="sc-field-error">{saveError}</p> : null}
    {saved ? <p className="sc-analysis-saved" role="status">预测快照已保存</p> : null}
  </div>
}

function decisionLabel(action?: 'ENTER' | 'EXIT' | 'HOLD' | 'REDUCE' | 'AVOID' | 'WAIT') {
  return ({ ENTER: '买入', EXIT: '卖出', HOLD: '持有', REDUCE: '减仓', AVOID: '回避', WAIT: '等待' } as const)[action ?? 'WAIT']
}
