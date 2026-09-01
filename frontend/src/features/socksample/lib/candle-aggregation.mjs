function keyFor(date, period) { const d = new Date(`${date}T00:00:00Z`); if (period === "月线") return `${d.getUTCFullYear()}-${d.getUTCMonth()}`; const monday = new Date(d); monday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return monday.toISOString().slice(0, 10); }
export function aggregateCandles(candleRows, dates, period) {
  if (period === "日线") return candleRows.map((row, index) => ({ date: dates[index], values: row }));
  const groups = new Map();
  candleRows.forEach((values, index) => { const key = keyFor(dates[index], period); const item = groups.get(key) ?? { date: dates[index], open: values[0], high: values[1], low: values[2], close: values[3] }; item.high = Math.max(item.high, values[1]); item.low = Math.min(item.low, values[2]); item.close = values[3]; groups.set(key, item); });
  return [...groups.values()].map((item) => ({ date: item.date, values: [item.open, item.high, item.low, item.close] }));
}

