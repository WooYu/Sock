import { NextResponse } from 'next/server'
import { saveAccountTrade } from '@/lib/api/backend-client'

export async function POST(request: Request) {
  const payload = await request.json()
  if (!payload || typeof payload !== 'object' || typeof payload.id !== 'string' || typeof payload.symbol !== 'string') {
    return NextResponse.json({ message: '交易数据格式不正确' }, { status: 400 })
  }
  try {
    return NextResponse.json(await saveAccountTrade(
      payload,
      request.headers.get('x-client-id') ?? undefined,
      request.headers.get('authorization') ?? undefined,
    ))
  } catch {
    return NextResponse.json({ message: '交易保存暂时不可用' }, { status: 502 })
  }
}
