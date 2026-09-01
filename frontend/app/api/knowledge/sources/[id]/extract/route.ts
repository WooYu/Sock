import { NextResponse } from 'next/server'
import { extractKnowledgeSource } from '@/lib/api/backend-client'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  try { return NextResponse.json(await extractKnowledgeSource(id, request.headers.get('authorization') ?? undefined)) } catch { return NextResponse.json({ message: '知识来源识别暂时不可用' }, { status: 502 }) }
}
