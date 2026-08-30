import { NextResponse } from 'next/server'
import { explainStrategy } from '@/lib/api/backend-client'

export async function POST(request: Request) {
  const payload = await request.json()
  if (!payload || typeof payload !== 'object' || typeof payload.decision !== 'string') {
    return NextResponse.json({ message: '策略决策输入不完整' }, { status: 400 })
  }
  try {
    const authorization = request.headers.get('authorization') ?? undefined
    return NextResponse.json(await explainStrategy(payload, authorization))
  } catch {
    return NextResponse.json({ message: '策略解释暂时不可用' }, { status: 502 })
  }
}
