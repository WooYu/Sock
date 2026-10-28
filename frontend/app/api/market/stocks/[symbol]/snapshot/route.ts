import { NextResponse } from 'next/server'
import { managedSnapshot } from '@/lib/api/market-manager'
import { PublicMarketError } from '@/lib/api/public-market'

export async function GET(_request: Request, context: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await context.params
  try {
    return NextResponse.json(await managedSnapshot(symbol), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof PublicMarketError) return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    return NextResponse.json({ message: '行情暂时不可用' }, { status: 502 })
  }
}
