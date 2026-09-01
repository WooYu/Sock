export type WeightedItem = { price: number; weight: number };
export type ZoneCandidate = WeightedItem & {
  id: string;
  low: number;
  high: number;
  [key: string]: unknown;
};

export function weightedMedian(items: WeightedItem[]): number | null;
export function mergeZones(candidates: ZoneCandidate[]): Array<{
  low: number;
  high: number;
  representative: number | null;
  strength: number;
  sourceIds: string[];
  sources: ZoneCandidate[];
}>;
export function shrinkReliability(score: number, effectiveSampleSize: number): number | null;
export function getReachableRange(input: {
  price: number;
  atr: number;
  volatilityMultiplier: number;
  legalLimitPct: number;
}): { low: number; high: number; radius: number };
export function filterReachable<T extends { price: number }>(
  candidates: T[],
  range: { low: number; high: number },
): T[];

