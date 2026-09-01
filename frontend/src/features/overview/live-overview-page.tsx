'use client'

import Link from 'next/link'
import { useStockWorkspace } from '../workspace/stock-workspace-provider'
import type { MarketSnapshot, WorkspaceStatus } from '../workspace/stock-workspace-types'
import { MarketFeedback, MarketLoadingState } from '../workspace/market-state'

type LiveOverviewPageProps = {
  snapshot?: MarketSnapshot | null
  status?: WorkspaceStatus
  errorMessage?: string | null
}

export function LiveOverviewPage({ snapshot: providedSnapshot, status: providedStatus, errorMessage: providedError }: LiveOverviewPageProps) {
  const workspace = useStockWorkspaceOptional()
  const snapshot = providedSnapshot === undefined ? workspace?.current?.market ?? workspace?.lastSuccessful?.market ?? null : providedSnapshot
  const status = providedStatus ?? workspace?.status ?? 'idle'
  const errorMessage = providedError ?? workspace?.errorMessage
  const retry = workspace ? () => { void workspace.refresh() } : undefined

  if (!snapshot) {
    if (status === 'loading' || (status === 'idle' && workspace?.selectedSymbol)) {
      return <MarketLoadingState variant="overview" />
    }
    if (status === 'error') {
      return <section className="sc-live-error-state"><p className="sc-eyebrow">真实行情 · 阿里云后端</p><h1>真实行情暂不可用</h1><MarketFeedback errorMessage={errorMessage} onRetry={retry} status={status} /><Link className="sc-link" href="/chart">进入 K 线工作区 →</Link></section>
    }
    return <section className="sc-live-empty" aria-live="polite"><p className="sc-eyebrow">真实行情 · 阿里云后端</p><h1>真实行情暂不可用</h1><p>{errorMessage ?? (status === 'loading' ? '正在从行情服务加载数据。' : '请检查阿里云行情服务和行情 API 配置。')}</p><Link className="sc-link" href="/chart">进入 K 线工作区 →</Link></section>
  }

  const change = snapshot.quote.previousClose ? snapshot.quote.price - snapshot.quote.previousClose : null
  return <div className="sc-live-dashboard">
    <MarketFeedback errorMessage={errorMessage} hasSnapshot onRetry={retry} status={status} />
    <section className="sc-live-hero"><div><p className="sc-eyebrow">实时行情 · {snapshot.source.online ? '在线' : '离线缓存'}</p><h1>{snapshot.quote.security.name}</h1><p className="sc-live-code">{snapshot.quote.security.code}{snapshot.quote.security.exchange ? ` · ${snapshot.quote.security.exchange}` : ''}</p></div><div className="sc-live-price"><strong>{snapshot.quote.price.toFixed(2)}</strong>{change === null ? null : <span className={change >= 0 ? 'sc-positive' : 'sc-negative'}>{change >= 0 ? '+' : ''}{change.toFixed(2)}</span>}</div></section>
    <section className="sc-live-card"><div className="sc-live-card-heading"><h2>行情快照</h2><span>{snapshot.source.name} · {new Date(snapshot.source.fetchedAt).toLocaleString('zh-CN')}</span></div><dl className="sc-live-metrics"><div><dt>今开</dt><dd>{formatOptional(snapshot.quote.open)}</dd></div><div><dt>最高</dt><dd>{formatOptional(snapshot.quote.high)}</dd></div><div><dt>最低</dt><dd>{formatOptional(snapshot.quote.low)}</dd></div><div><dt>成交量</dt><dd>{formatVolume(snapshot.quote.volume)}</dd></div><div><dt>历史 K 线</dt><dd>{snapshot.dailyCandles.length} 根</dd></div></dl></section>
    <section className="sc-live-actions"><Link href={`/chart?symbol=${encodeURIComponent(snapshot.quote.security.code)}`}>打开专业 K 线</Link><Link href="/rules">管理经验规则</Link></section>
  </div>
}

function useStockWorkspaceOptional() {
  try { return useStockWorkspace() } catch { return null }
}

function formatOptional(value?: number) { return value === undefined ? '—' : value.toFixed(2) }
function formatVolume(value?: number) { return value === undefined ? '—' : new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 2 }).format(value) }
