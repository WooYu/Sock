# Task 6 report: prediction details and object inspector

## Implementation

- Added `PredictionDetails` with one `predictionRows(day)` value model for all twelve required values.
- Added a collapsible semantic desktop table with selectable three-day column headers.
- Added a mobile detail sheet with three controlled date tabs and a two-column definition list.
- Added the warning copy `推演数据，不是实际行情` and an investment-reference disclaimer.
- Added `ObjectInspector` with accessible style, text, point-price, visibility and lock controls.
- Numeric inspector inputs emit changes only for finite values within their input domain.
- Locked drawings disable editing, visibility and deletion while retaining the unlock action.
- Deletion requires browser confirmation.
- Added direct toolbar actions for `buy`, `sell`, `target` and `stop-loss`.
- Added the `未来推演` layer switch and connected details, layer visibility and the chart candle to one selected-day state.
- Routed inspector edits through the existing `DrawingEngine` commands.
- Added scoped component presentation styles without changing the Task 8 editor layout.

## TDD evidence

RED:

```text
npm.cmd test -- src/features/chart/prediction-details.test.tsx src/features/chart/object-inspector.test.tsx
Test Files  2 failed (2)
Reason: the two requested component modules did not exist.
```

GREEN:

```text
npm.cmd test -- src/features/chart/prediction-details.test.tsx src/features/chart/object-inspector.test.tsx
Test Files  2 passed (2)
Tests       11 passed (11)
```

Task 6 integration GREEN before the concurrent Task 7 state migration:

```text
npm.cmd test -- src/features/chart/prediction-details.test.tsx src/features/chart/object-inspector.test.tsx src/features/chart/chart-workspace.test.tsx
Test Files  3 passed (3)
Tests       30 passed (30)
```

Targeted lint:

```text
npm.cmd run lint -- src/features/chart/prediction-details.tsx src/features/chart/prediction-details.test.tsx src/features/chart/object-inspector.tsx src/features/chart/object-inspector.test.tsx src/features/chart/chart-toolbar.tsx src/features/chart/chart-layer-panel.tsx src/features/chart/chart-workspace.tsx src/features/chart/chart-workspace.test.tsx src/features/chart/chart-canvas.tsx src/features/chart/prediction-layer.tsx
exit 0
```

## Files

- `frontend/src/features/chart/prediction-details.tsx`
- `frontend/src/features/chart/prediction-details.test.tsx`
- `frontend/src/features/chart/object-inspector.tsx`
- `frontend/src/features/chart/object-inspector.test.tsx`
- `frontend/src/features/chart/chart-layer-panel.tsx`
- `frontend/src/features/chart/chart-toolbar.tsx`
- `frontend/src/features/chart/chart-workspace.tsx`
- `frontend/src/features/chart/chart-workspace.test.tsx`
- `frontend/src/features/chart/chart-canvas.tsx`
- `frontend/src/features/chart/prediction-layer.tsx`
- `frontend/app/workspace-polish.css`

## Coordination and concerns

- Task 7 concurrently changed workspace serialization to strict v2 after the 30/30 Task 6 integration run. Until Task 7 replaces the old v1 workspace effect, the workspace suite reports `Invalid chart workspace v2`; the two Task 6 component suites still pass.
- Task 7 integration must preserve the `prediction` layer default and route the inspector commands through its replacement workspace hook.
- Task 8 still owns the three-column editor rails, fixed mobile actions, chart height and final responsive composition.
