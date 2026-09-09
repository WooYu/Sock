import { NextResponse } from 'next/server'
import { BackendRequestError, pullSyncChanges } from '@/lib/api/backend-client'

export async function GET(request: Request) {
  const cursor = Number(new URL(request.url).searchParams.get('cursor') ?? '0')
  if (!Number.isSafeInteger(cursor) || cursor < 0) return NextResponse.json({ message: '同步游标不正确' }, { status: 400 })
  try {
    return NextResponse.json(await pullSyncChanges(cursor, request.headers.get('x-client-id') ?? undefined, request.headers.get('authorization') ?? undefined))
  } catch (error) {
    if (error instanceof BackendRequestError) return NextResponse.json(error.body ?? { message: '同步读取失败' }, { status: error.status })
    return NextResponse.json({ message: '同步读取暂时不可用' }, { status: 502 })
  }
}
