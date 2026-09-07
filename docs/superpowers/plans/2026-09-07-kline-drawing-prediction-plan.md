# K 线绘图与未来推演 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有像素坐标 K 线升级为可编辑、可同步的时间/价格绘图工作区，并加入默认开启的未来 3 个交易日预测 K 线、MA/BOLL 延伸及明细查看。

**Architecture:** 将 `chart-workspace.tsx` 拆成纯计算、坐标变换、绘图状态、预测图层和响应式 UI 组件。后端提供版本化预测快照；前端基于历史与预测 OHLC 统一计算指标，并用版本 2 工作区协议持久化绘图对象。

**Tech Stack:** Next.js 16、React 19、TypeScript 5、SVG、Vitest、Testing Library、Playwright、Spring Boot 4、Java 21、JUnit 5

**Spec:** `docs/superpowers/specs/2026-09-07-kline-drawing-prediction-redesign.md`

## Global Constraints

- 本轮只实现 Web，不恢复或维护已删除的 Flutter 工程。
- 未来推演默认开启，只显示一套基准预测，固定未来 3 个真实交易日。
- 预测 OHLC 驱动 MA5、MA10、MA20 和 BOLL(20,2)，图表与明细必须使用同一数据。
- 预测数据只读；绘图锚点使用“周期 + 时间 + 价格”，禁止持久化屏幕像素。
- 日、周、月绘图独立保存；真实行情失败、预测失败和同步失败彼此隔离。
- A 股颜色为红涨绿跌，预测区域必须标注“推演数据，不是实际行情”。
- 桌面端显示下方可折叠明细表；手机端显示可拖动底部抽屉，触控目标不小于 44px。
- 不引入新的图表依赖；沿用 SVG、Vitest、Testing Library 和 Playwright。

---

## File Structure

### New frontend files

- `frontend/src/features/chart/chart-types.ts`：周期、绘图、预测和视图公共类型。
- `frontend/src/features/chart/chart-math.ts`：聚合、MA、BOLL、价格范围和交易日计算。
- `frontend/src/features/chart/chart-coordinates.ts`：时间/价格与 SVG 坐标双向转换。
- `frontend/src/features/chart/drawing-engine.ts`：不可变绘图命令、选择、拖动、控制点、撤销/重做。
- `frontend/src/features/chart/drawing-layer.tsx`：绘图对象渲染和命中区域。
- `frontend/src/features/chart/prediction-layer.tsx`：未来区域、预测蜡烛和指标延伸。
- `frontend/src/features/chart/prediction-details.tsx`：桌面表格和手机抽屉。
- `frontend/src/features/chart/object-inspector.tsx`：图层及对象属性编辑。
- `frontend/src/features/chart/chart-canvas.tsx`：组合行情、指标、预测和绘图 SVG 图层。
- `frontend/src/features/chart/use-chart-workspace.ts`：页面状态、保存节流和同步协调。
- 对应的 `*.test.ts(x)`：各模块单元和交互测试。

### New backend files

- `backend/src/main/java/com/stockcal/prediction/PredictionModels.java`：预测请求与响应记录。
- `backend/src/main/java/com/stockcal/prediction/PredictionService.java`：基准 OHLC 预测和指标计算。
- `backend/src/main/java/com/stockcal/prediction/PredictionController.java`：只读预测接口。
- `backend/src/test/java/com/stockcal/prediction/PredictionServiceTest.java`：确定性计算测试。
- `backend/src/test/java/com/stockcal/prediction/PredictionApiTest.java`：接口契约测试。

### Existing files to modify

- `frontend/src/features/workspace/stock-workspace-types.ts`
- `frontend/src/lib/api/backend-client.ts`
- `frontend/app/api/market/stocks/[symbol]/prediction/route.ts`
- `frontend/src/features/chart/chart-annotation-store.ts`
- `frontend/src/features/chart/chart-workspace-state.ts`
- `frontend/src/features/chart/chart-workspace-sync.ts`
- `frontend/src/features/chart/chart-toolbar.tsx`
- `frontend/src/features/chart/chart-layer-panel.tsx`
- `frontend/src/features/chart/chart-workspace.tsx`
- `frontend/src/features/chart/chart-workspace.test.tsx`
- `frontend/app/workspace-polish.css`
- `frontend/e2e/workspace-redesign.spec.ts`

