'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { createRecordId, loadRecords, saveRecords } from '../records/record-store'
import type { PredictionRecord, ReviewRecord, TradeRecord } from '../records/record-types'
import { syncRecord } from '../records/record-sync'
import { RecordSyncButton } from '../records/record-sync-button'

export type ReviewTab = 'daily' | 'trade' | 'history' | 'backtest'
const tabs: Array<[ReviewTab, string]> = [['daily', '当日总结'], ['trade', '单笔复盘'], ['history', '历史复盘'], ['backtest', '规则回测']]
const dailySections = ['市场判断', '执行情况', '改进点'] as const
type DailySection = typeof dailySections[number]
type DailyDraft = Record<DailySection, string>

function emptyDailyDraft(): DailyDraft { return { 市场判断: '', 执行情况: '', 改进点: '' } }

function parseDailyDraft(content: string): DailyDraft {
  const match = /^## 市场判断\n([\s\S]*?)\n\n## 执行情况\n([\s\S]*?)\n\n## 改进点\n([\s\S]*)$/.exec(content)
  return match ? { 市场判断: match[1], 执行情况: match[2], 改进点: match[3] } : { ...emptyDailyDraft(), 市场判断: content }
}

function serializeDailyDraft(draft: DailyDraft) { return dailySections.map((section) => `## ${section}\n${draft[section]}`).join('\n\n') }

export function ReviewPage({ initialTab = 'daily', tradeId, predictionId }: { initialTab?: ReviewTab; tradeId?: string | null; predictionId?: string | null }) {
  const [tab, setTab] = useState<ReviewTab>(initialTab)
  const label = tabs.find(([key]) => key === tab)?.[1] ?? '当日总结'
  return <section className="sc-review-workspace"><div className="sc-review-header"><div><RecordSyncButton /><p className="text-sm text-[var(--sc-muted)]">复盘工作台</p><h1 className="mt-1 text-2xl font-semibold">{label}</h1></div></div><div className="sc-workspace-tabs" role="tablist" aria-label="复盘内容">{tabs.map(([key, name]) => <Link className={tab === key ? 'is-active' : ''} data-active={tab === key} href={`/review/${key}`} key={key} onClick={() => setTab(key)} role="tab" aria-selected={tab === key}>{name}</Link>)}</div><div className="sc-review-content">{tab === 'daily' ? <DailyReview /> : null}{tab === 'trade' ? <TradeReview tradeId={tradeId} predictionId={predictionId} /> : null}{tab === 'history' ? <ReviewHistory /> : null}{tab === 'backtest' ? <Backtest /> : null}</div></section>
}

function DailyReview() {
  const [draft, setDraft] = useState<DailyDraft>(() => {
    const today = new Date().toISOString().slice(0, 10)
    return parseDailyDraft(loadRecords<ReviewRecord>('reviews').find((review) => review.date === today && !review.tradeId)?.content ?? '')
  })
  const [message, setMessage] = useState('')
  const save = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const today = new Date().toISOString().slice(0, 10); const records = loadRecords<ReviewRecord>('reviews').filter((review) => !(review.date === today && !review.tradeId)); const review: ReviewRecord = { id: createRecordId('review'), date: today, content: serializeDailyDraft(draft), createdAt: new Date().toISOString() }; saveRecords('reviews', [...records, review]); void syncRecord('reviews', review).catch(() => undefined); setMessage('当日总结已保存') }
  return <form className="sc-daily-review-form" onSubmit={save}><div className="sc-daily-review-sections">{dailySections.map((section) => <label className="sc-daily-review-field" key={section}><span>{section}</span><textarea aria-label={section} className="sc-daily-review-input" onChange={(event) => setDraft((current) => ({ ...current, [section]: event.target.value }))} placeholder={section === '市场判断' ? '今天的市场结构、风险与关键位' : section === '执行情况' ? '实际执行、偏差与原因' : '下一次要保留或修正的动作'} value={draft[section]} /></label>)}</div><button className="sc-review-primary-action" type="submit">保存当日总结</button>{message ? <p className="text-sm text-emerald-700" role="status">{message}</p> : null}</form>
}

