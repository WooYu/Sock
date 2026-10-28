import { NextResponse } from 'next/server'
import { managedSearch } from '@/lib/api/market-manager'
import { PublicMarketError } from '@/lib/api/public-market'

export async function GET(request: Request) {
  try {
    return NextResponse.json(await managedSearch(new URL(request.url).searchParams.get('q') ?? ''))
  } catch (error) {
    if (error instanceof PublicMarketError) return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    return NextResponse.json({ message: '行情搜索暂时不可用' }, { status: 502 })
  }
}