---

### Task 1: Establish prediction and drawing contracts

**Files:**
- Create: `frontend/src/features/chart/chart-types.ts`
- Modify: `frontend/src/features/workspace/stock-workspace-types.ts`
- Test: `frontend/src/features/chart/chart-types.test.ts`

**Interfaces:**
- Produces: `ChartPeriod`, `TimePricePoint`, `DrawingObject`, `DrawingStyle`, `PredictionDay`, `PredictionSnapshot`, `ChartWorkspaceV2`.
- Consumes: existing `Candle` and `MarketSnapshot`.

- [ ] **Step 1: Write the failing contract test**

```ts
import { describe, expect, test } from 'vitest'
import { isPredictionSnapshot, migrateWorkspace } from './chart-types'

test('accepts exactly three ordered prediction days', () => {
  expect(isPredictionSnapshot({
    symbol: '600519',
    period: 'day',
    generatedAt: '2026-09-07T00:00:00Z',
    modelVersion: 'baseline-v1',
    days: [1, 2, 3].map((n) => ({
      day: `2026-09-0${n + 7}`,
      open: 10 + n, high: 12 + n, low: 9 + n, close: 11 + n,
      rangeLow: 9 + n, rangeHigh: 12 + n, confidence: 0.6,
    })),
  })).toBe(true)
})

test('migrates legacy pixel drawings without pretending coordinates are prices', () => {
  const result = migrateWorkspace({ version: 1, drawings: [{ id: 'old', kind: 'horizontal-line', start: { x: 10, y: 20 } }] })
  expect(result.version).toBe(2)
  expect(result.drawings).toEqual([])
  expect(result.legacyDrawingsDiscarded).toBe(1)
})
```

- [ ] **Step 2: Run the contract test and verify failure**

Run: `cd frontend && npm test -- src/features/chart/chart-types.test.ts`  
Expected: FAIL because `chart-types.ts` does not exist.

- [ ] **Step 3: Implement the explicit types and guards**

```ts
export type ChartPeriod = 'day' | 'week' | 'month'
export type TimePricePoint = { time: string; price: number }
export type DrawingKind = 'trend-line' | 'horizontal-line' | 'rectangle' | 'text' | 'buy' | 'sell' | 'target' | 'stop-loss'
export type DrawingStyle = { color: string; width: number; lineStyle: 'solid' | 'dashed'; opacity: number }
export type DrawingObject = {
  id: string
  symbol: string
  period: ChartPeriod
  kind: DrawingKind
  points: TimePricePoint[]
  style: DrawingStyle
  text?: string
  locked: boolean
  visible: boolean
  version: number
  updatedAt: string
}
export type PredictionDay = {
  day: string
  open: number
  high: number
  low: number
  close: number
  rangeLow: number
  rangeHigh: number
  confidence: number
}
export type PredictionSnapshot = {
  symbol: string
  period: ChartPeriod
  generatedAt: string
  modelVersion: string
  days: [PredictionDay, PredictionDay, PredictionDay]
}
```

Add `prediction?: PredictionSnapshot | null` to `StockWorkspaceSnapshot`. Implement guards that require finite prices, `0 <= confidence <= 1`, ordered dates, and exactly three days. Migration must discard version-1 pixel drawings and report the count; it must never infer time or price from old x/y values.

- [ ] **Step 4: Run type and contract tests**

Run: `cd frontend && npm test -- src/features/chart/chart-types.test.ts src/features/chart/chart-workspace-state.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/chart/chart-types.ts frontend/src/features/chart/chart-types.test.ts frontend/src/features/workspace/stock-workspace-types.ts
git commit -m "feat(chart): define prediction and time-price drawing contracts"
```

---

