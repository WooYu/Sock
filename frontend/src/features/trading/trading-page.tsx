'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { addRecord, createRecordId, loadRecords } from '../records/record-store'
import type { PredictionRecord, TradeRecord } from '../records/record-types'
import { getAuthorizationHeader, getClientId, syncRecord } from '../records/record-sync'
import { RecordSyncButton } from '../records/record-sync-button'
import { saveAccountTrade } from '@/lib/api/backend-client'

export type TradingTab = 'positions' | 'ledger' | 'predictions' | 'statistics'

const tabs: Array<[TradingTab, string]> = [['positions', '持仓与交易'], ['ledger', '交易流水'], ['predictions', '预测记录'], ['statistics', '统计图表']]

export function TradingPage({ symbol, initialTab = 'positions' }: { symbol?: string | null; initialTab?: TradingTab }) {
  const [tab, setTab] = useState<TradingTab>(initialTab)
  const [trades, setTrades] = useState<TradeRecord[]>(() => loadRecords<TradeRecord>('trades'))
  const [predictions, setPredictions] = useState<PredictionRecord[]>(() => loadRecords<PredictionRecord>('predictions'))

  const label = tabs.find(([key]) => key === tab)?.[1] ?? '持仓与交易'
  const visibleTrades = symbol ? trades.filter((trade) => trade.symbol === symbol) : trades
  const visiblePredictions = symbol ? predictions.filter((prediction) => prediction.symbol === symbol) : predictions
  return <section className="space-y-5 rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-[var(--sc-muted)]">{symbol ? `当前股票：${symbol}` : '账户与组合'}</p><h1 className="mt-1 text-2xl font-semibold">{label}</h1></div><RecordSyncButton onSynced={() => { setTrades(loadRecords<TradeRecord>('trades')); setPredictions(loadRecords<PredictionRecord>('predictions')) }} /></div><div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="交易内容"><div className="flex min-w-max gap-2">{tabs.map(([key, name]) => <Link className="min-h-12 rounded-xl px-4 py-3 text-sm data-[active=true]:bg-[var(--sc-primary)] data-[active=true]:text-white" data-active={tab === key} href={`/trading/${key}${symbol ? `?symbol=${symbol}` : ''}`} key={key} onClick={() => setTab(key)} role="tab" aria-selected={tab === key}>{name}</Link>)}</div></div><TradingContent tab={tab} symbol={symbol} trades={visibleTrades} predictions={visiblePredictions} onTradeSaved={(trade) => setTrades((items) => [...items, trade])} /></section>
}

function TradingContent({ tab, symbol, trades, predictions, onTradeSaved }: { tab: TradingTab; symbol?: string | null; trades: TradeRecord[]; predictions: PredictionRecord[]; onTradeSaved: (trade: TradeRecord) => void }) {
  if (tab === 'positions') {
    const shares = trades.reduce((total, trade) => total + (trade.side === 'buy' ? trade.quantity : -trade.quantity), 0)
    const invested = trades.reduce((total, trade) => total + (trade.side === 'buy' ? trade.quantity * trade.price : -trade.quantity * trade.price), 0)
    return <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-3">{[['持仓股数', `${shares} 股`], ['累计投入', invested ? `¥${invested.toFixed(2)}` : '—'], ['交易笔数', `${trades.length} 笔`]].map(([title, value]) => <article className="rounded-xl bg-[var(--sc-surface-muted)] p-4" key={title}><p className="text-sm text-[var(--sc-muted)]">{title}</p><p className="mt-2 text-xl font-semibold">{value}</p></article>)}</div><div className="flex flex-wrap gap-3"><Link className="min-h-12 rounded-xl bg-[var(--sc-primary)] px-4 py-3 text-sm font-semibold text-white" href={`/analysis/key-levels${symbol ? `?symbol=${symbol}` : ''}`}>查看个股分析</Link><Link className="min-h-12 rounded-xl border border-[var(--sc-border)] px-4 py-3 text-sm font-semibold" href={`/trading/ledger${symbol ? `?symbol=${symbol}` : ''}`}>记录交易</Link><Link className="min-h-12 rounded-xl border border-[var(--sc-border)] px-4 py-3 text-sm font-semibold" href={`/chart${symbol ? `?symbol=${symbol}` : ''}`}>打开 K 线</Link></div></div>
  }
  if (tab === 'ledger') return <LedgerContent symbol={symbol} trades={trades} onTradeSaved={onTradeSaved} />
  if (tab === 'predictions') return <PredictionContent symbol={symbol} predictions={predictions} />
  const buys = trades.filter((trade) => trade.side === 'buy').length
  const sells = trades.filter((trade) => trade.side === 'sell').length
  return <div className="grid gap-3 sm:grid-cols-3"><article className="rounded-xl bg-[var(--sc-surface-muted)] p-4"><p className="text-sm text-[var(--sc-muted)]">交易总数</p><p className="mt-2 text-2xl font-semibold">{trades.length}</p></article><article className="rounded-xl bg-[var(--sc-surface-muted)] p-4"><p className="text-sm text-[var(--sc-muted)]">买入 / 卖出</p><p className="mt-2 text-2xl font-semibold">{buys} / {sells}</p></article><article className="rounded-xl bg-[var(--sc-surface-muted)] p-4"><p className="text-sm text-[var(--sc-muted)]">预测快照</p><p className="mt-2 text-2xl font-semibold">{predictions.length}</p></article></div>
}

