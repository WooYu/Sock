'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { browserMarketClient } from '@/lib/api/browser-client'
import type { MarketSnapshot, Security } from '../workspace/stock-workspace-types'
import { StudioIcon } from './studio-icon'

const storageKey = 'stockcal:research-list:v1'
const emptyList = '{"recent":[],"favorites":[]}'
const initialSecurities: Security[] = [{ code: '600519', name: '贵州茅台', exchange: 'SH' }, { code: '000001', name: '平安银行', exchange: 'SZ' }, { code: '300750', name: '宁德时代', exchange: 'SZ' }, { code: '002594', name: '比亚迪', exchange: 'SZ' }, { code: '601318', name: '中国平安', exchange: 'SH' }]
type SavedList = { recent: Security[]; favorites: Security[] }
function subscribe(callback: () => void) { window.addEventListener('storage', callback); window.addEventListener('stockcal-research-list', callback); return () => { window.removeEventListener('storage', callback); window.removeEventListener('stockcal-research-list', callback) } }
function read() { try { return localStorage.getItem(storageKey) ?? emptyList } catch { return emptyList } }
function parse(raw: string): SavedList {
  try {
    const value = JSON.parse(raw)
    const valid = (items: unknown): Security[] => Array.isArray(items) ? items.filter((item) => item && typeof item.code === 'string' && /^\d{6}$/.test(item.code) && typeof item.name === 'string') : []
    return { recent: valid(value.recent), favorites: valid(value.favorites) }
  } catch { return { recent: [], favorites: [] } }
}
function save(value: SavedList) { try { const raw = JSON.stringify(value); if (read() !== raw) { localStorage.setItem(storageKey, raw); window.dispatchEvent(new Event('stockcal-research-list')) } return true } catch { return false } }

