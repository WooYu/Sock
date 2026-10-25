import { isShanghaiComposite } from '@/lib/api/market-symbol'
import { NextResponse } from 'next/server'
import { getMarketSnapshot } from '@/lib/api/backend-client'
import { getPublicMarketSnapshot, PublicMarketError } from '@/lib/api/public-market'

const validSymbol = /^[A-Za-z0-9]{1,12}$/

export async function GET(
  _request: Request,
  context: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await context.params
  if (!validSymbol.test(symbol)) {
    return NextResponse.json({ message: '股票代码格式不正确' }, { status: 400 })
  }
  try {
    if (!process.env.STOCKCAL_API_BASE_URL || isShanghaiComposite(symbol)) return NextResponse.json(await getPublicMarketSnapshot(symbol))
    const snapshot = await getMarketSnapshot(symbol)
    if (snapshot.adjustment === 'qfq') return NextResponse.json(snapshot)
    // Legacy backends supply raw, short history. Keep their quote while using
    // explicitly adjusted, sufficient daily history for every indicator consumer.
    const adjusted = await getPublicMarketSnapshot(symbol)
    return NextResponse.json({ ...snapshot, adjustment: 'qfq', dailyCandles: adjusted.dailyCandles,
      source: { ...adjusted.source, name: `${adjusted.source.name} · 报价 ${snapshot.source.name}` } })
  } catch (error) {
    if ((!process.env.STOCKCAL_API_BASE_URL || isShanghaiComposite(symbol)) && error instanceof PublicMarketError) return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    return NextResponse.json({ message: '行情暂时不可用' }, { status: 502 })
  }
}