function LedgerContent({ symbol, trades, onTradeSaved }: { symbol?: string | null; trades: TradeRecord[]; onTradeSaved: (trade: TradeRecord) => void }) {
  const [open, setOpen] = useState(trades.length === 0)
  const [side, setSide] = useState<TradeRecord['side']>('buy')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [note, setNote] = useState('')
  const [message, setMessage] = useState('')
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const numericQuantity = Number(quantity)
    const numericPrice = Number(price)
    if (!symbol || !numericQuantity || !numericPrice || numericQuantity < 0 || numericPrice < 0) {
      setMessage('请先选择股票，并填写大于 0 的数量和价格。')
      return
    }
    const trade: TradeRecord = { id: createRecordId('trade'), symbol, side, quantity: numericQuantity, price: numericPrice, fee: 0, tradedAt: new Date().toISOString(), note, revision: Date.now() }
    addRecord('trades', trade)
    void saveAccountTrade(trade, getClientId(), getAuthorizationHeader()).catch(() => undefined)
    void syncRecord('trades', trade).catch(() => undefined)
    onTradeSaved(trade)
    setMessage('交易已保存')
    setOpen(false)
  }
  return <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium">交易流水</p><p className="mt-1 text-sm text-[var(--sc-muted)]">记录会保存在当前浏览器，后续可同步到服务器。</p></div><button className="min-h-12 rounded-xl bg-[var(--sc-primary)] px-4 text-sm font-semibold text-white" onClick={() => { setOpen(true); setMessage('') }} type="button">记录第一笔交易</button></div>{open ? <form className="space-y-3 rounded-xl border border-[var(--sc-border)] p-4" onSubmit={submit}><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm"><span>交易方向</span><select aria-label="交易方向" className="min-h-12 w-full rounded-xl border border-[var(--sc-border)] bg-transparent px-3" onChange={(event) => setSide(event.target.value as TradeRecord['side'])} value={side}><option value="buy">买入</option><option value="sell">卖出</option></select></label><label className="space-y-1 text-sm"><span>数量</span><input aria-label="交易数量" className="min-h-12 w-full rounded-xl border border-[var(--sc-border)] bg-transparent px-3" min="1" onChange={(event) => setQuantity(event.target.value)} type="number" value={quantity} /></label><label className="space-y-1 text-sm"><span>成交价格</span><input aria-label="成交价格" className="min-h-12 w-full rounded-xl border border-[var(--sc-border)] bg-transparent px-3" min="0.01" onChange={(event) => setPrice(event.target.value)} step="0.01" type="number" value={price} /></label><label className="space-y-1 text-sm"><span>备注</span><input aria-label="交易备注" className="min-h-12 w-full rounded-xl border border-[var(--sc-border)] bg-transparent px-3" onChange={(event) => setNote(event.target.value)} value={note} /></label></div><div className="flex gap-3"><button className="min-h-12 rounded-xl bg-[var(--sc-primary)] px-4 text-sm font-semibold text-white" type="submit">保存交易</button><button className="min-h-12 rounded-xl border border-[var(--sc-border)] px-4" onClick={() => setOpen(false)} type="button">取消</button></div></form> : null}{message ? <p className="text-sm text-emerald-700" role="status">{message}</p> : null}{trades.length ? <div className="space-y-2">{trades.slice().reverse().map((trade) => <article className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--sc-border)] p-4" key={trade.id}><div><p className="font-medium">{trade.side === 'buy' ? '买入' : '卖出'} {trade.quantity} 股</p><p className="mt-1 text-sm text-[var(--sc-muted)]">{trade.symbol} · ¥{trade.price.toFixed(2)}</p></div><Link className="text-sm font-semibold text-[var(--sc-primary)]" href={`/review/trade?tradeId=${trade.id}`}>去做复盘</Link></article>)}</div> : <div className="rounded-xl border border-dashed border-[var(--sc-border)] p-6 text-sm text-[var(--sc-muted)]">还没有交易记录。填写成交方向、数量和价格后即可开始。</div>}</div>
}

function PredictionContent({ symbol, predictions }: { symbol?: string | null; predictions: PredictionRecord[] }) {
  return <div className="space-y-4">{predictions.length ? predictions.slice().reverse().map((prediction) => <article className="rounded-xl border border-[var(--sc-border)] p-4" key={prediction.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{prediction.securityName}（{prediction.symbol}）</p><p className="mt-1 text-sm text-[var(--sc-muted)]">{prediction.cycle} · 信心度 {(prediction.confidence * 100).toFixed(0)}%</p></div><span className="rounded-full bg-[var(--sc-surface-muted)] px-3 py-1 text-sm">{prediction.direction}</span></div><p className="mt-3 text-sm">支撑 ¥{formatAmount(prediction.support)} · 压力 ¥{formatAmount(prediction.resistance)} · 目标 ¥{formatAmount(prediction.target)}</p><Link className="mt-3 inline-flex text-sm font-semibold text-[var(--sc-primary)]" href={`/review/trade?predictionId=${prediction.id}`}>关联复盘</Link></article>) : <div className="rounded-xl border border-dashed border-[var(--sc-border)] p-6"><p className="font-medium">暂无预测记录</p><p className="mt-2 text-sm text-[var(--sc-muted)]">从个股分析保存预测快照后，会在这里形成可追踪记录。</p><Link className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-[var(--sc-primary)] px-4 text-sm font-semibold text-white" href={`/analysis/key-levels${symbol ? `?symbol=${symbol}` : ''}`}>从个股分析创建预测</Link></div>}</div>
}

function formatAmount(value: number | null) {
  return value == null ? '—' : value.toFixed(2)
}
