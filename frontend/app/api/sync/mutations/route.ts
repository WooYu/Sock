import { NextResponse } from 'next/server'
import { applySyncMutation, BackendRequestError } from '@/lib/api/backend-client'

export async function POST(request: Request) {
  const payload = await request.json()
  if (!payload || typeof payload !== 'object' || typeof payload.idempotencyKey !== 'string' || typeof payload.entityType !== 'string' || typeof payload.entityId !== 'string' || typeof payload.operation !== 'string' || typeof payload.revision !== 'number') {
    return NextResponse.json({ message: '同步变更格式不正确' }, { status: 400 })
  }
  try {
    return NextResponse.json(await applySyncMutation(payload, request.headers.get('x-client-id') ?? undefined, request.headers.get('authorization') ?? undefined))
  } catch (error) {
    if (error instanceof BackendRequestError) return NextResponse.json(error.body ?? { message: '同步写入失败' }, { status: error.status })
    return NextResponse.json({ message: '同步写入暂时不可用' }, { status: 502 })
  }
}
