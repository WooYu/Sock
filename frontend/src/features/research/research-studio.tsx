'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StockWorkspaceProvider, useStockWorkspace } from '../workspace/stock-workspace-provider'
import type { Security } from '../workspace/stock-workspace-types'
import { ChartWorkspace } from '../chart/chart-workspace'
import type { ChartPeriod } from '../chart/chart-periods'
import { ResearchHeader } from '../navigation/research-header'
import { ResearchJournal } from './research-journal'
import { StockPicker } from './stock-picker'
import { useAutomaticForecast } from './use-automatic-forecast'
import { AutomaticForecastPanel } from './automatic-forecast-panel'
import type { MergedLevel } from '../scenario/scenario-types'
import { ResearchEvidence } from './research-evidence'
import { StudioIcon } from './studio-icon'
import { createPreviewData, loadPreviewSeries } from './preview-data'
import { browserMarketClient } from '@/lib/api/browser-client'
import './research-studio.css'
const ScenarioAnalysisPanel = dynamic(() => import('../scenario/scenario-analysis-panel').then(m => m.ScenarioAnalysisPanel), {
  loading: () => <p role="status">正在准备多周期分析…</p>,
})
const previewScenarioClient = { series: loadPreviewSeries }

export function ResearchStudio({ initialSymbol = '600519', initialPreview = false }: { initialSymbol?: string; initialPreview?: boolean }) {
  return <StockWorkspaceProvider initialSymbol={initialPreview ? undefined : initialSymbol}><Studio initialPreview={initialPreview} initialSymbol={initialSymbol} /></StockWorkspaceProvider>
}

