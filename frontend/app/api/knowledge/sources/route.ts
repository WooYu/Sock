import { NextResponse } from 'next/server'
import { importKnowledgeSource } from '@/lib/api/backend-client'

export async function POST(request: Request) {
  const body = await request.json()
  if (!body || typeof body.path !== 'string' || typeof body.content !== 'string' || !body.content.trim()) return NextResponse.json({ message: 'Markdown 来源格式不正确' }, { status: 400 })
  try { return NextResponse.json(await importKnowledgeSource(body.path, body.content, request.headers.get('authorization') ?? undefined), { status: 201 }) } catch { return NextResponse.json({ message: '知识来源导入暂时不可用' }, { status: 502 }) }
}
