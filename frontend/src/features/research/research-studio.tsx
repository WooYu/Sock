'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StockWorkspaceProvider, useStockWorkspace } from '../workspace/stock-workspace-provider'
import type { Security } from '../workspace/stock-workspace-types'
import { ChartWorkspace } from '../chart/chart-workspace'
import { WebAccountButton } from '../account/web-account-button'
import { StockPicker } from './stock-picker'
import { ResearchEvidence } from './research-evidence'
import { StudioIcon } from './studio-icon'
import { createPreviewData, loadPreviewSeries } from './preview-data'
import { browserMarketClient } from '@/lib/api/browser-client'
import './research-studio.css'

export function ResearchStudio({ initialSymbol = '600519', initialPreview = false }: { initialSymbol?: string; initialPreview?: boolean }) {
  return <StockWorkspaceProvider initialSymbol={initialPreview ? undefined : initialSymbol}><Studio initialPreview={initialPreview} initialSymbol={initialSymbol} /></StockWorkspaceProvider>
}

function Studio({ initialPreview, initialSymbol }: { initialPreview: boolean; initialSymbol: string }) {
  const workspace = useStockWorkspace()
  const [demo, setDemo] = useState(initialPreview)
  const [pickerOpen, setPickerOpen] = useState(false)
  const mobileSearch = useRef<HTMLButtonElement>(null)
  const pickerPanel = useRef<HTMLDivElement>(null)
  const preview = useMemo(() => createPreviewData(), [])
  const current = workspace.current ?? workspace.lastSuccessful
  const market = demo ? preview.market : current?.market
  const prediction = demo ? preview.prediction : current?.prediction ?? null
  const security = market?.quote.security ?? workspace.selectedSecurity
  const price = market?.quote.price
  const change = market?.quote.previousClose && price !== undefined ? price - market.quote.previousClose : null
  const changePercent = change !== null && market?.quote.previousClose ? change / market.quote.previousClose * 100 : null
  const loading = !demo && (workspace.status === 'loading' || workspace.status === 'refreshing')
  const updateUrl = (symbol: string, example = false) => { const url = new URL(window.location.href); url.searchParams.set('symbol', symbol); if (example) url.searchParams.set('example', '1'); else url.searchParams.delete('example'); window.history.pushState(null, '', `${url.pathname}${url.search}`) }
  const closePicker = () => { setPickerOpen(false); mobileSearch.current?.focus() }
  const select = (selection: Security) => { setDemo(false); setPickerOpen(false); updateUrl(selection.code); void workspace.selectStock(selection.code, selection) }
  const refresh = () => { if (!demo) void workspace.refresh() }
  const showExample = () => { setDemo(true); setPickerOpen(false); updateUrl(workspace.selectedSymbol ?? initialSymbol, true) }
  const exitExample = () => { setDemo(false); updateUrl(workspace.selectedSymbol ?? initialSymbol); if (!workspace.current) void workspace.selectStock(workspace.selectedSymbol ?? initialSymbol) }
  const restoreLocation = useCallback(() => { const url = new URL(window.location.href); const example = url.searchParams.get('example') === '1'; setDemo(example); if (!example) { const symbol = url.searchParams.get('symbol') ?? initialSymbol; if (symbol !== workspace.selectedSymbol) void workspace.selectStock(symbol) } }, [initialSymbol, workspace])
  useEffect(() => { window.addEventListener('popstate', restoreLocation); return () => window.removeEventListener('popstate', restoreLocation) }, [restoreLocation])
  useEffect(() => {
    if (!pickerOpen) return
    pickerPanel.current?.querySelector('input')?.focus()
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setPickerOpen(false); mobileSearch.current?.focus() }
      if (event.key === 'Tab') {
        const targets = Array.from(pickerPanel.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input, [href]') ?? []).filter((element) => element.getClientRects().length > 0)
        const first = targets[0], last = targets.at(-1)
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [pickerOpen])

  return <div className="rs-studio" data-testid="research-studio">
    <header className="rs-header"><Link className="rs-brand" href="/"><span><StudioIcon name="chart" size={20} /></span>StockCal</Link><nav aria-label="研究工作台导航"><Link className="is-active" aria-current="page" href="/">K 线工作台</Link><Link href="/knowledge">经验与原则</Link><Link href="/review/daily">复盘</Link></nav><div className="rs-header-actions"><span className="rs-desktop-only rs-header-subtitle">让每一次判断，都有依据</span><WebAccountButton /></div></header>
    {demo ? <div className="rs-demo-banner" role="status"><span><strong>交互示例</strong> · 当前为合成数据，用于体验绘图和预测交互。</span><button onClick={exitExample} type="button">返回真实行情<StudioIcon name="arrow" size={15} /></button></div> : null}
    <div className="rs-body">
      {pickerOpen ? <button className="rs-picker-backdrop" aria-label="关闭股票面板" onClick={closePicker} type="button" /> : null}
      <div className={`rs-picker-wrap ${pickerOpen ? 'is-open' : ''}`} ref={pickerPanel} role={pickerOpen ? 'dialog' : undefined} aria-modal={pickerOpen ? true : undefined} aria-label={pickerOpen ? '选择股票' : undefined}><StockPicker selectedSymbol={demo ? 'DEMO' : workspace.selectedSymbol} market={demo ? null : market} onSelect={select} onClose={closePicker} /></div>
      <main className="rs-main">
        <div className="rs-workspace-breadcrumb"><span><StudioIcon name="chart" size={15} />市场研究 <span>/</span> K 线工作台</span><button className="rs-mobile-only rs-button" aria-expanded={pickerOpen} onClick={() => setPickerOpen(true)} ref={mobileSearch} type="button"><StudioIcon name="search" size={16} />选股</button><span className="rs-desktop-only">{demo ? '示例环境' : market ? `${market.source.name} · ${market.source.online ? '已连接' : '离线缓存'}` : '等待行情连接'}</span></div>
        <section className="rs-stock-summary" aria-label="当前股票">
          <div className="rs-stock-identity"><div><h1>{security?.name ?? '选择一只 A 股'}</h1><span className="rs-exchange">{security?.exchange ?? 'A 股'}</span></div><span>{security?.code ?? '支持代码、名称与拼音搜索'}{market ? ` · 截至 ${market.dailyCandles.at(-1)?.day ?? '—'}` : ''}</span></div>
          <div className={`rs-stock-price ${change !== null && change < 0 ? 'rs-down' : 'rs-up'}`}><strong>{price?.toFixed(2) ?? '—'}</strong><span>{change !== null ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}  (${changePercent! >= 0 ? '+' : ''}${changePercent!.toFixed(2)}%)` : '等待行情'}</span></div>
          <dl className="rs-quote-facts">{([['开盘', market?.quote.open], ['最高', market?.quote.high], ['最低', market?.quote.low]] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value?.toFixed(2) ?? '—'}</dd></div>)}</dl>
          <button className="rs-refresh rs-icon-button" title="刷新行情与预测" aria-label="刷新行情与预测" disabled={loading || demo} onClick={refresh} type="button"><StudioIcon name="refresh" /><span>{loading ? '刷新中' : '刷新'}</span></button>
        </section>
        {market && market.dailyCandles.length ? <ChartWorkspace key={market.quote.security.code} variant="studio" loadSeries={demo ? loadPreviewSeries : browserMarketClient.series} snapshot={market} prediction={prediction} status={demo ? 'ready' : workspace.status} errorMessage={demo ? null : workspace.errorMessage} onRetry={refresh} forecastStatus={demo ? 'ready' : workspace.predictionStatus} forecastError={demo ? null : workspace.predictionError} footer={<ResearchEvidence candles={market.dailyCandles} analysis={demo ? null : current?.analysis} rules={demo ? [] : current?.publishedRules} rulesStatus={demo ? 'ready' : current?.rulesStatus} demo={demo} />} /> : <section className="rs-empty-workspace" aria-live="polite"><div className="rs-empty-chart-icon"><StudioIcon name="chart" size={38} /></div><h2>{loading ? '正在加载 K 线' : '从走势，开始你的研究'}</h2><p>{loading ? '正在获取历史行情与未来预测…' : workspace.status === 'error' ? '行情暂时未连接。你可以重新加载，或先用示例体验完整工作台。' : '搜索股票，查看 K 线、标记关键位置，再与未来推演对照。'}</p><div><button className="rs-button rs-button-primary" onClick={refresh} disabled={loading} type="button"><StudioIcon name="refresh" size={16} />{loading ? '正在加载' : '重新加载行情'}</button><button className="rs-button" onClick={showExample} type="button">用示例体验<StudioIcon name="arrow" size={16} /></button></div><div className="rs-empty-features"><span>趋势线与关键位标记</span><span>未来 3 日价格、MA、BOLL</span><span>笔记与历史走势对照</span></div></section>}
        <footer className="rs-page-footer"><span>StockCal · 研究、记录、验证</span><span>{demo ? '示例不对应任何真实证券' : '预测为技术推演，仅供研究参考'}</span><Link href="/settings">设置</Link></footer>
      </main>
    </div>
  </div>
}
