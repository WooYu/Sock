const rangePattern = /([0-9]+(?:\.[0-9]+)?)(?:\s*[～~\-]\s*([0-9]+(?:\.[0-9]+)?))?/;

function parseRange(value) {
  const match = String(value ?? "").match(rangePattern);
  if (!match) return null;
  const first = Number(match[1]);
  const second = Number(match[2] ?? match[1]);
  return Number.isFinite(first) && Number.isFinite(second)
    ? [Math.min(first, second), Math.max(first, second)]
    : null;
}

function touchesRange(actual, range) {
  return Boolean(range && actual && actual.high >= range[0] && actual.low <= range[1]);
}

export function evaluatePredictionRecords(records, actualByDate = {}, today) {
  return records.map((record) => {
    if (record.validDate > today) {
      return { ...record, status: "待评估", tradeStatus: record.tradeStatus ?? "未交易", reason: "预测仍在有效窗口" };
    }

    const actual = actualByDate[record.validDate];
    if (!actual || !Number.isFinite(actual.high) || !Number.isFinite(actual.low)) {
      return { ...record, status: "待评估", tradeStatus: record.tradeStatus ?? "未交易", reason: "缺少实际行情" };
    }

    const target = parseRange(record.target);
    const support = parseRange(record.support);
    const keyPoint = parseRange(record.keyPoint);
    const targetTouched = actual.high >= (target?.[0] ?? Number.POSITIVE_INFINITY);
    const supportTouched = touchesRange(actual, support);
    const keyPointTouched = touchesRange(actual, keyPoint);
    const reason = targetTouched ? "目标位已触达" : supportTouched ? "支撑位已触达" : keyPointTouched ? "关键点已触达" : "关键位未触达";
    return {
      ...record,
      status: targetTouched || supportTouched || keyPointTouched ? "命中" : "偏离",
      tradeStatus: record.tradeStatus ?? "未交易",
      reason,
      actual,
    };
  });
}

