'use client'

import Link from 'next/link'
import { AppDialog } from '../ui/app-dialog'
import { useEffect, useId, useState, useSyncExternalStore, type FormEvent } from 'react'
import { addRecord, createRecordId, loadRecords } from '../records/record-store'
import type { PredictionRecord, TradeRecord } from '../records/record-types'
import { getAuthorizationHeader, getClientId, syncRecord } from '../records/record-sync'
import { RecordSyncButton } from '../records/record-sync-button'
import { saveAccountTrade } from '@/lib/api/backend-client'

export type TradingTab = 'positions' | 'ledger' | 'predictions' | 'statistics'

const tabs: Array<[TradingTab, string]> = [['positions', '持仓'], ['ledger', '交易流水'], ['predictions', '预测记录'], ['statistics', '统计图表']]

const subscribeHydration = () => () => {}
const clientHydrated = () => true
const serverHydrated = () => false

export function TradingPage({ symbol, initialTab = 'positions' }: { symbol?: string | null; initialTab?: TradingTab }) {
  const hydrated = useSyncExternalStore(subscribeHydration, clientHydrated, serverHydrated)
  const [tab, setTab] = useState<TradingTab>(initialTab)
  const [trades, setTrades] = useState<TradeRecord[]>(() => loadRecords<TradeRecord>('trades'))
  const [predictions, setPredictions] = useState<PredictionRecord[]>(() => loadRecords<PredictionRecord>('predictions'))

  useEffect(() => {
    const reload = (event: StorageEvent) => {
      if (event.key === 'stockcal:trades') setTrades(loadRecords<TradeRecord>('trades'))
      if (event.key === 'stockcal:predictions') setPredictions(loadRecords<PredictionRecord>('predictions'))
    }
    window.addEventListener('storage', reload)
    return () => window.removeEventListener('storage', reload)
  }, [])
  const label = tabs.find(([key]) => key === tab)?.[1] ?? '持仓'
  const visibleTrades = !hydrated ? [] : symbol ? trades.filter((trade) => trade.symbol === symbol) : trades
  const visiblePredictions = !hydrated ? [] : symbol ? predictions.filter((prediction) => prediction.symbol === symbol) : predictions
  return <section className="sc-trading-page"><div className="sc-trading-header"><div><p className="text-sm text-[var(--sc-muted)]">{symbol ? `当前股票：${symbol}` : '账户与组合'}</p><h1 className="mt-1 text-2xl font-semibold">交易记录</h1><p className="sc-form-note">{label} · 记录成交，追踪持仓与预测</p></div><RecordSyncButton onSynced={() => { setTrades(loadRecords<TradeRecord>('trades')); setPredictions(loadRecords<PredictionRecord>('predictions')) }} /></div><div className="sc-workspace-tabs" aria-label="交易内容">{tabs.map(([key, name]) => <Link className={tab === key ? 'is-active' : ''} data-active={tab === key} href={`/trading/${key}${symbol ? `?symbol=${symbol}` : ''}`} key={key} onClick={() => setTab(key)} aria-current={tab === key ? 'page' : undefined}>{name}</Link>)}</div><div className="sc-trading-content"><TradingContent tab={tab} symbol={symbol} trades={visibleTrades} predictions={visiblePredictions} onTradeSaved={(trade) => setTrades((items) => [...items, trade])} /></div></section>
}

