const round = (value) => Number(value.toFixed(0));

export function calculateReviewSummary({ prediction, actual, tradeCount, realizedPnl, floatingPnl }) {
  const fields = ["keyPoint", "target", "support"];
  const tolerance = { keyPoint: 0.15, target: 0.25, support: 0.2 };
  const correctionTolerance = 0.1;
  const available = fields.filter((field) => Number.isFinite(actual[field]));
  const hitCount = available.filter((field) => Math.abs(actual[field] - prediction[field]) <= tolerance[field]).length;
  const correctionCount = available.filter((field) => Math.abs(actual[field] - prediction[field]) > correctionTolerance).length;
  const hitRate = available.length === 0 ? 0 : round((hitCount / fields.length) * 100);
  const totalPnl = Number((realizedPnl + floatingPnl).toFixed(2));
  const conclusion = available.length < fields.length ? "等待补充实际结果" : hitRate >= 67 ? "判断基本命中" : "需要复盘修正";
  return { hitCount, hitRate, correctionCount, tradeCount, realizedPnl, floatingPnl, totalPnl, conclusion };
}

