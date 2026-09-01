import type { WorkspaceStatus } from './stock-workspace-types'

export type MarketStateVariant = 'overview' | 'analysis' | 'chart'

const loadingCopy: Record<MarketStateVariant, { title: string; detail: string }> = {
  overview: { title: '准备总览行情', detail: '正在获取最新报价和历史数据。' },
  analysis: { title: '准备个股分析', detail: '行情到达后会继续计算关键位和规则结果。' },
  chart: { title: '准备 K 线', detail: '正在获取可绘制的历史行情。' },
}

export function MarketLoadingState({ variant }: { variant: MarketStateVariant }) {
  const copy = loadingCopy[variant]
  return (
    <section aria-live="polite" className={`sc-market-state sc-market-loading sc-market-loading-${variant}`} role="status">
      <div className="sc-market-loading-heading">
        <span aria-hidden="true" className="sc-market-spinner" />
        <div>
          <p className="sc-eyebrow">真实行情 · 阿里云后端</p>
          <h1>正在加载真实行情</h1>
          <p>{copy.title}，请稍候。</p>
        </div>
      </div>
      <div aria-hidden="true" className="sc-market-loading-skeleton" data-testid="market-loading-skeleton">
        <span />
        <span />
        <span />
        <span />
      </div>
      <p className="sc-market-loading-detail">{copy.detail}</p>
    </section>
  )
}

export function MarketFeedback({
  status,
  hasSnapshot = false,
  errorMessage,
  onRetry,
}: {
  status: WorkspaceStatus
  hasSnapshot?: boolean
  errorMessage?: string | null
  onRetry?: () => void
}) {
  if (status === 'refreshing') {
    return <p aria-live="polite" className="sc-market-feedback is-refreshing" role="status"><span aria-hidden="true" className="sc-market-spinner sc-market-spinner-small" />正在刷新行情，当前页面保留上次数据</p>
  }

  if (status === 'stale') {
    return <p aria-live="polite" className="sc-market-feedback is-stale" role="status">行情刷新失败，当前展示上次成功数据。{onRetry ? <button onClick={onRetry} type="button">再次刷新</button> : null}</p>
  }

  if (status === 'offline') {
    return <p aria-live="polite" className="sc-market-feedback is-offline" role="status">当前为离线行情缓存，数据可能不是最新。{onRetry ? <button onClick={onRetry} type="button">刷新行情</button> : null}</p>
  }

  if (status === 'error') {
    return (
      <div aria-live="assertive" className={`sc-market-feedback is-error${hasSnapshot ? ' has-snapshot' : ''}`} role="alert">
        <span>{errorMessage ?? '行情暂时不可用，请稍后重试。'}</span>
        {onRetry ? <button onClick={onRetry} type="button">重新加载行情</button> : null}
      </div>
    )
  }

  return null
}