function TradingContent({ tab, symbol, trades, predictions, onTradeSaved }: { tab: TradingTab; symbol?: string | null; trades: TradeRecord[]; predictions: PredictionRecord[]; onTradeSaved: (trade: TradeRecord) => void }) {
  if (tab === 'positions') {
    const shares = trades.reduce((total, trade) => total + (trade.side === 'buy' ? trade.quantity : -trade.quantity), 0)
    const invested = trades.reduce((total, trade) => total + (trade.side === 'buy' ? trade.quantity * trade.price : -trade.quantity * trade.price), 0)
    const positions = Array.from(trades.reduce((items, trade) => {
      const current = items.get(trade.symbol) ?? { symbol: trade.symbol, shares: 0, netCost: 0 }
      const direction = trade.side === 'buy' ? 1 : -1
      current.shares += direction * trade.quantity
      current.netCost += direction * trade.quantity * trade.price
      items.set(trade.symbol, current)
      return items
    }, new Map<string, { symbol: string; shares: number; netCost: number }>()).values()).filter((position) => position.shares !== 0)
    return <div className="sc-trading-view"><div className="sc-trading-stat-grid">{[['持仓股数', `${shares} 股`], ['累计投入', invested ? `¥${invested.toFixed(2)}` : '—'], ['交易笔数', `${trades.length} 笔`]].map(([title, value]) => <article className="sc-trading-stat-card rounded-xl bg-[var(--sc-surface-muted)] p-4" key={title}><p className="text-sm text-[var(--sc-muted)]">{title}</p><p className="mt-2 text-xl font-semibold">{value}</p></article>)}</div><div className="sc-position-table-wrap"><table aria-label="持仓列表" className="sc-position-table"><thead><tr><th>股票</th><th>持仓数量</th><th>平均成本</th><th>操作</th></tr></thead><tbody>{positions.length ? positions.map((position) => <tr key={position.symbol}><td data-label="股票">{position.symbol}</td><td data-label="持仓数量">{position.shares} 股</td><td data-label="平均成本">¥{(position.netCost / position.shares).toFixed(2)}</td><td data-label="操作"><Link href={`/analysis/key-levels?symbol=${position.symbol}`}>查看分析</Link></td></tr>) : <tr><td className="sc-table-empty" colSpan={4}>暂无持仓记录，请先记录一笔交易。</td></tr>}</tbody></table></div><div className="sc-trading-actions flex flex-wrap gap-3"><Link className="min-h-12 rounded-xl border border-[var(--sc-border)] px-4 py-3 text-sm font-semibold" href={`/analysis/key-levels${symbol ? `?symbol=${symbol}` : ''}`}>查看个股分析</Link><Link className="min-h-12 rounded-xl bg-[var(--sc-primary)] text-[var(--sc-on-primary)] border border-[var(--sc-border)] px-4 py-3 text-sm font-semibold" href={`/trading/ledger${symbol ? `?symbol=${symbol}` : ''}`}>记录交易</Link><Link className="min-h-12 rounded-xl border border-[var(--sc-border)] px-4 py-3 text-sm font-semibold" href={`/chart${symbol ? `?symbol=${symbol}` : ''}`}>打开 K 线</Link></div></div>
  }
  if (tab === 'ledger') return <LedgerContent symbol={symbol} trades={trades} onTradeSaved={onTradeSaved} />
  if (tab === 'predictions') return <PredictionContent symbol={symbol} predictions={predictions} />
  const buys = trades.filter((trade) => trade.side === 'buy').length
  const sells = trades.filter((trade) => trade.side === 'sell').length
  return <div className="sc-trading-stat-grid"><article className="sc-trading-stat-card rounded-xl bg-[var(--sc-surface-muted)] p-4"><p className="text-sm text-[var(--sc-muted)]">交易总数</p><p className="mt-2 text-2xl font-semibold">{trades.length}</p></article><article className="sc-trading-stat-card rounded-xl bg-[var(--sc-surface-muted)] p-4"><p className="text-sm text-[var(--sc-muted)]">买入 / 卖出</p><p className="mt-2 text-2xl font-semibold">{buys} / {sells}</p></article><article className="sc-trading-stat-card rounded-xl bg-[var(--sc-surface-muted)] p-4"><p className="text-sm text-[var(--sc-muted)]">预测快照</p><p className="mt-2 text-2xl font-semibold">{predictions.length}</p></article></div>
}

