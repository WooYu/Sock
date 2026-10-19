'use client'

import { useEffect, useRef, useState } from 'react'
import { TAG_LABELS, type AIOriginalTags, type DualTagResult, type NoteTagRecord } from './note-tags'

export function NoteTagReextract({ record, disabled, onAdopt }: { record: NoteTagRecord; disabled: boolean; onAdopt: (candidate: AIOriginalTags) => void }) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<DualTagResult | null>(null)
  const [error, setError] = useState('')
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  async function reextract() {
    const request = new AbortController()
    controller.current = request
    setBusy(true); setError(''); setResult(null)
    try {
      const response = await fetch('/api/note-tag-extraction', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: request.signal,
        body: JSON.stringify({ id: record.id, sourceHash: record.sourceHash }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.message || '提取失败，请稍后重试。')
      if (payload.id !== record.id || payload.sourceHash !== record.sourceHash) throw new Error('原文版本不一致，请刷新后重试。')
      setResult(payload)
    } catch (cause) { if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : '提取失败，请稍后重试。') }
    finally { if (!request.signal.aborted) setBusy(false) }
  }
  const candidate = result?.candidate
  const added = candidate?.tags.filter(tag => !record.tags.includes(tag)) ?? []
  const removed = candidate ? record.tags.filter(tag => !candidate.tags.includes(tag)) : []
  const labels = (tags: string[]) => tags.map(tag => TAG_LABELS[tag]).join('、') || '无'
  return <section className="nt-extraction nt-reextract" aria-label="双 AI 重新提取">
    <h4>双 AI 原文标签</h4>
    <p>DeepSeek 与本地 Codex 独立读取完整原文，仅将一致标签作为候选。提取后可预览变化，再保存新版本。</p>
    <button type="button" className="kw-button" disabled={disabled || busy} onClick={reextract}>{busy ? '双 AI 正在提取…' : '双 AI 重新提取标签'}</button>
    {busy ? <p role="status">两侧模型正在独立提取，可能需要几分钟。当前标签保持不变。</p> : null}
    {error ? <p role="alert">{error}</p> : null}
    {result ? <div className="nt-reextract-result" aria-live="polite">
      {result.models.map(model => <details key={model.name} open={Boolean(model.error)}><summary>{model.name} · {model.error ? '未完成' : `${model.tags?.length ?? 0} 个标签`}</summary>{model.error ? <p role="alert">{model.error}</p> : <><p>{labels(model.tags ?? [])}</p><p>{model.note}</p>{model.evidence?.map(item => <blockquote className="nt-source" key={item.tagId}>{TAG_LABELS[item.tagId]} · L{item.startLine}–{item.endLine}<br />{item.quote}<br />{item.reason}</blockquote>)}</>}</details>)}
      {candidate ? <><p><strong>双模型一致：</strong>{labels(candidate.tags)}</p><p>新增：{labels(added)}<br />移除：{labels(removed)}</p>{!candidate.tags.length ? <p>本次没有一致标签，采用后将得到空标签候选，请先核对原文。</p> : null}
        {candidate.extraction.disagreements.length ? <div><strong>模型分歧（未采用）</strong><ul>{candidate.extraction.disagreements.map(item => <li key={`${item.model}:${item.tagId}`}>{TAG_LABELS[item.tagId]} · {item.model}</li>)}</ul></div> : null}
        <button type="button" className="kw-button" disabled={disabled} onClick={() => onAdopt(candidate)}>采用本次结果并编辑</button>
      </> : <p>两侧尚未全部成功，不能作为双 AI 共识采用。可重试，或继续手动编辑标签。</p>}
    </div> : null}
  </section>
}
