import { NextResponse } from 'next/server'
import { isChartPeriod } from '@/features/chart/chart-periods'
import { getPublicChartSeries, PublicMarketError } from '@/lib/api/public-market'

export const runtime = 'nodejs'

export async function GET(request: Request, context: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await context.params
  const params = new URL(request.url).searchParams
  const period = params.get('period') ?? 'day'
  const adjustment = params.get('adjustment') ?? 'none'
  if (!isChartPeriod(period)) return NextResponse.json({ code: 'MARKET_PERIOD_INVALID', message: '不支持的行情周期' }, { status: 400 })
  if (adjustment !== 'none' && adjustment !== 'qfq' && adjustment !== 'hfq') return NextResponse.json({ code: 'MARKET_ADJUSTMENT_INVALID', message: '不支持的复权方式' }, { status: 400 })
  try {
    return NextResponse.json(await getPublicChartSeries(symbol, period, adjustment), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof PublicMarketError) return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    return NextResponse.json({ code: 'PUBLIC_MARKET_UNAVAILABLE', message: '公开行情暂时不可用，请稍后重试' }, { status: 502 })
  }
}
