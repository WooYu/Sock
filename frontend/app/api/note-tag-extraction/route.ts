import catalog from '@/features/knowledge/note-tag-catalog.json'
import type { DualTagResult, NoteTagRecord } from '@/features/knowledge/note-tags'
import { getProposal } from '@/lib/knowledge/note-study-proposals'
import { extractNoteTags } from '@/lib/knowledge/note-tag-extraction'

export const runtime = 'nodejs'
export const maxDuration = 300
const pending = new Map<string, Promise<DualTagResult>>()

export async function POST(request: Request) {
  let input
  try { input = await request.json() } catch { return Response.json({ message: '输入格式无效' }, { status: 400 }) }
  if (!input || typeof input.id !== 'string' || typeof input.sourceHash !== 'string') return Response.json({ message: '请指定笔记及原文版本' }, { status: 400 })
  const record = catalog.documents.find(item => item.id === input.id)
  if (!record) return Response.json({ message: '仅支持目录中的整篇笔记' }, { status: 404 })
  if (record.sourceHash !== input.sourceHash) return Response.json({ message: '原文版本已变化，请刷新后重新提取' }, { status: 409 })
  const proposal = getProposal(record.file)
  if (!proposal || proposal.study.sourceHash !== record.sourceHash) return Response.json({ message: '尚未找到此版本完整原文，不能使用片段代替全文提取' }, { status: 409 })
  if (process.env.VERCEL || process.env.STOCKCAL_TAG_REMOTE === 'true') {
    const backend = process.env.STOCKCAL_RECORDS_API_BASE_URL || process.env.STOCKCAL_API_BASE_URL
    if (!backend) return Response.json({ message: '双 AI 提取服务尚未配置' }, { status: 503 })
    try {
      const authorization = request.headers.get('authorization')
      const response = await fetch(new URL('/api/v1/note-tag-extraction', backend), {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) },
        body: JSON.stringify({ id: record.id, sourceHash: record.sourceHash }), signal: AbortSignal.timeout(290000), cache: 'no-store',
      })
      return Response.json(await response.json(), { status: response.status })
    } catch { return Response.json({ message: '双 AI 提取服务连接失败，请稍后重试。当前标签未修改。' }, { status: 502 }) }
  }
  const key = `${record.id}@${record.sourceHash}`
  let task = pending.get(key)
  if (!task) {
    if (pending.size >= 2) return Response.json({ message: '正在提取其他笔记，请稍后重试' }, { status: 429 })
    task = extractNoteTags(record as NoteTagRecord, proposal.sourceText).finally(() => { pending.delete(key) })
    pending.set(key, task)
  }
  try { return Response.json(await task) }
  catch { return Response.json({ message: '双 AI 提取未完成，请检查服务配置后重试。当前标签未修改。' }, { status: 502 }) }
}
