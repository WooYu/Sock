import { NextResponse } from 'next/server'
import { pullSyncChanges } from '@/lib/api/backend-client'

export async function GET(request: Request) {
  const cursor = Number(new URL(request.url).searchParams.get('cursor') ?? '0')
  if (!Number.isSafeInteger(cursor) || cursor < 0) return NextResponse.json({ message: '同步游标不正确' }, { status: 400 })
  try {
    return NextResponse.json(await pullSyncChanges(cursor, request.headers.get('x-client-id') ?? undefined, request.headers.get('authorization') ?? undefined))
  } catch {
    return NextResponse.json({ message: '同步读取暂时不可用' }, { status: 502 })
  }
}
