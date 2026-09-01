const round = (value) => Number((Number.isFinite(value) ? value : 0).toFixed(2));

export function calculatePortfolioSummary(positions = [], prices = {}) {
  const rows = positions.map((position) => {
    const quantity = Number(position.quantity) || 0;
    const avgCost = Number(position.avgCost) || 0;
    const price = Number(prices[position.symbol] ?? position.price) || 0;
    const marketValue = quantity * price;
    const totalCost = quantity * avgCost;
    const floatingPnl = marketValue - totalCost;
    const realizedPnl = Number(position.realizedPnl) || 0;
    return {
      symbol: position.symbol,
      name: position.name,
      quantity,
      avgCost: round(avgCost),
      price: round(price),
      marketValue: round(marketValue),
      floatingPnl: round(floatingPnl),
      realizedPnl: round(realizedPnl),
      returnRate: totalCost ? round((floatingPnl / totalCost) * 100) : 0,
    };
  });
  const totalCost = rows.reduce((sum, row) => sum + row.quantity * row.avgCost, 0);
  const marketValue = rows.reduce((sum, row) => sum + row.marketValue, 0);
  const floatingPnl = rows.reduce((sum, row) => sum + row.floatingPnl, 0);
  const realizedPnl = rows.reduce((sum, row) => sum + row.realizedPnl, 0);
  const totalPnl = floatingPnl + realizedPnl;
  return {
    stockCount: rows.filter((row) => row.quantity > 0).length,
    totalCost: round(totalCost), marketValue: round(marketValue),
    floatingPnl: round(floatingPnl), realizedPnl: round(realizedPnl),
    totalPnl: round(totalPnl), returnRate: totalCost ? round((totalPnl / totalCost) * 100) : 0, rows,
  };
}

