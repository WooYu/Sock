import { NextResponse } from 'next/server'
import { getPortfolio } from '@/lib/api/backend-client'

export async function GET(request: Request) {
  try {
    return NextResponse.json(await getPortfolio(
      request.headers.get('x-client-id') ?? undefined,
      request.headers.get('authorization') ?? undefined,
    ))
  } catch {
    return NextResponse.json({ message: '账户数据暂时不可用' }, { status: 502 })
  }
}