### Task 2: Extract deterministic chart math and coordinate transforms

**Files:**
- Create: `frontend/src/features/chart/chart-math.ts`
- Create: `frontend/src/features/chart/chart-math.test.ts`
- Create: `frontend/src/features/chart/chart-coordinates.ts`
- Create: `frontend/src/features/chart/chart-coordinates.test.ts`
- Modify: `frontend/src/features/chart/chart-workspace.tsx`

**Interfaces:**
- Produces: `aggregateCandles(candles, period)`, `movingAverage(candles, size)`, `bollinger(candles, size, multiplier)`, `createChartTransform(input)`.
- `createChartTransform` returns `xForTime`, `timeForX`, `yForPrice`, `priceForY`.

- [ ] **Step 1: Write failing round-trip tests**

```ts
test('round trips time and price independent of viewport size', () => {
  const transform = createChartTransform({
    times: ['2026-09-01', '2026-09-02', '2026-09-03'],
    minPrice: 10,
    maxPrice: 20,
    rect: { left: 40, top: 20, width: 900, height: 300 },
  })
  expect(transform.timeForX(transform.xForTime('2026-09-02'))).toBe('2026-09-02')
  expect(transform.priceForY(transform.yForPrice(15))).toBeCloseTo(15, 6)
})
```

Add tests that MA5 and BOLL values include three appended prediction candles, and weekly/monthly aggregation retains existing calendar behavior.

- [ ] **Step 2: Verify tests fail**

Run: `cd frontend && npm test -- src/features/chart/chart-math.test.ts src/features/chart/chart-coordinates.test.ts`  
Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement pure functions and remove them from the React component**

```ts
export function createChartTransform(input: TransformInput): ChartTransform {
  const step = input.rect.width / Math.max(input.times.length, 1)
  return {
    xForTime: (time) => input.rect.left + (input.times.indexOf(time) + 0.5) * step,
    timeForX: (x) => input.times[Math.max(0, Math.min(input.times.length - 1, Math.floor((x - input.rect.left) / step)))],
    yForPrice: (price) => input.rect.top + ((input.maxPrice - price) / (input.maxPrice - input.minPrice)) * input.rect.height,
    priceForY: (y) => input.maxPrice - ((y - input.rect.top) / input.rect.height) * (input.maxPrice - input.minPrice),
  }
}
```

Clamp x/y inputs to the chart rect. Throw an explicit error when the time list is empty or `maxPrice <= minPrice`.

- [ ] **Step 4: Run focused and regression tests**

Run: `cd frontend && npm test -- src/features/chart/chart-math.test.ts src/features/chart/chart-coordinates.test.ts src/features/chart/chart-workspace.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/chart/chart-math* frontend/src/features/chart/chart-coordinates* frontend/src/features/chart/chart-workspace.tsx
git commit -m "refactor(chart): extract math and coordinate transforms"
```

---

### Task 3: Add the backend prediction snapshot API

**Files:**
- Create: `backend/src/main/java/com/stockcal/prediction/PredictionModels.java`
- Create: `backend/src/main/java/com/stockcal/prediction/PredictionService.java`
- Create: `backend/src/main/java/com/stockcal/prediction/PredictionController.java`
- Create: `backend/src/test/java/com/stockcal/prediction/PredictionServiceTest.java`
- Create: `backend/src/test/java/com/stockcal/prediction/PredictionApiTest.java`
- Create: `frontend/app/api/market/stocks/[symbol]/prediction/route.ts`
- Modify: `frontend/src/lib/api/backend-client.ts`

**Interfaces:**
- Produces backend endpoint: `GET /api/v1/market/stocks/{symbol}/prediction?period=day`.
- Produces frontend client: `getPredictionSnapshot(symbol: string, period: ChartPeriod): Promise<PredictionSnapshot>`.
- Consumes existing `MarketProvider.snapshot(symbol)` daily candles.

- [ ] **Step 1: Write failing service and API tests**

