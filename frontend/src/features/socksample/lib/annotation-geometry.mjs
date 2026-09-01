const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export function moveTrendEndpoint(drawing, endpoint, point, bounds) {
  const next = { ...drawing, [endpoint === "start" ? "x" : "x2"]: clamp(point.x, 0, bounds.width), [endpoint === "start" ? "y" : "y2"]: clamp(point.y, 0, bounds.height) };
  return next;
}
export function resizeRectangle(drawing, point, bounds) {
  return { ...drawing, x2: clamp(point.x, 0, bounds.width), y2: clamp(point.y, 0, bounds.height) };
}

export function updateAnnotationFromDrag(drawing, drag, point, bounds) {
  const nextPoint = { x: clamp(point.x, 0, bounds.width), y: clamp(point.y, 0, bounds.height) };
  if (drawing.tool === "trend") {
    if (drag.handle === "start") return moveTrendEndpoint(drawing, "start", nextPoint, bounds);
    if (drag.handle === "end") return moveTrendEndpoint(drawing, "end", nextPoint, bounds);
    const dx = nextPoint.x - drag.start.x; const dy = nextPoint.y - drag.start.y;
    return { ...drawing, x: clamp(drawing.x + dx, 0, bounds.width), y: clamp(drawing.y + dy, 0, bounds.height), x2: clamp((drawing.x2 ?? drawing.x) + dx, 0, bounds.width), y2: clamp((drawing.y2 ?? drawing.y) + dy, 0, bounds.height) };
  }
  if (drawing.tool === "rect") {
    if (drag.handle !== "body") {
      const left = Math.min(drawing.x, drawing.x2 ?? drawing.x); const right = Math.max(drawing.x, drawing.x2 ?? drawing.x); const top = Math.min(drawing.y, drawing.y2 ?? drawing.y); const bottom = Math.max(drawing.y, drawing.y2 ?? drawing.y);
      const next = { left, right, top, bottom };
      if (drag.handle.includes("w")) next.left = nextPoint.x; if (drag.handle.includes("e")) next.right = nextPoint.x;
      if (drag.handle.includes("n")) next.top = nextPoint.y; if (drag.handle.includes("s")) next.bottom = nextPoint.y;
      return { ...drawing, x: clamp(next.left, 0, bounds.width), y: clamp(next.top, 0, bounds.height), x2: clamp(next.right, 0, bounds.width), y2: clamp(next.bottom, 0, bounds.height) };
    }
    const dx = nextPoint.x - drag.start.x; const dy = nextPoint.y - drag.start.y;
    return { ...drawing, x: clamp(drawing.x + dx, 0, bounds.width), y: clamp(drawing.y + dy, 0, bounds.height), x2: clamp((drawing.x2 ?? drawing.x) + dx, 0, bounds.width), y2: clamp((drawing.y2 ?? drawing.y) + dy, 0, bounds.height) };
  }
  return drawing;
}

