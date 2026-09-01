import { NextResponse } from 'next/server'
import { getKnowledgeDrafts } from '@/lib/api/backend-client'

export async function GET(request: Request) {
  try {
    return NextResponse.json(await getKnowledgeDrafts(
      new URL(request.url).searchParams.get('status') ?? undefined,
      request.headers.get('authorization') ?? undefined,
    ))
  } catch {
    return NextResponse.json({ message: '知识草稿暂时不可用' }, { status: 502 })
  }
}
