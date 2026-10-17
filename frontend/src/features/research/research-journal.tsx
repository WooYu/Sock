'use client'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { currentTagRecords, parseTagLedger, NOTE_TAG_STORAGE_KEY, type NoteCatalog } from '../knowledge/note-tags'
import type { MarketSnapshot } from '../workspace/stock-workspace-types'
import { projectIndicators, type IndicatorProjection } from '../chart/indicator-projection'
import { scenarioCalendar } from '../scenario/scenario-calendar-data'

type Citation = { id: string; title: string; sourceUrl: string; sourceHash: string; excerpt: string; version: number; tags: string[] }
type Judgment = { id: string; createdAt: string; judgment: string; invalidation: string; next: string; anchorPrice: number; marketAsOf: string; barDay: string; citations: Citation[]; forecast: IndicatorProjection[] }
type Journal = { schemaVersion: 1; stage: string; next: string; records: Judgment[] }
const stages = ['关注中', '研究中', '待验证', '已结束']
export const journalKey = (symbol: string) => 'stockcal.research-journal.v1:' + symbol
export function parseJournal(raw: string | null): Journal {
  if (!raw) return { schemaVersion: 1, stage: '关注中', next: '', records: [] }
  const value = JSON.parse(raw) as Journal
  if (value.schemaVersion !== 1 || !stages.includes(value.stage) || typeof value.next !== 'string' || !Array.isArray(value.records)
    || !value.records.every(r => typeof r.id === 'string' && typeof r.judgment === 'string' && typeof r.invalidation === 'string' && typeof r.next === 'string' && typeof r.createdAt === 'string' && Number.isFinite(r.anchorPrice) && r.anchorPrice > 0 && Array.isArray(r.citations) && r.citations.every(c => typeof c.sourceUrl === 'string' && typeof c.sourceHash === 'string') && Array.isArray(r.forecast))) throw new Error('研究记录格式异常，请先保留浏览器中的原记录。')
  return value
}
export function ResearchJournal({ market, demo = false }: { market: MarketSnapshot; demo?: boolean }) {
  const symbol = market.quote.security.code
  const [catalog, setCatalog] = useState<NoteCatalog | null>(null), [noteError, setNoteError] = useState('')
  const [journal, setJournal] = useState<Journal>({ schemaVersion: 1, stage: '关注中', next: '', records: [] })
  const [ready, setReady] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [judgment, setJudgment] = useState(''), [invalidation, setInvalidation] = useState(''), [query, setQuery] = useState(''), [noteIds, setNoteIds] = useState<string[]>([])
  const notes = useMemo(() => (catalog?.documents ?? []).filter(n => !query.trim() || [n.title, n.summary, n.file].join(' ').toLowerCase().includes(query.trim().toLowerCase())).slice(0, 12), [catalog, query])
  useEffect(() => {
    const read = () => { try { setJournal(parseJournal(localStorage.getItem(journalKey(symbol)))); setReady(true); setError('') } catch (e) { setReady(false); setError(e instanceof Error ? e.message : '记录读取失败。') } }
    queueMicrotask(read)
    const update = (event: StorageEvent) => { if (event.key === null || event.key === journalKey(symbol)) read() }
    window.addEventListener('storage', update)
    return () => window.removeEventListener('storage', update)
  }, [symbol])
  async function loadNotes() {
    if (catalog) return
    try { const loaded = await import('../knowledge/note-tag-catalog.json'); setCatalog(loaded.default as NoteCatalog); setNoteError('') }
    catch { setNoteError('笔记目录加载失败，请收起后重新展开重试。') }
  }
  function write(next: Journal) { localStorage.setItem(journalKey(symbol), JSON.stringify(next)); setJournal(next); setError(''); window.dispatchEvent(new Event('stockcal:research-journal')) }
  function update(field: 'stage' | 'next', value: string) {
    try { const current = parseJournal(localStorage.getItem(journalKey(symbol))); write({ ...current, [field]: value }) }
    catch { setError('保存失败，请检查浏览器存储权限；原记录仍保留。') }
  }
  function save(event: FormEvent) {
    event.preventDefault()
    if (!ready || !judgment.trim() || !invalidation.trim()) return
    try {
      const current = parseJournal(localStorage.getItem(journalKey(symbol)))
      const record: Judgment = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), judgment: judgment.trim(), invalidation: invalidation.trim(), next: journal.next,
        anchorPrice: market.quote.price, marketAsOf: market.source.fetchedAt, barDay: market.dailyCandles.at(-1)?.day ?? '',
        citations: currentTagRecords(catalog?.documents ?? [], parseTagLedger(localStorage.getItem(NOTE_TAG_STORAGE_KEY))).filter(n => noteIds.includes(n.id)).map(n => ({ id: n.id, title: n.title, sourceUrl: n.sourceUrl, sourceHash: n.sourceHash, excerpt: n.sourceExcerpt, version: n.version, tags: [...n.tags] })),
        forecast: projectIndicators(market.dailyCandles, 'day', scenarioCalendar) }
      write({ ...current, stage: '待验证', records: [record, ...current.records] })
      setJudgment(''); setInvalidation(''); setNoteIds([]); setNotice('已保存当时的判断、行情、日线预测和笔记引用，可继续追加新判断。')
    } catch { setError('保存失败，输入已保留。请检查浏览器存储权限或空间。') }
  }
  function exportJournal() {
    try {
      const blob = new Blob([JSON.stringify({ symbol, ...parseJournal(localStorage.getItem(journalKey(symbol))) }, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = symbol + '-研究记录.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { setError('导出失败，请检查记录读取权限。') }
  }
  return <details className="rs-research-journal"><summary>研究记录 · {journal.stage} · {journal.records.length} 次判断{journal.next ? ` · 下一步：${journal.next}` : ''}</summary>
    <p>记录保存在当前浏览器，按股票区分；导出可备份。{demo ? '此处为示例股票的独立记录。' : ''}</p>
    {error ? <p role="alert">{error}</p> : null}{notice ? <p role="status">{notice}</p> : null}
    <div className="rs-journal-fields"><label>研究状态<select aria-label="研究状态" value={journal.stage} disabled={!ready} onChange={e => update('stage', e.target.value)}>{stages.map(s => <option key={s}>{s}</option>)}</select></label><label>下一步做什么<input aria-label="下一步做什么" value={journal.next} disabled={!ready} maxLength={200} onChange={e => { const value = e.target.value; setJournal(j => ({ ...j, next: value })); update('next', value) }} placeholder="如：观察收盘能否站稳MA20" /></label></div>
    <form onSubmit={save}><div className="rs-journal-fields"><label>当前判断<textarea value={judgment} onChange={e => setJudgment(e.target.value)} maxLength={4000} required rows={3} /></label><label>判断失效条件<textarea value={invalidation} onChange={e => setInvalidation(e.target.value)} maxLength={4000} required rows={3} placeholder="写清哪些价格、时间或事实变化会推翻判断" /></label></div>
      <details onToggle={event => { if (event.currentTarget.open) void loadNotes() }}><summary>引用笔记原文 · 已选 {noteIds.length} 篇</summary>{noteError ? <p role="alert">{noteError}</p> : !catalog ? <p role="status">正在读取笔记目录…</p> : null}<label>搜索引用笔记<input value={query} onChange={e => setQuery(e.target.value)} placeholder="按标题或内容搜索" /></label><div className="rs-journal-note-list">{notes.map(n => <label key={n.id}><input type="checkbox" checked={noteIds.includes(n.id)} onChange={e => setNoteIds(ids => e.target.checked ? [...ids, n.id] : ids.filter(id => id !== n.id))} />{n.title}<a href={n.sourceUrl} target="_blank" rel="noopener noreferrer">原文 ↗</a></label>)}</div><Link href="/knowledge?view=notes">打开笔记标签目录</Link></details>
      <button className="rs-button" type="submit" disabled={!ready || !Number.isFinite(market.quote.price) || market.quote.price <= 0}>保存判断与日线预测快照</button>
    </form>
    <div className="rs-journal-links"><button type="button" className="rs-button" disabled={!ready} onClick={exportJournal}>导出研究记录</button><Link href={`/knowledge?view=samples&symbol=${encodeURIComponent(symbol)}`}>查看这只股票的学习样本与核对结果</Link></div>
    {journal.records.slice(0, 10).map(record => <article key={record.id}><strong>{new Date(record.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })} · 当时 {record.anchorPrice.toFixed(2)}</strong><p>{record.judgment}</p><p>失效条件：{record.invalidation}</p>{record.next ? <p>当时下一步：{record.next}</p> : null}<p>当前较记录时价格变化：{((market.quote.price / record.anchorPrice - 1) * 100).toFixed(2)}% · 价格对照不等于判断已验证</p><small>行情截至 {record.marketAsOf} · 最新日K {record.barDay}</small><div>{record.citations.map(note => <a key={note.id} href={note.sourceUrl} target="_blank" rel="noopener noreferrer">{note.title} · v{note.version} 原文 ↗</a>)}</div><details><summary>保存时的4日日线指标预测</summary>{record.forecast.map(point => <p key={point.day}>{point.estimated ? '预计 ' : ''}{point.day}：{Object.entries(point.values).map(([key, value]) => `${key.toUpperCase()} ${value?.toFixed(2) ?? '—'}`).join(' / ')}</p>)}</details></article>)}
    {journal.records.length > 10 ? <p>显示最近10次；导出包含全部历史。</p> : null}
  </details>
}
