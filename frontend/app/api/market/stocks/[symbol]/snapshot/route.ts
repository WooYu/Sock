import { NextResponse } from 'next/server'
import { getMarketSnapshot } from '@/lib/api/backend-client'

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
    return NextResponse.json(await getMarketSnapshot(symbol))
  } catch {
    return NextResponse.json({ message: '行情暂时不可用' }, { status: 502 })
  }
}