function TradeReview({ tradeId, predictionId }: { tradeId?: string | null; predictionId?: string | null }) {
  const trades = loadRecords<TradeRecord>('trades')
  const predictions = loadRecords<PredictionRecord>('predictions')
  const trade = trades.find((item) => item.id === tradeId) ?? trades.at(-1)
  const prediction = predictions.find((item) => item.id === predictionId) ?? predictions.at(-1)
  const [content, setContent] = useState('')
  const [message, setMessage] = useState('')
  const save = () => { if (!trade && !prediction) { setMessage('请先完成一笔交易或保存一个预测快照。'); return }; const records = loadRecords<ReviewRecord>('reviews'); const review: ReviewRecord = { id: createRecordId('review'), date: new Date().toISOString().slice(0, 10), content, tradeId: trade?.id, predictionId: prediction?.id, createdAt: new Date().toISOString() }; saveRecords('reviews', [...records, review]); void syncRecord('reviews', review).catch(() => undefined); setMessage('单笔复盘已保存') }
  return <div className="space-y-4"><div className="rounded-xl bg-[var(--sc-surface-muted)] p-4"><p className="font-medium">复盘对象</p><p className="mt-2 text-sm text-[var(--sc-muted)]">{trade ? `${trade.symbol} · ${trade.side === 'buy' ? '买入' : '卖出'} ${trade.quantity} 股 · ¥${trade.price.toFixed(2)}` : prediction ? `${prediction.securityName} · 预测${prediction.direction}` : '暂无可复盘记录'}</p></div><textarea aria-label="交易复盘内容" className="min-h-36 w-full rounded-xl border border-[var(--sc-border)] bg-transparent p-4 text-sm" onChange={(event) => setContent(event.target.value)} placeholder="记录这次判断、执行、结果和下一步改进" value={content} /><button className="min-h-12 rounded-xl bg-[var(--sc-primary)] px-4 text-sm font-semibold text-white" onClick={save} type="button">保存单笔复盘</button>{message ? <p className="text-sm text-emerald-700" role="status">{message}</p> : null}</div>
}

function ReviewHistory() {
  const records = loadRecords<ReviewRecord>('reviews')
  return records.length ? <div className="space-y-3">{records.slice().reverse().map((record) => <article className="rounded-xl border border-[var(--sc-border)] p-4" key={record.id}><p className="font-medium">{record.date}</p><p className="mt-2 whitespace-pre-wrap text-sm text-[var(--sc-muted)]">{record.content}</p></article>)}</div> : <ReviewEmpty title="历史复盘" action="前往交易流水选择记录" href="/trading/ledger" />
}

function Backtest() {
  const predictions = loadRecords<PredictionRecord>('predictions')
  return <div className="space-y-4 rounded-xl bg-[var(--sc-surface-muted)] p-5"><p className="font-medium">规则回测</p><p className="text-sm text-[var(--sc-muted)]">当前已有 {predictions.length} 条预测快照，可作为后续回测样本。</p><Link className="inline-flex min-h-12 items-center rounded-xl bg-[var(--sc-primary)] px-4 text-sm font-semibold text-white" href="/rules">前往规则库</Link></div>
}

function ReviewEmpty({ title, action, href }: { title: string; action: string; href: string }) { return <div className="rounded-xl border border-dashed border-[var(--sc-border)] p-6"><p className="font-medium">暂无{title}数据</p><p className="mt-2 text-sm text-[var(--sc-muted)]">完成交易或保存复盘后，这里会形成可追踪记录。</p><Link className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-[var(--sc-primary)] px-4 py-3 text-sm font-semibold text-white" href={href}>{action}</Link></div> }
