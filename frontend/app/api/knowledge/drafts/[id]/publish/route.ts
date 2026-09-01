import { NextResponse } from 'next/server'
import { publishKnowledgeDraft } from '@/lib/api/backend-client'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  try {
    return NextResponse.json(await publishKnowledgeDraft(id, request.headers.get('authorization') ?? undefined), { status: 201 })
  } catch {
    return NextResponse.json({ message: '知识规则发布失败' }, { status: 502 })
  }
}
