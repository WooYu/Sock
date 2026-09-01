import { NextResponse } from 'next/server'
import { approveKnowledgeDraft } from '@/lib/api/backend-client'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  try {
    return NextResponse.json(await approveKnowledgeDraft(id, request.headers.get('authorization') ?? undefined))
  } catch {
    return NextResponse.json({ message: '知识草稿批准失败' }, { status: 502 })
  }
}
