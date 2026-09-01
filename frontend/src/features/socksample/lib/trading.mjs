const COMMISSION_RATE = 0.0003;
const MIN_COMMISSION = 5;
const STAMP_DUTY_RATE = 0.0005;
const TRANSFER_FEE_RATE = 0.00001;

const round = (value) => Number(value.toFixed(2));

export function calculateFees({ side, quantity, price }) {
  const amount = quantity * price;
  const commission = Math.max(MIN_COMMISSION, amount * COMMISSION_RATE);
  const stampDuty = side === "sell" ? amount * STAMP_DUTY_RATE : 0;
  const transferFee = amount * TRANSFER_FEE_RATE;
  return {
    amount: round(amount),
    commission: round(commission),
    stampDuty: round(stampDuty),
    transferFee: round(transferFee),
    total: round(commission + stampDuty + transferFee),
  };
}

export function calculatePositionState(trades, initialPosition, currentPrice) {
  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));
  const tradingDate = sorted.at(-1)?.date;
  let quantity = initialPosition.quantity;
  let cost = initialPosition.quantity * initialPosition.avgCost;
  let sellableQuantity = initialPosition.sellableQuantity;
  let realizedPnl = 0;

  for (const trade of sorted) {
    const fees = calculateFees(trade);
    if (trade.side === "buy") {
      quantity += trade.quantity;
      cost += trade.quantity * trade.price;
      if (!tradingDate || trade.date < tradingDate) sellableQuantity += trade.quantity;
    } else {
      const averageCost = quantity > 0 ? cost / quantity : 0;
      quantity -= trade.quantity;
      cost -= trade.quantity * averageCost;
      sellableQuantity -= trade.quantity;
      realizedPnl += (trade.price - averageCost) * trade.quantity - fees.total;
    }
  }

  const avgCost = quantity > 0 ? cost / quantity : 0;
  const marketValue = quantity * currentPrice;
  return {
    quantity,
    sellableQuantity: Math.max(0, sellableQuantity),
    avgCost: round(avgCost),
    marketValue: round(marketValue),
    realizedPnl: round(realizedPnl),
    floatingPnl: round((currentPrice - avgCost) * quantity),
    tradingDate,
  };
}

export function validateTrade(trade, position, marketState) {
  if (!Number.isFinite(trade.quantity) || trade.quantity <= 0) {
    return { valid: false, message: "请输入大于 0 的交易数量。", normalizedQuantity: trade.quantity };
  }
  if (!Number.isFinite(trade.price) || trade.price <= 0) {
    return { valid: false, message: "请输入大于 0 的成交价格。", normalizedQuantity: trade.quantity };
  }
  if (trade.side === "sell" && trade.quantity > position.sellableQuantity) {
    return { valid: false, message: `T+1 提示：当前最多可卖 ${position.sellableQuantity} 股。`, normalizedQuantity: trade.quantity };
  }
  if (trade.quantity % 100 !== 0) {
    return { valid: false, message: "A 股买入数量需为 100 股的整数倍。", normalizedQuantity: trade.quantity };
  }
  if (trade.side === "sell" && trade.date !== marketState.tradingDate) {
    return { valid: false, message: "交易日期与当前交易日不一致，请检查复盘日期。", normalizedQuantity: trade.quantity };
  }
  return { valid: true, message: "交易参数可保存。", normalizedQuantity: trade.quantity };
}

export function calculateDailyPnl(trades, initialPosition, currentPrice, tradingDate) {
  const state = calculatePositionState(trades, initialPosition, currentPrice);
  const dailyTrades = trades.filter((trade) => trade.date === tradingDate);
  const sells = dailyTrades.filter((trade) => trade.side === "sell");
  const buyAmount = dailyTrades.filter((trade) => trade.side === "buy").reduce((sum, trade) => sum + trade.quantity * trade.price, 0);
  const sellAmount = sells.reduce((sum, trade) => sum + trade.quantity * trade.price, 0);
  return {
    date: tradingDate,
    tradeCount: dailyTrades.length,
    buyAmount: round(buyAmount),
    sellAmount: round(sellAmount),
    realizedPnl: round(sells.reduce((sum, trade) => sum + (trade.price - (state.avgCost || trade.price)) * trade.quantity - calculateFees(trade).total, 0)),
    floatingPnl: state.floatingPnl,
  };
}

