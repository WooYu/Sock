'use client'

import { useState } from 'react'
import { extractKnowledgeSource, importKnowledgeSource, type KnowledgeSource } from '@/lib/api/knowledge-client'

type ImportFn = (path: string, content: string) => Promise<KnowledgeSource>
type ExtractFn = (id: string) => Promise<unknown[]>

export function MarkdownImportPanel({ importSource = importKnowledgeSource, extractSource = extractKnowledgeSource }: { importSource?: ImportFn; extractSource?: ExtractFn }) {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [sourceName, setSourceName] = useState('我的经验.md')
  const [markdown, setMarkdown] = useState('')
  const [naturalLanguage, setNaturalLanguage] = useState('')

  const submitSource = async (path: string, content: string, successMessage: string) => {
    if (!content.trim()) return
    setBusy(true)
    try {
      const source = await importSource(path, content)
      await extractSource(source.id)
      setMessage(successMessage)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '经验识别失败')
    } finally { setBusy(false) }
  }

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    let submitted = 0
    try {
      for (const file of Array.from(files)) {
        if (!file.name.toLowerCase().endsWith('.md')) continue
        const source = await importSource(file.name, await file.text())
        await extractSource(source.id)
        submitted += 1
      }
      setMessage(`已提交 ${submitted} 个 Markdown 来源`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Markdown 导入失败')
    } finally { setBusy(false) }
  }

  return <section className="sc-import-panel" aria-labelledby="markdown-import-title">
    <div><p className="sc-eyebrow">来源导入 · 保留证据</p><h2 id="markdown-import-title">导入股票笔记</h2><p>支持 Markdown 文件、粘贴内容和自然语言；导入后先生成草稿，审批发布前不会参与分析。</p></div>
    <div className="sc-import-actions">
      <label className="sc-import-button">{busy ? '识别中…' : '选择 Markdown'}<input aria-label="导入 Markdown" accept=".md,text/markdown" disabled={busy} multiple onChange={(event) => void onFiles(event.target.files)} type="file" /></label>
      <label className="sc-import-field">来源名称<input aria-label="来源名称" value={sourceName} onChange={(event) => setSourceName(event.target.value)} /></label>
    </div>
    <div className="sc-import-editors">
      <label>粘贴 Markdown<textarea aria-label="粘贴 Markdown" value={markdown} onChange={(event) => setMarkdown(event.target.value)} placeholder="保留标题、列表和原文证据…" /></label>
      <button disabled={busy || !markdown.trim()} onClick={() => void submitSource(sourceName || '我的经验.md', markdown, '已提交 1 个 Markdown 来源')} type="button">识别粘贴内容</button>
      <label>自然语言经验<textarea aria-label="自然语言经验" value={naturalLanguage} onChange={(event) => setNaturalLanguage(event.target.value)} placeholder="例如：短线回踩 MA5 不破再观察…" /></label>
      <button disabled={busy || !naturalLanguage.trim()} onClick={() => void submitSource('自然语言经验.md', naturalLanguage, '已提交 1 条自然语言经验')} type="button">识别自然语言</button>
    </div>
    {message ? <p role="status">{message}</p> : null}
  </section>
}
