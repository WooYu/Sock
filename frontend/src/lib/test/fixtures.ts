export const demoSecurity = {
  code: '600519',
  name: '贵州茅台',
  exchange: 'SSE',
}

export function demoMarketSnapshot(symbol = demoSecurity.code) {
  return {
    symbol,
    quote: {
      security: demoSecurity,
      price: 1742,
      previousClose: 1729,
      open: 1735,
      high: 1750,
      low: 1728,
      volume: 18000,
      turnover: 31356000,
      limitRatio: 0.1,
    },
    dailyCandles: [],
    source: {
      name: '测试行情',
      fetchedAt: '2026-08-27T09:30:00.000Z',
      state: 'DELAYED',
      online: true,
    },
    price: 1742,
    change: 13,
    changePercent: 0.75,
    fetchedAt: '2026-08-27T09:30:00.000Z',
    state: 'delayed' as const,
  }
}