```java
@Test
void predictsExactlyThreeTradingDaysAndPreservesOhlcInvariants() {
  PredictionSnapshot result = service.predict("600519", ChartPeriod.DAY, history);
  assertThat(result.days()).hasSize(3);
  assertThat(result.days()).allSatisfy(day -> {
    assertThat(day.high()).isGreaterThanOrEqualTo(Math.max(day.open(), day.close()));
    assertThat(day.low()).isLessThanOrEqualTo(Math.min(day.open(), day.close()));
    assertThat(day.confidence()).isBetween(0.0, 1.0);
  });
}
```

The controller test must assert status 200, exactly three days, `modelVersion`, `generatedAt`, and no weekend dates. Add a 422 case for fewer than 20 historical candles.

- [ ] **Step 2: Verify backend tests fail**

Run: `cd backend && ./gradlew test --tests 'com.stockcal.prediction.*'`  
Expected: FAIL because the prediction package does not exist.

- [ ] **Step 3: Implement baseline-v1 deterministically**

Use the last 20 closes and true ranges. For day N:

```java
double drift = linearRegressionSlope(lastCloses);
double amplitude = median(lastTrueRanges);
double close = previousClose + drift;
double open = previousClose;
double high = Math.max(open, close) + amplitude * 0.5;
double low = Math.min(open, close) - amplitude * 0.5;
double confidence = Math.max(0.35, baseConfidence - 0.05 * dayIndex);
```

Clamp prices above zero, skip weekends and configured exchange holidays, and calculate MA5/10/20 plus BOLL(20,2) from history appended with each predicted close. Return 422 `PREDICTION_DATA_INSUFFICIENT` when fewer than 20 valid candles exist. This baseline is a deterministic technical projection, not an AI-generated claim.

- [ ] **Step 4: Implement the Next.js proxy and typed client**

```ts
export function getPredictionSnapshot(symbol: string, period: ChartPeriod) {
  return request<PredictionSnapshot>(
    `/api/v1/market/stocks/${encodeURIComponent(symbol)}/prediction?period=${period}`,
  )
}
```

The route must follow the existing market proxy pattern and preserve backend status codes.

- [ ] **Step 5: Run backend and frontend route tests**

Run: `cd backend && ./gradlew test --tests 'com.stockcal.prediction.*'`  
Run: `cd frontend && npm test -- app/api/market/market-route.test.ts src/lib/api/browser-client.test.ts`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/stockcal/prediction backend/src/test/java/com/stockcal/prediction frontend/app/api/market/stocks frontend/src/lib/api/backend-client.ts
git commit -m "feat(prediction): expose three-day baseline snapshot"
```

---

### Task 4: Build the time-price drawing engine

**Files:**
- Create: `frontend/src/features/chart/drawing-engine.ts`
- Create: `frontend/src/features/chart/drawing-engine.test.ts`
- Modify: `frontend/src/features/chart/chart-annotation-store.ts`

**Interfaces:**
- Produces: `DrawingEngine` with `create`, `select`, `move`, `movePoint`, `updateStyle`, `updateText`, `setVisible`, `setLocked`, `remove`, `undo`, `redo`.
- Consumes: `DrawingObject` and `TimePricePoint`.

- [ ] **Step 1: Write failing command-history tests**

```ts
test('moves a selected horizontal line in price space and undoes it', () => {
  const engine = new DrawingEngine([horizontalLine('line-1', 10)])
  engine.select('line-1')
  engine.move({ timeDelta: 0, priceDelta: 2.5 })
  expect(engine.current()[0].points[0].price).toBe(12.5)
  engine.undo()
  expect(engine.current()[0].points[0].price).toBe(10)
})

