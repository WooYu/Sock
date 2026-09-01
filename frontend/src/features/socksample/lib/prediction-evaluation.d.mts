export type ActualMarket = { high: number; low: number };

export type EvaluatedPrediction<T> = T & {
  status: "待评估" | "命中" | "偏离";
  tradeStatus: string;
  reason: string;
  actual?: ActualMarket;
};

export function evaluatePredictionRecords<T extends {
  validDate: string;
  target: string;
  support: string;
  keyPoint: string;
  tradeStatus?: string;
}>(
  records: ReadonlyArray<T>,
  actualByDate: Readonly<Record<string, ActualMarket>>,
  today: string,
): Array<EvaluatedPrediction<T>>;