export function StockPicker({ selectedSymbol, market, onSelect, onClose }: { selectedSymbol: string | null; market?: MarketSnapshot | null; onSelect: (security: Security) => void; onClose: () => void }) {
  const stored = useSyncExternalStore(subscribe, read, () => emptyList)
  const saved = useMemo(() => parse(stored), [stored])
  const [tab, setTab] = useState<'recent' | 'favorites'>('recent')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Security[]>([])
  const [searchState, setSearchState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [activeIndex, setActiveIndex] = useState(0)
  const [notice, setNotice] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const version = useRef(0)
  const choose = (security: Security) => { if (!save({ ...parse(read()), recent: [security, ...parse(read()).recent.filter((item) => item.code !== security.code)].slice(0, 20) })) setNotice('浏览器未允许保存，当前选择仍可使用'); setQuery(''); onSelect(security) }

  useEffect(() => {
    const security = market?.quote.security
    if (!security || !/^\d{6}$/.test(security.code)) return
    const old = parse(read())
    save({ recent: [security, ...old.recent.filter((item) => item.code !== security.code)].slice(0, 20), favorites: old.favorites.map((item) => item.code === security.code ? security : item) })
  }, [market?.quote.security])

  useEffect(() => {
    const requestVersion = ++version.current
    const controller = new AbortController()
    if (!query.trim()) return
    const timer = setTimeout(() => {
      void browserMarketClient.search(query.trim(), controller.signal).then((items) => {
        if (requestVersion !== version.current || controller.signal.aborted) return
        setResults(items); setSearchState('ready'); setActiveIndex(0)
      }).catch(() => { if (!controller.signal.aborted && requestVersion === version.current) { setResults([]); setSearchState('error') } })
    }, 220)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query])

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); input.current?.focus() } }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [])

  const visible = query.trim() ? results : tab === 'favorites' ? saved.favorites : saved.recent.length ? saved.recent : initialSecurities
  return <aside aria-label="股票选择" className="rs-stock-picker">
    <div className="rs-picker-heading"><strong>A 股市场</strong><button aria-label="关闭选股" className="rs-mobile-only rs-icon-button" onClick={onClose} type="button"><StudioIcon name="close" /></button><span className="rs-desktop-only">沪 · 深 · 北</span></div>
    <form className="rs-search" onSubmit={(event) => { event.preventDefault(); if (results[activeIndex] && query.trim()) choose(results[activeIndex]); else if (/^\d{6}$/.test(query.trim())) choose({ code: query.trim(), name: query.trim() }) }}>
      <StudioIcon name="search" size={16} /><input aria-label="搜索 A 股" aria-autocomplete="list" aria-controls="rs-stock-results" aria-expanded={Boolean(query.trim())} aria-activedescendant={query.trim() && results[activeIndex] ? `rs-result-${activeIndex}` : undefined} role="combobox" ref={input} value={query} onChange={(event) => { setQuery(event.target.value); setResults([]); setSearchState(event.target.value.trim() ? 'loading' : 'idle') }} onKeyDown={(event) => { if (event.key === 'Escape') { setQuery(''); input.current?.blur() } if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && results.length) { event.preventDefault(); setActiveIndex((index) => (index + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length) } }} placeholder="代码 / 名称 / 拼音" autoComplete="off" /><kbd>⌘K</kbd>
    </form>
    {!query.trim() ? <div role="tablist" aria-label="股票列表类型" className="rs-list-tabs"><button role="tab" aria-selected={tab === 'recent'} onClick={() => setTab('recent')} type="button">最近查看</button><button role="tab" aria-selected={tab === 'favorites'} onClick={() => setTab('favorites')} type="button">我的自选 <span>{saved.favorites.length}</span></button></div> : <p className="rs-search-summary" role="status">{searchState === 'loading' ? '正在搜索…' : searchState === 'error' ? '搜索服务暂不可用' : `${results.length} 个搜索结果`}</p>}
    {!query.trim() && tab === 'recent' && !saved.recent.length ? <p className="rs-suggestion-label">常用股票 · 点击查看</p> : null}
    <div className="rs-stock-results" id="rs-stock-results" role={query.trim() ? 'listbox' : undefined} aria-label="股票列表">
      {visible.map((security, index) => {
        const favorite = saved.favorites.some((item) => item.code === security.code)
        const quote = market?.quote.security.code === security.code ? market.quote : null
        const change = quote?.previousClose ? (quote.price / quote.previousClose - 1) * 100 : null
        return <div className={`rs-security-row ${selectedSymbol === security.code ? 'is-selected' : ''} ${query.trim() && activeIndex === index ? 'is-focused' : ''}`} key={security.code}>
          <button id={`rs-result-${index}`} type="button" role={query.trim() ? 'option' : undefined} aria-selected={query.trim() ? activeIndex === index : undefined} aria-current={!query.trim() && selectedSymbol === security.code ? 'true' : undefined} className="rs-security-select" onClick={() => choose(security)}><span><strong>{security.name}</strong><small>{security.exchange ?? ''} {security.code}</small></span>{quote ? <span className={`rs-security-quote ${change !== null && change < 0 ? 'rs-down' : 'rs-up'}`}><strong>{quote.price.toFixed(2)}</strong><small>{change === null ? '—' : `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`}</small></span> : null}</button>
          {!query.trim() ? <button className={`rs-star ${favorite ? 'is-starred' : ''}`} aria-label={`${favorite ? '取消自选' : '加入自选'} ${security.name}`} aria-pressed={favorite} onClick={() => { if (!save({ ...saved, favorites: favorite ? saved.favorites.filter((item) => item.code !== security.code) : [...saved.favorites, security] })) setNotice('自选保存失败，请检查浏览器存储设置') }} type="button"><StudioIcon name="star" size={15} /></button> : null}
        </div>
      })}
      {!visible.length && searchState !== 'loading' ? <p className="rs-list-empty">{query.trim() ? '暂无匹配股票，请尝试六位代码。' : '点击股票旁的星标，加入你的自选。'}</p> : null}
      {query.trim() && /^\d{6}$/.test(query.trim()) && !results.length && searchState !== 'loading' ? <button className="rs-direct-open" onClick={() => choose({ code: query.trim(), name: query.trim() })} type="button">直接查看 {query.trim()}<StudioIcon name="arrow" size={15} /></button> : null}
    </div>
    {notice ? <p role="status" className="rs-list-empty">{notice}</p> : null}
    <div className="rs-picker-footer"><StudioIcon name="search" /><strong>从一只股票开始</strong><p>搜索全市场，图表与预测随股票一起切换。</p><small>自选与最近查看保存在本机</small></div>
  </aside>
}