test('does not move locked objects', () => {
  const engine = new DrawingEngine([{ ...horizontalLine('line-1', 10), locked: true }])
  engine.select('line-1')
  expect(() => engine.move({ timeDelta: 0, priceDelta: 1 })).not.toThrow()
  expect(engine.current()[0].points[0].price).toBe(10)
})
```

Add tests for trend-line endpoint editing, rectangle normalization, copying with a new id, delete/undo, redo invalidation after a new command, and visibility.

- [ ] **Step 2: Verify tests fail**

Run: `cd frontend && npm test -- src/features/chart/drawing-engine.test.ts`  
Expected: FAIL because `DrawingEngine` is undefined.

- [ ] **Step 3: Implement immutable snapshots and bounded history**

Keep at most 100 undo states. Every mutation must increment the object version and update `updatedAt`. `movePoint` must reject invalid point indices and non-finite prices. Replace the old pixel-based store with a compatibility export that delegates to `DrawingEngine`.

- [ ] **Step 4: Run engine tests**

Run: `cd frontend && npm test -- src/features/chart/drawing-engine.test.ts src/features/chart/chart-workspace-state.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/chart/drawing-engine* frontend/src/features/chart/chart-annotation-store.ts
git commit -m "feat(chart): add time-price drawing engine"
```

---

### Task 5: Render prediction and editable drawing layers

**Files:**
- Create: `frontend/src/features/chart/prediction-layer.tsx`
- Create: `frontend/src/features/chart/prediction-layer.test.tsx`
- Create: `frontend/src/features/chart/drawing-layer.tsx`
- Create: `frontend/src/features/chart/drawing-layer.test.tsx`
- Create: `frontend/src/features/chart/chart-canvas.tsx`
- Modify: `frontend/src/features/chart/chart-workspace.tsx`

**Interfaces:**
- Produces: `PredictionLayer({ prediction, transform, hoveredDay, onHoverDay })`.
- Produces: `DrawingLayer({ drawings, transform, selectedId, onSelect, onMovePoint })`.
- Produces: `ChartCanvas` as the only component owning the SVG and pointer-coordinate conversion.

- [ ] **Step 1: Write failing layer tests**

```tsx
test('separates three predicted candles from real candles', () => {
  render(<PredictionLayer prediction={prediction} transform={transform} hoveredDay={null} onHoverDay={() => {}} />)
  expect(screen.getByTestId('prediction-boundary')).toBeInTheDocument()
  expect(screen.getAllByTestId('prediction-candle')).toHaveLength(3)
  expect(screen.getByText('未来推演')).toBeInTheDocument()
})

test('shows handles only on the selected unlocked drawing', () => {
  render(<DrawingLayer drawings={[line]} transform={transform} selectedId="line-1" onSelect={() => {}} onMovePoint={() => {}} />)
  expect(screen.getAllByTestId('drawing-handle')).toHaveLength(2)
})
```

- [ ] **Step 2: Verify tests fail**

Run: `cd frontend && npm test -- src/features/chart/prediction-layer.test.tsx src/features/chart/drawing-layer.test.tsx`  
Expected: FAIL because components do not exist.

- [ ] **Step 3: Implement SVG layers with stable test hooks**

Prediction region uses a light-blue rect and dashed boundary. Predicted candles use `opacity=0.55` and `strokeDasharray="4 3"`. Drawing hit areas use transparent strokes at least 12 SVG units wide; visible lines retain configured width. Horizontal lines render a right-axis price label. Do not allow prediction elements to emit drawing edit events.

- [ ] **Step 4: Move the SVG out of `chart-workspace.tsx`**

`ChartWorkspace` supplies data and callbacks; `ChartCanvas` owns rendering order:

```tsx
<HistoricalLayer />
<IndicatorLayer />
<PredictionLayer />
<DrawingLayer />
<CrosshairLayer />
```

- [ ] **Step 5: Run layer and workspace regression tests**

Run: `cd frontend && npm test -- src/features/chart/prediction-layer.test.tsx src/features/chart/drawing-layer.test.tsx src/features/chart/chart-workspace.test.tsx`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/chart/prediction-layer* frontend/src/features/chart/drawing-layer* frontend/src/features/chart/chart-canvas.tsx frontend/src/features/chart/chart-workspace.tsx
git commit -m "feat(chart): render prediction and editable drawing layers"
```

---

### Task 6: Add prediction details and object inspector UI

