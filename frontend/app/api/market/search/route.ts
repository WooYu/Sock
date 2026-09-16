import { NextResponse } from 'next/server'
import { searchSecurities } from '@/lib/api/backend-client'
import { searchPublicSecurities, PublicMarketError } from '@/lib/api/public-market'

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q') ?? ''
  try {
    return NextResponse.json(await (process.env.STOCKCAL_API_BASE_URL ? searchSecurities(query) : searchPublicSecurities(query)))
  } catch (error) {
    if (!process.env.STOCKCAL_API_BASE_URL && error instanceof PublicMarketError) return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    return NextResponse.json({ message: '行情搜索暂时不可用' }, { status: 502 })
  }
}
