'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { browserMarketClient } from '@/lib/api/browser-client'
import type { Security } from '../workspace/stock-workspace-types'
import { AppDialog } from '../ui/app-dialog'

export function StockSearchDialog({ onClose, focusInput = false }: { onClose: () => void; focusInput?: boolean }) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Security[]>([])
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [active, setActive] = useState(0)
  const [notice, setNotice] = useState('')
  const [attempt, setAttempt] = useState(0)
  const term = query.trim()
  const directCode = /^\d{6}$/.test(term)
  const visible = results.length ? results : directCode ? [{ code: term, name: '按代码进入分析' }] : []

  useEffect(() => {
    if (!focusInput) return
    const frame = requestAnimationFrame(() => input.current?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(frame)
  }, [focusInput])

  useEffect(() => {
    if (!term) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      void browserMarketClient.search(term, controller.signal).then(items => {
        if (controller.signal.aborted) return
        setResults(items); setState('ready')
      }).catch(() => {
        if (!controller.signal.aborted) { setResults([]); setState('error') }
      })
    }, 220)
    return () => { clearTimeout(timer); controller.abort() }
  }, [term, attempt])

  return <AppDialog title="搜索股票" description="输入 A 股代码或名称，选择股票后进入分析。" onClose={onClose}>
    <form className="sc-form" onSubmit={event => {
      event.preventDefault()
      if (visible[active]) document.getElementById(`${id}-result-${active}`)?.click()
      else setNotice(term ? '请从搜索结果中选择股票' : '请输入股票代码或名称')
    }}>
      <label htmlFor={`${id}-query`}>股票代码或名称</label>
      <input id={`${id}-query`} ref={input} value={query} placeholder="例如 600519 或贵州茅台" autoComplete="off" aria-describedby={`${id}-status`} onChange={event => {
        setQuery(event.target.value); setResults([]); setActive(0); setNotice(''); setState(event.target.value.trim() ? 'loading' : 'idle')
      }} onKeyDown={event => {
        if (event.nativeEvent.isComposing) return
        if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && visible.length) {
          event.preventDefault(); setActive(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + visible.length) % visible.length)
        }
      }} />
      <p className="sc-form-note" role="status" id={`${id}-status`}>{notice || (state === 'loading' ? '正在搜索…' : state === 'error' ? '搜索暂不可用，可重试或输入完整六位代码。' : state === 'ready' && !visible.length ? '没有匹配的股票，请换个名称或输入六位代码。' : visible.length ? '点击股票进入分析；也可用 ↑↓ 选择、回车进入。' : '支持六位代码和股票名称。')}</p>
      {state === 'error' ? <button type="button" className="sc-button" onClick={() => { setState('loading'); setAttempt(value => value + 1) }}>重试搜索</button> : null}
    </form>
    <nav className="sc-stock-search-results" aria-label="股票搜索结果">{visible.map((security, index) => <Link key={security.code} id={`${id}-result-${index}`} className={index === active ? 'is-selected' : undefined} href={`/analysis/key-levels?symbol=${encodeURIComponent(security.code)}`} onClick={onClose}><strong>{security.name}</strong><span>{security.exchange} {security.code}</span></Link>)}</nav>
  </AppDialog>
}