**Files:**
- Create: `frontend/src/features/chart/prediction-details.tsx`
- Create: `frontend/src/features/chart/prediction-details.test.tsx`
- Create: `frontend/src/features/chart/object-inspector.tsx`
- Create: `frontend/src/features/chart/object-inspector.test.tsx`
- Modify: `frontend/src/features/chart/chart-layer-panel.tsx`
- Modify: `frontend/src/features/chart/chart-toolbar.tsx`
- Modify: `frontend/src/features/chart/chart-workspace.tsx`

**Interfaces:**
- Produces: `PredictionDetails({ prediction, selectedDay, onSelectDay, mode })`, where mode is `'desktop-table' | 'mobile-sheet'`.
- Produces: `ObjectInspector({ drawing, onChange, onDelete })`.

- [ ] **Step 1: Write failing linked-selection tests**

```tsx
test('selects the second predicted day from the detail view', async () => {
  const onSelectDay = vi.fn()
  render(<PredictionDetails prediction={prediction} selectedDay={null} onSelectDay={onSelectDay} mode="desktop-table" />)
  await userEvent.click(screen.getByRole('button', { name: /第2日/ }))
  expect(onSelectDay).toHaveBeenCalledWith(prediction.days[1].day)
})
```

Add tests for every required value row, collapsed desktop state, mobile tab selection, warning copy, style editing, lock prevention, visibility and delete confirmation.

- [ ] **Step 2: Verify tests fail**

Run: `cd frontend && npm test -- src/features/chart/prediction-details.test.tsx src/features/chart/object-inspector.test.tsx`  
Expected: FAIL.

- [ ] **Step 3: Implement desktop and mobile presentations from one value model**

Use one `predictionRows(day)` function returning:

```ts
[
  ['预测开盘', day.open],
  ['预测最高', day.high],
  ['预测最低', day.low],
  ['预测收盘', day.close],
  ['预测区间', `${day.rangeLow}–${day.rangeHigh}`],
  ['MA5', day.ma5],
  ['MA10', day.ma10],
  ['MA20', day.ma20],
  ['BOLL上轨', day.bollUpper],
  ['BOLL中轨', day.bollMiddle],
  ['BOLL下轨', day.bollLower],
  ['置信度', `${Math.round(day.confidence * 100)}%`],
]
```

Desktop uses a semantic table and can collapse. Mobile uses three date tabs and a two-column definition list inside a bottom sheet. Both must share selected-day state with `PredictionLayer`.

- [ ] **Step 4: Implement toolbar and inspector states**

Add explicit `buy`, `sell`, `target`, `stop-loss` tools. Inspector inputs must use accessible labels and commit numeric values only on valid finite input.

- [ ] **Step 5: Run component tests**

Run: `cd frontend && npm test -- src/features/chart/prediction-details.test.tsx src/features/chart/object-inspector.test.tsx src/features/chart/chart-workspace.test.tsx`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/chart/prediction-details* frontend/src/features/chart/object-inspector* frontend/src/features/chart/chart-layer-panel.tsx frontend/src/features/chart/chart-toolbar.tsx frontend/src/features/chart/chart-workspace.tsx
git commit -m "feat(chart): add prediction details and drawing inspector"
```

---

### Task 7: Upgrade persistence, offline sync and conflict recovery

**Files:**
- Create: `frontend/src/features/chart/use-chart-workspace.ts`
- Create: `frontend/src/features/chart/use-chart-workspace.test.tsx`
- Modify: `frontend/src/features/chart/chart-workspace-state.ts`
- Modify: `frontend/src/features/chart/chart-workspace-state.test.ts`
- Modify: `frontend/src/features/chart/chart-workspace-sync.ts`
- Modify: `frontend/src/features/chart/chart-workspace-sync.test.ts`
- Modify: `frontend/src/features/chart/chart-workspace.tsx`

**Interfaces:**
- Produces: `useChartWorkspace({ symbol, period })` returning drawings, selectedId, syncStatus, commands and `flush()`.
- Synchronizes `ChartWorkspaceV2` under entity id `${symbol}:${period}`.

- [ ] **Step 1: Write failing persistence tests**

```ts
test('keeps day and week drawings in separate keys', () => {
  saveChartWorkspace(dayWorkspace)
  saveChartWorkspace(weekWorkspace)
  expect(loadChartWorkspace('600519', 'day')?.drawings).toEqual(dayWorkspace.drawings)
  expect(loadChartWorkspace('600519', 'week')?.drawings).toEqual(weekWorkspace.drawings)
})

