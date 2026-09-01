const round = (value) => Number(value.toFixed(2));

export function calculateBacktestSummary(rows) {
  const trades = rows.filter((row) => row.side === "sell");
  const wins = trades.filter((row) => row.pnl > 0);
  const totalPnl = rows.reduce((sum, row) => sum + (row.pnl || 0), 0);
  let peak = 0;
  let equity = 0;
  let maxDrawdown = 0;
  const equityCurve = rows.map((row) => {
    equity += row.pnl || 0;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
    return { date: row.date, equity: round(equity) };
  });
  return {
    signalCount: rows.length,
    tradeCount: trades.length,
    winRate: trades.length ? Math.round((wins.length / trades.length) * 100) : 0,
    totalPnl: round(totalPnl),
    maxDrawdown: round(maxDrawdown),
    equityCurve,
  };
}