function Studio({ initialPreview, initialSymbol }: { initialPreview: boolean; initialSymbol: string }) {
  const workspace = useStockWorkspace()
  const [demo, setDemo] = useState(initialPreview)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [levelSelection, setLevelSelection] = useState<{ owner: string; id: string } | null>(null)
  const [chartSelection, setChartSelection] = useState<{ owner: string; period: ChartPeriod } | null>(null)
  const mobileSearch = useRef<HTMLButtonElement>(null)
  const pickerPanel = useRef<HTMLDivElement>(null)
  const preview = useMemo(() => createPreviewData(), [])
  const selectedSymbol = demo ? 'DEMO' : workspace.selectedSymbol ?? initialSymbol
  const chartPeriod = chartSelection?.owner === selectedSymbol ? chartSelection.period : 'day'
  const changePeriod = (period: ChartPeriod) => setChartSelection({ owner: selectedSymbol, period })
  const cached = workspace.current ?? workspace.lastSuccessful
  const current = cached?.symbol === selectedSymbol ? cached : null
  const market = demo ? preview.market : current?.market
  const automatic = useAutomaticForecast({ symbol: selectedSymbol, sourceMode: demo ? 'demo' : 'real', client: demo ? previewScenarioClient : browserMarketClient, name: market?.quote.security.name })
  const selectedLevel = levelSelection?.owner === selectedSymbol ? automatic.analysis?.mergedLevels.find(level => level.id === levelSelection.id) ?? null : null
  const selectLevel = (level: MergedLevel) => setLevelSelection({ owner: selectedSymbol, id: level.id })
  const forecastPanel = <AutomaticForecastPanel compact forecast={automatic} selected={selectedLevel} onSelect={selectLevel} rules={demo ? [] : current?.publishedRules} stockAnalysis={current?.analysis} />
  const security = market?.quote.security ?? workspace.selectedSecurity
  const price = market?.quote.price
  const change = market?.quote.previousClose && price !== undefined ? price - market.quote.previousClose : null
  const changePercent = change !== null && market?.quote.previousClose ? change / market.quote.previousClose * 100 : null
  const loading = !demo && (workspace.status === 'loading' || workspace.status === 'refreshing')
  const scenarioPanel = analysisOpen ? <ScenarioAnalysisPanel symbol={selectedSymbol} sourceMode={demo ? 'demo' : 'real'}
    activePeriod={chartPeriod} onPeriodChange={changePeriod} client={demo ? previewScenarioClient : browserMarketClient} security={security ?? undefined} />
    : <section className="rs-scenario-launch" aria-label="多周期分析入口"><div><h3>按需开始多周期分析</h3><p>从日线核对趋势与盈利模式，再按需查看下一级周期。</p></div><button type="button" className="rs-button rs-button-primary" onClick={() => setAnalysisOpen(true)}>开始多周期分析</button></section>
  const updateUrl = (symbol: string, example = false) => { const url = new URL(window.location.href); url.searchParams.set('symbol', symbol); if (example) url.searchParams.set('example', '1'); else url.searchParams.delete('example'); window.history.pushState(null, '', `${url.pathname}${url.search}`) }
  const closePicker = () => { setPickerOpen(false); mobileSearch.current?.focus() }
  const select = (selection: Security) => { setDemo(false); closePicker(); updateUrl(selection.code); void workspace.selectStock(selection.code, selection) }
  const refresh = () => { if (!demo) { void workspace.refresh(); void automatic.refresh() } }
  const showExample = () => { setDemo(true); setPickerOpen(false); updateUrl(workspace.selectedSymbol ?? initialSymbol, true) }
  const exitExample = () => { setDemo(false); updateUrl(workspace.selectedSymbol ?? initialSymbol); if (!workspace.current) void workspace.selectStock(workspace.selectedSymbol ?? initialSymbol) }
  const restoreLocation = useCallback(() => { const url = new URL(window.location.href); const example = url.searchParams.get('example') === '1'; setDemo(example); if (!example) { const symbol = url.searchParams.get('symbol') ?? initialSymbol; if (symbol !== workspace.selectedSymbol) void workspace.selectStock(symbol) } }, [initialSymbol, workspace])
  useEffect(() => { window.addEventListener('popstate', restoreLocation); return () => window.removeEventListener('popstate', restoreLocation) }, [restoreLocation])
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return
      event.preventDefault()
      if (window.matchMedia('(max-width: 1050px)').matches) setPickerOpen(true)
      else pickerPanel.current?.querySelector('input')?.focus()
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [])
  useEffect(() => {
    if (!pickerOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
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
    return () => { window.removeEventListener('keydown', onEscape); document.body.style.overflow = previousOverflow }
  }, [pickerOpen])

  return <div className="rs-studio" data-testid="research-studio">
    <a className="rs-skip-link" href="#research-main">跳到研究工作区</a>
    <ResearchHeader active="chart" />
    {demo ? <div className="rs-demo-banner" role="status"><span><strong>交互示例</strong> · 当前为合成数据，用于体验绘图和预测交互。</span><button onClick={exitExample} type="button">返回真实行情<StudioIcon name="arrow" size={15} /></button></div> : null}
    <div className="rs-body">
      {pickerOpen ? <button className="rs-picker-backdrop" aria-label="关闭股票面板" onClick={closePicker} type="button" /> : null}
      <div className={`rs-picker-wrap ${pickerOpen ? 'is-open' : ''}`} ref={pickerPanel} role={pickerOpen ? 'dialog' : undefined} aria-modal={pickerOpen ? true : undefined} aria-label={pickerOpen ? '选择股票' : undefined}><StockPicker selectedSymbol={demo ? 'DEMO' : workspace.selectedSymbol} market={demo ? null : market} onSelect={select} onClose={closePicker} /></div>
      <main className="rs-main" id="research-main" tabIndex={-1}>
        <div className="rs-workspace-breadcrumb"><span><StudioIcon name="chart" size={15} />市场研究 <span>/</span> K 线工作台</span><button className="rs-mobile-only rs-button" aria-expanded={pickerOpen} onClick={() => setPickerOpen(true)} ref={mobileSearch} type="button"><StudioIcon name="search" size={16} />选股</button><span className="rs-desktop-only">{demo ? '示例环境' : market ? `${market.source.name} · ${market.source.online ? '已连接' : '离线缓存'}` : '等待行情连接'}</span></div>
        <section className="rs-stock-summary" aria-label="当前股票">
          <div className="rs-stock-identity"><div><h1>{security?.name ?? '选择一只 A 股'}</h1><span className="rs-exchange">{security?.exchange ?? 'A 股'}</span></div><span>{security?.code ?? '支持代码、名称与拼音搜索'}{market ? ` · 截至 ${market.dailyCandles.at(-1)?.day ?? '—'}` : ''}</span></div>
          <div className={`rs-stock-price ${change !== null && change < 0 ? 'rs-down' : 'rs-up'}`}><strong>{price?.toFixed(2) ?? '—'}</strong><span>{change !== null ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}  (${changePercent! >= 0 ? '+' : ''}${changePercent!.toFixed(2)}%)` : '等待行情'}</span></div>
          <dl className="rs-quote-facts">{([['开盘', market?.quote.open], ['最高', market?.quote.high], ['最低', market?.quote.low]] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value?.toFixed(2) ?? '—'}</dd></div>)}</dl>
          <button className="rs-refresh rs-icon-button" title="刷新行情与预测" aria-label="刷新行情与预测" disabled={loading || demo} onClick={refresh} type="button"><StudioIcon name="refresh" /><span>{loading ? '刷新中' : '刷新'}</span></button>
        </section>
        {market ? <><p className="rs-data-timestamps" role="status">行情更新：{new Date(market.source.fetchedAt).toLocaleString('zh-CN')} · 最新日K：{market.dailyCandles.at(-1)?.day ?? '—'} · {market.source.online ? '在线来源' : '离线缓存'} · 指标预测：{automatic.loading ? '计算中' : automatic.error ? '计算失败' : automatic.analysis ? `基于 ${new Date(automatic.analysis.input.asOf).toLocaleString('zh-CN')}` : '暂无可用结果'}</p>{automatic.error ? <p role="alert">预测计算失败：{automatic.error}<button type="button" onClick={() => void automatic.refresh()}>重试预测</button></p> : null}<ResearchJournal key={selectedSymbol + ':' + demo} market={market} demo={demo} /></> : null}
        {market && market.dailyCandles.length ? <ChartWorkspace key={market.quote.security.code} variant="studio" period={chartPeriod} onPeriodChange={changePeriod} loadSeries={demo ? loadPreviewSeries : browserMarketClient.series} snapshot={market} prediction={null} forecastPanel={forecastPanel} forecastReferences={automatic.analysis?.references.filter(ref => ref.method === 'average_delta')} status={demo ? 'ready' : workspace.status} errorMessage={demo ? null : workspace.errorMessage} onRetry={refresh} forecastStatus={demo ? 'ready' : workspace.predictionStatus} forecastError={demo ? null : workspace.predictionError} footer={<><AutomaticForecastPanel forecast={automatic} selected={selectedLevel} onSelect={selectLevel} rules={demo ? [] : current?.publishedRules} stockAnalysis={current?.analysis} /><ResearchEvidence candles={market.dailyCandles} analysis={demo ? null : current?.analysis} rules={demo ? [] : current?.publishedRules} rulesStatus={demo ? 'ready' : current?.rulesStatus} demo={demo} scenario={scenarioPanel} scenarioInitiallyOpen={analysisOpen} selectedLevel={selectedLevel} /></>} /> : <section className="rs-empty-workspace" aria-live="polite"><div className="rs-empty-chart-icon"><StudioIcon name="chart" size={38} /></div><h2>{loading ? '正在加载 K 线' : '从走势，开始你的研究'}</h2><p>{loading ? '正在获取历史行情与未来预测…' : workspace.status === 'error' ? '行情暂时未连接。你可以重新加载，或先用示例体验完整工作台。' : '搜索股票，查看 K 线、标记关键位置，再与未来推演对照。'}</p><div><button className="rs-button rs-button-primary" onClick={refresh} disabled={loading} type="button"><StudioIcon name="refresh" size={16} />{loading ? '正在加载' : '重新加载行情'}</button><button className="rs-button" onClick={showExample} type="button">用示例体验<StudioIcon name="arrow" size={16} /></button></div><div className="rs-empty-features"><span>趋势线与关键位标记</span><span>前三后四 MA / BOLL 预测</span><span>笔记与历史走势对照</span></div></section>}
        {(!market || !market.dailyCandles.length) ? scenarioPanel : null}
        <footer className="rs-page-footer"><span>StockCal · 研究、记录、验证</span><span>{demo ? '示例不对应任何真实证券' : '预测为技术推演，仅供研究参考'}</span><Link href="/settings">设置</Link></footer>
      </main>
    </div>
  </div>
}
