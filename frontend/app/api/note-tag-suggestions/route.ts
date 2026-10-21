import { ACTIVE_TAG_LABELS as TAG_LABELS } from '@/features/knowledge/note-tags'
import { getAIConfiguration } from '@/lib/ai-config'
import { suggestSupplement } from '../../../scripts/note-tag-suggestions.mjs'

export async function POST(request: Request) {
  let input
  try { input = await request.json() } catch { return Response.json({ message: '输入格式无效' }, { status: 400 }) }
  if (!input || typeof input.source !== 'string' || !input.source.trim() || input.source.length > 50000 || typeof input.supplement !== 'string' || !input.supplement.trim() || input.supplement.length > 5000 || !Array.isArray(input.tags) || !input.tags.every((tag: unknown) => typeof tag === 'string' && Object.hasOwn(TAG_LABELS, tag))) return Response.json({ message: '请提供原文、有效标签和补充说明（最多 5000 字）' }, { status: 400 })
  if (process.env.VERCEL || process.env.STOCKCAL_TAG_REMOTE === 'true') {
    const backend = process.env.STOCKCAL_RECORDS_API_BASE_URL || process.env.STOCKCAL_API_BASE_URL
    if (!backend) return Response.json({ message: '标签建议服务尚未配置' }, { status: 503 })
    try {
      const authorization = request.headers.get('authorization')
      const response = await fetch(new URL('/api/v1/note-tag-suggestions', backend), {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) },
        body: JSON.stringify({ source: input.source, tags: input.tags, supplement: input.supplement }), signal: AbortSignal.timeout(55000), cache: 'no-store',
      })
      return Response.json(await response.json(), { status: response.status })
    } catch { return Response.json({ message: '标签建议服务连接失败，请重试。输入已保留。' }, { status: 502 }) }
  }
  const { apiKey, baseUrl, model } = getAIConfiguration()
  if (!apiKey) return Response.json({ message: '标签建议服务尚未配置，请先手动编辑标签；补充说明仍可保存。' }, { status: 503 })
  try { return Response.json({ suggestions: await suggestSupplement(input, { apiKey, baseUrl, model }) }) }
  catch { return Response.json({ message: '标签建议生成失败，请重试；输入已保留，也可以手动调整标签。' }, { status: 502 }) }
}
