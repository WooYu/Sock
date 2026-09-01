export const STORAGE_KEY = "keyline-prototype-state-v1";

export function createDefaultPrototypeState() {
  return {
    version: 1,
    predictionRecords: [],
    tradeRecords: [],
    positions: [],
    annotations: [],
    rules: [],
    dailyReviews: [],
    portfolio: [],
  };
}

function isPrototypeState(value) {
  return Boolean(
    value &&
      value.version === 1 &&
      Array.isArray(value.predictionRecords) &&
      Array.isArray(value.tradeRecords) &&
      Array.isArray(value.positions) &&
      Array.isArray(value.annotations) &&
      Array.isArray(value.rules) &&
      Array.isArray(value.dailyReviews),
      Array.isArray(value.portfolio),
  );
}

export function loadPrototypeState(storage) {
  try {
    const raw = storage?.getItem?.(STORAGE_KEY) ?? storage?.get?.(STORAGE_KEY);
    if (!raw) return createDefaultPrototypeState();
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    return isPrototypeState(value) ? value : createDefaultPrototypeState();
  } catch {
    return createDefaultPrototypeState();
  }
}

export function savePrototypeState(storage, state) {
  const value = JSON.stringify({ ...state, version: 1 });
  if (storage?.setItem) storage.setItem(STORAGE_KEY, value);
  else storage?.set?.(STORAGE_KEY, value);
}