test('keeps a local recovery copy when delete conflicts with remote edit', () => {
  const merged = mergeChartWorkspace(localDelete, remoteEdit)
  expect(merged.recovery).toContainEqual(expect.objectContaining({ id: 'line-1', reason: 'DELETE_EDIT_CONFLICT' }))
})
```

Add tests for 350ms save debounce, offline queue order, successful retry, newer-version winner and sync status transitions.

- [ ] **Step 2: Verify tests fail**

Run: `cd frontend && npm test -- src/features/chart/chart-workspace-state.test.ts src/features/chart/chart-workspace-sync.test.ts src/features/chart/use-chart-workspace.test.tsx`  
Expected: FAIL.

- [ ] **Step 3: Implement version-2 serialization and recovery records**

Persist only validated `ChartWorkspaceV2`. Store offline mutations under `stockcal:chart-sync-queue:v2`. Merge drawings by id and version; equal versions use `updatedAt`. A delete/edit conflict adds the edited object to `recovery` and keeps the delete as active state.

- [ ] **Step 4: Move save and sync effects into the hook**

The hook must expose `'本机保存' | '同步中' | '已同步' | '待同步' | '离线'`. Pointer movement must not trigger persistence. Only completed drawing commands, indicator settings, layers and view changes schedule a save.

- [ ] **Step 5: Run sync and workspace tests**

Run: `cd frontend && npm test -- src/features/chart/chart-workspace-state.test.ts src/features/chart/chart-workspace-sync.test.ts src/features/chart/use-chart-workspace.test.tsx src/features/chart/chart-workspace.test.tsx`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/chart/use-chart-workspace* frontend/src/features/chart/chart-workspace-state* frontend/src/features/chart/chart-workspace-sync* frontend/src/features/chart/chart-workspace.tsx
git commit -m "feat(chart): persist and recover versioned drawing workspaces"
```

---

### Task 8: Match the approved responsive visual design

**Files:**
- Modify: `frontend/src/features/chart/chart-workspace.tsx`
- Modify: `frontend/app/workspace-polish.css`
- Modify: `frontend/src/features/chart/chart-workspace.test.tsx`

**Interfaces:**
- Consumes all components from Tasks 1–7.
- Produces final desktop and mobile page layout with no new data contracts.

- [ ] **Step 1: Add failing structural and accessibility assertions**

```tsx
test('exposes desktop editor rails and mobile bottom actions', () => {
  const { container } = renderChart()
  expect(container.querySelector('.sc-chart-left-tools')).toBeInTheDocument()
  expect(container.querySelector('.sc-chart-inspector')).toBeInTheDocument()
  expect(container.querySelector('.sc-prediction-details')).toBeInTheDocument()
  expect(screen.getByRole('switch', { name: '未来推演' })).toBeChecked()
  expect(screen.getByText('推演数据，不是实际行情')).toBeInTheDocument()
})
```

- [ ] **Step 2: Verify the test fails**

Run: `cd frontend && npm test -- src/features/chart/chart-workspace.test.tsx`  
Expected: FAIL because the approved regions are not composed yet.

- [ ] **Step 3: Implement desktop layout tokens**

At widths `>= 1024px`, use grid columns `56px minmax(0, 1fr) 280px`. Keep the prediction table below the canvas in the center column. Use true white surfaces, cool-gray borders, navy text and blue selection. Do not add gradients or decorative cards.

- [ ] **Step 4: Implement mobile layout**

