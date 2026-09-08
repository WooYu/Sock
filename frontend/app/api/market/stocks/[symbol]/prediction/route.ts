import { NextResponse } from 'next/server'
import type { ChartPeriod } from '@/features/chart/chart-types'
import { BackendRequestError, getPredictionSnapshot } from '@/lib/api/backend-client'

const validSymbol = /^[A-Za-z0-9]{1,12}$/
const periods: readonly string[] = ['day', 'week', 'month']

export async function GET(
  request: Request,
  context: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await context.params
  if (!validSymbol.test(symbol)) {
    return NextResponse.json({ code: 'PREDICTION_SYMBOL_INVALID', message: '股票代码格式不正确' }, { status: 400 })
  }
  const period = new URL(request.url).searchParams.get('period') ?? 'day'
  if (!periods.includes(period)) {
    return NextResponse.json({ code: 'PREDICTION_PERIOD_UNSUPPORTED', message: '预测仅支持日线周期' }, { status: 400 })
  }
  try {
    return NextResponse.json(await getPredictionSnapshot(symbol, period as ChartPeriod, request.headers.get('authorization') ?? undefined))
  } catch (error) {
    if (error instanceof BackendRequestError) {
      return NextResponse.json(error.body ?? { message: error.message }, { status: error.status })
    }
    return NextResponse.json({ message: '预测暂时不可用' }, { status: 502 })
  }
}
