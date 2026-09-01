export function clampView(view) {
  return { zoom: Math.max(1, Math.min(4, view.zoom)), panX: Math.max(-240, Math.min(240, view.panX)), panY: Math.max(-80, Math.min(80, view.panY)) };
}
export function updateView(view, delta) { return clampView({ ...view, ...delta }); }
export function clientToChartPoint(point, rect, view, chart) {
  return { x: (-view.panX) + (point.x - rect.left) / rect.width * (chart.width / view.zoom), y: (-view.panY) + (point.y - rect.top) / rect.height * (chart.height / view.zoom) };
}

