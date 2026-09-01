const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

export function weightedMedian(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  const valid = items
    .filter((item) => Number.isFinite(item?.price) && Number.isFinite(item?.weight) && item.weight > 0)
    .sort((a, b) => a.price - b.price);

  if (valid.length === 0) {
    return null;
  }

  const totalWeight = valid.reduce((sum, item) => sum + item.weight, 0);
  let runningWeight = 0;

  for (const item of valid) {
    runningWeight += item.weight;
    if (runningWeight >= totalWeight / 2) {
      return item.price;
    }
  }

  return valid.at(-1).price;
}

export function mergeZones(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return [];
  }

  const sorted = candidates
    .filter(
      (item) =>
        Number.isFinite(item?.price) &&
        Number.isFinite(item?.low) &&
        Number.isFinite(item?.high) &&
        item.low <= item.high,
    )
    .sort((a, b) => a.low - b.low);

  const groups = [];
  for (const candidate of sorted) {
    const previous = groups.at(-1);
    if (!previous || candidate.low > previous.high) {
      groups.push({ low: candidate.low, high: candidate.high, sources: [candidate] });
      continue;
    }

    previous.high = Math.max(previous.high, candidate.high);
    previous.sources.push(candidate);
  }

  return groups.map((group) => ({
    low: group.low,
    high: group.high,
    representative: weightedMedian(group.sources),
    strength: group.sources.reduce((sum, item) => sum + (item.weight ?? 1), 0),
    sourceIds: group.sources.map((item) => item.id),
    sources: group.sources,
  }));
}

export function shrinkReliability(score, effectiveSampleSize) {
  if (!Number.isFinite(score) || !Number.isFinite(effectiveSampleSize) || effectiveSampleSize <= 0) {
    return null;
  }

  return round(50 + (effectiveSampleSize / (effectiveSampleSize + 30)) * (score - 50));
}

export function getReachableRange({ price, atr, volatilityMultiplier, legalLimitPct }) {
  if (
    ![price, atr, volatilityMultiplier, legalLimitPct].every(Number.isFinite) ||
    price <= 0 ||
    atr < 0 ||
    volatilityMultiplier < 0 ||
    legalLimitPct < 0
  ) {
    throw new TypeError("Reachable range inputs must be valid non-negative numbers.");
  }

  const volatilityRadius = atr * volatilityMultiplier;
  const legalRadius = price * legalLimitPct;
  const radius = Math.min(volatilityRadius, legalRadius);

  return {
    low: round(price - radius),
    high: round(price + radius),
    radius: round(radius),
  };
}

export function filterReachable(candidates, range) {
  if (!Array.isArray(candidates) || !range) {
    return [];
  }

  return candidates.filter(
    (item) => Number.isFinite(item?.price) && item.price >= range.low && item.price <= range.high,
  );
}