function LedgerContent({ symbol, trades, onTradeSaved }: { symbol?: string | null; trades: TradeRecord[]; onTradeSaved: (trade: TradeRecord) => void }) {
  const [open, setOpen] = useState(false)
  const [stock, setStock] = useState(symbol ?? '')
  const [side, setSide] = useState<TradeRecord['side']>('buy')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [note, setNote] = useState('')
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const formId = useId()
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const numericQuantity = Number(quantity), numericPrice = Number(price)
    const next: Record<string, string> = {}
    if (!/^\d{6}$/.test(stock.trim())) next.stock = '请输入 6 位股票代码。'
    if (!Number.isSafeInteger(numericQuantity) || numericQuantity <= 0) next.quantity = '数量须为大于 0 的整数。'
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) next.price = '请输入大于 0 的成交价格。'
    setErrors(next)
    if (Object.keys(next).length) {
      event.currentTarget.querySelector<HTMLInputElement>(`[name="${Object.keys(next)[0]}"]`)?.focus()
      return
    }
    try {
      const trade: TradeRecord = { id: createRecordId('trade'), symbol: stock.trim(), side, quantity: numericQuantity, price: numericPrice, fee: 0, tradedAt: new Date().toISOString(), note: note.trim(), revision: Date.now() }
      addRecord('trades', trade)
      void saveAccountTrade(trade, getClientId(), getAuthorizationHeader()).catch(() => undefined)
      void syncRecord('trades', trade).catch(() => undefined)
      onTradeSaved(trade)
      setMessage('交易已保存')
      setQuantity(''); setPrice(''); setNote(''); setOpen(false)
    } catch { setErrors({ save: '本机保存失败，请检查存储权限后重试。填写内容已保留。' }) }
  }
  const clearError = (field: string) => setErrors(previous => ({ ...previous, [field]: '' }))
  return <div className="sc-ledger-view">
    <div className="sc-ledger-heading"><div><h2>交易流水</h2><p>记录实际成交，在线时自动同步。</p></div><button className="sc-button is-primary" onClick={() => { setOpen(true); setErrors({}); setMessage('') }} type="button">记录交易</button></div>
    {open ? <AppDialog title="新增交易" description="填写实际成交信息，保存后更新持仓。" onClose={() => setOpen(false)} footer={<><button className="sc-button" onClick={() => setOpen(false)} type="button">取消</button><button className="sc-button is-primary" form={formId} type="submit">保存交易</button></>}>
      <form id={formId} className="sc-form" onSubmit={submit} noValidate>
        <label>股票代码<input aria-label="交易股票代码" name="stock" inputMode="numeric" autoComplete="off" maxLength={6} placeholder="例如 600519" value={stock} onChange={event => { setStock(event.target.value); clearError('stock') }} aria-invalid={Boolean(errors.stock)} aria-describedby={errors.stock ? `${formId}-stock-error` : undefined} />{errors.stock ? <small id={`${formId}-stock-error`} className="sc-field-error">{errors.stock}</small> : null}</label>
        <div className="sc-form-grid"><label>交易方向<select aria-label="交易方向" value={side} onChange={event => setSide(event.target.value as TradeRecord['side'])}><option value="buy">买入</option><option value="sell">卖出</option></select></label>
        <label>数量（股）<input aria-label="交易数量" name="quantity" inputMode="numeric" type="number" min="1" step="1" value={quantity} onChange={event => { setQuantity(event.target.value); clearError('quantity') }} aria-invalid={Boolean(errors.quantity)} aria-describedby={errors.quantity ? `${formId}-quantity-error` : undefined} />{errors.quantity ? <small id={`${formId}-quantity-error`} className="sc-field-error">{errors.quantity}</small> : null}</label></div>
        <label>成交价格（元）<input aria-label="成交价格" name="price" inputMode="decimal" type="number" min="0.01" step="0.01" value={price} onChange={event => { setPrice(event.target.value); clearError('price') }} aria-invalid={Boolean(errors.price)} aria-describedby={errors.price ? `${formId}-price-error` : undefined} />{errors.price ? <small id={`${formId}-price-error`} className="sc-field-error">{errors.price}</small> : null}</label>
        <label>备注（可选）<textarea aria-label="交易备注" rows={2} maxLength={1000} value={note} onChange={event => setNote(event.target.value)} /></label>
        {errors.save ? <p role="alert" className="sc-field-error">{errors.save}</p> : null}
        <p className="sc-form-note">成交时间记为当前时间；离线时先保存在本机。</p>
      </form>
    </AppDialog> : null}
    {message ? <p className="sc-inline-status" role="status">{message}</p> : null}
    {trades.length ? <div className="sc-trade-list">{trades.slice().reverse().map(trade => <article className="sc-trade-record" key={trade.id}><header><strong>{trade.symbol}</strong><span className={trade.side === 'buy' ? 'sc-positive' : 'sc-negative'}>{trade.side === 'buy' ? '买入' : '卖出'} {trade.quantity} 股</span></header><p>成交价 ¥{trade.price.toFixed(2)} <time dateTime={trade.tradedAt}>{new Date(trade.tradedAt).toLocaleString('zh-CN')}</time></p>{trade.note ? <p>{trade.note}</p> : null}<Link className="sc-button" href={`/?symbol=${trade.symbol}`}>在趋势中查看</Link></article>)}</div> : <div className="sc-empty-state"><h2>还没有交易记录</h2><p>点击“记录交易”，填写股票代码、方向、数量与成交价格。</p></div>}
  </div>
}

function PredictionContent({ symbol, predictions }: { symbol?: string | null; predictions: PredictionRecord[] }) {
  return <div className="space-y-4">{predictions.length ? predictions.slice().reverse().map((prediction) => <article className="rounded-xl border border-[var(--sc-border)] p-4" key={prediction.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{prediction.securityName}（{prediction.symbol}）</p><p className="mt-1 text-sm text-[var(--sc-muted)]">{({ short: '短线', swing: '波段', long: '中长线' } as Record<string, string>)[prediction.cycle] ?? prediction.cycle} · 信心度 {(prediction.confidence * 100).toFixed(0)}%</p></div><span className="rounded-full bg-[var(--sc-surface-muted)] px-3 py-1 text-sm">{({ ENTER: '买入', EXIT: '卖出', HOLD: '持有', REDUCE: '减仓', AVOID: '回避', WAIT: '等待' } as Record<string, string>)[prediction.direction] ?? prediction.direction}</span></div><p className="mt-3 text-sm">支撑 ¥{formatAmount(prediction.support)} · 压力 ¥{formatAmount(prediction.resistance)} · 目标 ¥{formatAmount(prediction.target)}</p><Link className="mt-3 inline-flex text-sm font-semibold text-[var(--sc-primary)]" href={`/?symbol=${prediction.symbol}`}>查看对应股票趋势</Link></article>) : <div className="rounded-xl border border-dashed border-[var(--sc-border)] p-6"><p className="font-medium">暂无预测记录</p><p className="mt-2 text-sm text-[var(--sc-muted)]">从个股分析保存预测快照后，会在这里形成可追踪记录。</p><Link className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-[var(--sc-primary)] px-4 text-sm font-semibold text-[var(--sc-on-primary)]" href={`/analysis/key-levels${symbol ? `?symbol=${symbol}` : ''}`}>从个股分析创建预测</Link></div>}</div>
}

function formatAmount(value: number | null) {
  return value == null ? '—' : value.toFixed(2)
}