At widths `< 768px`, hide desktop rails, make chart controls horizontally scrollable, reserve at least `420px` chart height, fix the five-action toolbar above the safe-area inset, and render details/attributes in the bottom sheet. Apply `min-height: 44px` to interactive controls.

- [ ] **Step 5: Run frontend tests and build**

Run: `cd frontend && npm test`  
Expected: all Vitest tests PASS.  
Run: `cd frontend && npm run lint && npm run build`  
Expected: commands exit 0 with no TypeScript or ESLint errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/chart/chart-workspace.tsx frontend/src/features/chart/chart-workspace.test.tsx frontend/app/workspace-polish.css
git commit -m "feat(chart): match approved responsive editor design"
```

---

### Task 9: Browser workflow and visual fidelity verification

**Files:**
- Modify: `frontend/e2e/workspace-redesign.spec.ts`
- Create temporarily during QA, then remove: `frontend/test-results/chart-desktop.png`, `frontend/test-results/chart-mobile.png`

**Interfaces:**
- Consumes the complete page and configured test server.
- Produces repeatable Playwright acceptance coverage.

- [ ] **Step 1: Add the end-to-end workflow**

```ts
test('edits a drawing and inspects future prediction values', async ({ page }) => {
  await page.goto('/chart')
  await page.getByRole('button', { name: '水平线' }).click()
  await page.getByRole('img', { name: 'K线主图' }).click({ position: { x: 500, y: 180 } })
  await expect(page.getByLabel('价格')).toBeVisible()
  await page.getByRole('button', { name: /第2日/ }).click()
  await expect(page.getByText('BOLL上轨')).toBeVisible()
  await expect(page.getByTestId('prediction-candle').nth(1)).toHaveAttribute('data-active', 'true')
  await page.getByRole('button', { name: '撤销' }).click()
  await expect(page.getByTestId('drawing-horizontal-line')).toHaveCount(0)
})
```

Add a mobile project assertion that opens the prediction sheet, switches all three dates, and verifies the fixed toolbar does not cover the selected value.

- [ ] **Step 2: Run E2E and capture desktop/mobile screenshots**

Run: `cd frontend && npm run test:e2e -- e2e/workspace-redesign.spec.ts`  
Expected: PASS at desktop and mobile viewports.

- [ ] **Step 3: Compare screenshots to both approved concepts**

Inspect both the approved concept images and latest browser screenshots with `view_image`. Record and fix mismatches for:

1. left toolbar/phone bottom toolbar,
2. chart-to-panel proportions,
3. future-region width and boundary,
4. prediction detail density,
5. typography and control sizing,
6. inspector alignment,
7. selected and hover states.

Repeat implementation and screenshots until no agency-review mismatch remains.

- [ ] **Step 4: Verify the complete repository**

Run: `cd frontend && npm test && npm run lint && npm run build && npm run test:e2e`  
Run: `cd backend && ./gradlew test`  
Expected: every command exits 0.

- [ ] **Step 5: Remove temporary QA screenshots and commit acceptance coverage**

```bash
git rm -r --ignore-unmatch frontend/test-results
git add frontend/e2e/workspace-redesign.spec.ts
git commit -m "test(chart): verify drawing and future prediction workflows"
```

---

## Final Acceptance Checklist

- [ ] No persisted drawing contains `x` or `y` screen coordinates.
- [ ] Zoom, pan, resize, refresh and period switching do not move drawings relative to time/price.
- [ ] Future mode is enabled by default and renders exactly three trading days.
- [ ] Predicted candles, MA and BOLL use the same appended OHLC sequence.
- [ ] Prediction failures leave historical charts and drawings usable.
- [ ] Desktop table and mobile sheet expose all required values and link to chart hover/selection.
- [ ] Buy, sell, target and stop-loss markers display their exact prices.
- [ ] Locked drawings cannot move; hidden drawings do not render; deleted drawings can be recovered after a sync conflict.
- [ ] Offline changes remain local and sync in order after reconnection.
- [ ] Desktop and mobile screenshots faithfully match the approved concepts.
- [ ] Frontend tests, lint, build, E2E and backend tests all pass.
