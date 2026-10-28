import { matchingMarketIndices } from '@/lib/api/market-symbol'
import { NextResponse } from 'next/server'
import { searchSecurities } from '@/lib/api/backend-client'
import { searchPublicSecurities, PublicMarketError } from '@/lib/api/public-market'

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q') ?? ''
  const indices = matchingMarketIndices(query)
  if (indices.length && query.trim() !== '000852') return NextResponse.json(indices)
  try {
    const results = await (process.env.STOCKCAL_API_BASE_URL ? searchSecurities(query) : searchPublicSecurities(query))
    return NextResponse.json([...indices, ...results.filter(item => !indices.some(index => index.code === item.code))])
  } catch (error) {
    if (indices.length) return NextResponse.json(indices)
    if (!process.env.STOCKCAL_API_BASE_URL && error instanceof PublicMarketError) return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    return NextResponse.json({ message: '行情搜索暂时不可用' }, { status: 502 })
  }
}
