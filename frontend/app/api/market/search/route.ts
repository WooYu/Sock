import { NextResponse } from 'next/server'
import { searchSecurities } from '@/lib/api/backend-client'

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q') ?? ''
  try {
    return NextResponse.json(await searchSecurities(query))
  } catch {
    return NextResponse.json({ message: '行情搜索暂时不可用' }, { status: 502 })
  }
}
