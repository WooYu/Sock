export type CandleRow = ReadonlyArray<number>;

export function aggregateCandles(
  candleRows: ReadonlyArray<CandleRow>,
  dates: ReadonlyArray<string>,
  period: string,
): Array<{ date: string; values: CandleRow }>;
