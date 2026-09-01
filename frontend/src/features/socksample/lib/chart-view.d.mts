export type ChartView = { zoom: number; panX: number; panY: number };
export type ChartPoint = { x: number; y: number };
export type ChartBounds = { width: number; height: number };

export function clampView(view: ChartView): ChartView;
export function updateView(view: ChartView, delta: Partial<ChartView>): ChartView;
export function clientToChartPoint(
  point: ChartPoint,
  rect: Pick<DOMRect, "left" | "top" | "width" | "height">,
  view: ChartView,
  chart: ChartBounds,
): ChartPoint;
