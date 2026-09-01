# StockCal Readable Layout and Market Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every frontend workspace simpler to navigate and show an honest, friendly loading experience while real market data is being fetched.

**Architecture:** Keep `StockWorkspaceProvider` as the single source of market state. Add a presentational market-state component that maps the existing status values to loading, feedback, and error UI; pass the provider status into overview, analysis, and chart pages. Reduce primary navigation to six destinations and use existing inner tabs for secondary workflows.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-01-readable-loading-design.md`

## Global Constraints

- Do not introduce a new UI dependency.
- Do not add demo market identities or synthetic quote data.
- Preserve the existing `MarketSnapshot`, `WorkspaceStatus`, and `refresh` interfaces.
- Loading must never render terminal empty/error copy before the request settles.
- Interactive controls must retain at least 44px touch targets.

---

### Task 1: Add the shared market-state presentation contract

**Files:**
- Create: `frontend/src/features/workspace/market-state.tsx`
- Create: `frontend/src/features/workspace/market-state.test.tsx`
- Modify: `frontend/src/features/workspace/stock-workspace-types.ts` only if a type import needs correction

**Interfaces:**
- Consumes: `WorkspaceStatus`, `errorMessage`, `onRetry`, and a `variant` of `overview | analysis | chart`.
- Produces: `MarketLoadingState` and `MarketFeedback` React components.

- [ ] **Step 1: Write failing tests for loading and refresh feedback**

```tsx
test('renders a loading skeleton instead of an empty state', () => {
  render(<MarketLoadingState variant="overview" />)
  expect(screen.getByRole('status')).toHaveTextContent('正在加载真实行情')
  expect(screen.getByTestId('market-loading-skeleton')).toBeInTheDocument()
  expect(screen.queryByText('真实行情暂不可用')).not.toBeInTheDocument()
})

test('renders retryable error feedback', async () => {
  const onRetry = vi.fn()
  render(<MarketFeedback status="error" errorMessage="行情请求失败" onRetry={onRetry} />)
  expect(screen.getByRole('alert')).toHaveTextContent('行情请求失败')
  await userEvent.click(screen.getByRole('button', { name: '重新加载行情' }))
  expect(onRetry).toHaveBeenCalledOnce()
})

test('renders a non-blocking refresh message for an existing snapshot', () => {
  render(<MarketFeedback status="refreshing" hasSnapshot />)
  expect(screen.getByRole('status')).toHaveTextContent('正在刷新行情')
})
```

- [ ] **Step 2: Run the focused test and verify it fails because the components do not exist**

Run: `npm test -- src/features/workspace/market-state.test.tsx`

Expected: FAIL with missing component/module errors.

- [ ] **Step 3: Implement the minimal shared components**

Implement a fixed-height skeleton using CSS classes and `aria-hidden` blocks. Map `loading` to a status region, `error` to an alert with retry, `refreshing` to a status pill, `stale` and `offline` to warning feedback, and return `null` for `ready`, `idle`, and `searching` when no feedback is needed.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- src/features/workspace/market-state.test.tsx`

Expected: PASS with all focused tests passing.

- [ ] **Step 5: Commit the shared presentation layer**

```bash
git add src/features/workspace/market-state.tsx src/features/workspace/market-state.test.tsx docs/superpowers/specs/2026-09-01-readable-loading-design.md docs/superpowers/plans/2026-09-01-readable-loading-plan.md
git commit -m "feat: add shared market loading states"
```

### Task 2: Wire loading and stale states into market workspaces

**Files:**
- Modify: `frontend/src/features/overview/live-overview-page.tsx`
- Modify: `frontend/src/features/analysis/analysis-page.tsx`
- Modify: `frontend/src/features/chart/chart-page.tsx`
- Modify: `frontend/src/features/chart/chart-workspace.tsx`
- Modify: `frontend/src/features/overview/live-overview-page.test.tsx`
- Modify: `frontend/src/features/overview/overview-page.interaction.test.tsx`
- Modify: `frontend/src/features/workspace/stock-workspace-provider.test.tsx`

**Interfaces:**
- Consumes: `useStockWorkspace()` values `current`, `lastSuccessful`, `status`, `errorMessage`, and `refresh`.
- Produces: consistent initial loading, refresh, stale, offline, and retry UI across overview, analysis, and chart.

- [ ] **Step 1: Add failing page tests for the initial loading state**

```tsx
test('shows loading feedback while the first market request is pending', () => {
  render(<LiveOverviewPage snapshot={null} status="loading" />)
  expect(screen.getByRole('status')).toHaveTextContent('正在加载真实行情')
  expect(screen.queryByText('真实行情暂不可用')).not.toBeInTheDocument()
})
```

Add equivalent assertions for `AnalysisPage` and `ChartWorkspace` using a pending workspace or explicit status prop where the current component boundary allows it.

- [ ] **Step 2: Run the focused page tests and verify they fail on the current empty-state behavior**

Run: `npm test -- src/features/overview/live-overview-page.test.tsx src/features/overview/overview-page.interaction.test.tsx src/features/workspace/stock-workspace-provider.test.tsx`

Expected: FAIL because loading currently renders the empty/error panel and analysis/chart do not render a loading branch.

- [ ] **Step 3: Implement status-aware rendering**

Use `MarketLoadingState` before terminal empty/error rendering. Keep `current ?? lastSuccessful` for refresh. Add `MarketFeedback` to successful overview, analysis header/content, and chart header. Pass status and retry to chart workspace without changing chart calculation or annotation state.

- [ ] **Step 4: Run the focused tests and verify they pass**

Run: `npm test -- src/features/overview/live-overview-page.test.tsx src/features/overview/overview-page.interaction.test.tsx src/features/workspace/stock-workspace-provider.test.tsx src/features/chart/chart-workspace.test.tsx src/features/analysis/analysis-page.interaction.test.tsx`

Expected: PASS with no loading-state regressions.

- [ ] **Step 5: Commit workspace integration**

```bash
git add src/features/overview src/features/analysis/analysis-page.tsx src/features/chart/chart-page.tsx src/features/chart/chart-workspace.tsx src/features/workspace/stock-workspace-provider.test.tsx
git commit -m "fix: show honest market loading and stale states"
```

### Task 3: Simplify primary navigation and page rhythm

**Files:**
- Modify: `frontend/src/features/navigation/navigation-config.ts`
- Modify: `frontend/src/features/navigation/app-shell.tsx`
- Modify: `frontend/src/features/navigation/app-shell.test.tsx`
- Modify: `frontend/app/workspace-polish.css`
- Modify: `frontend/app/globals.css` only where shared shell selectors are defined

**Interfaces:**
- Consumes: existing route URLs and inner page tabs.
- Produces: six primary destinations: `/overview`, `/analysis/key-levels`, `/chart`, `/trading/positions`, `/review/daily`, `/rules`.

- [ ] **Step 1: Add failing navigation assertions for six primary entries**

```tsx
test('keeps the primary navigation focused on six workspaces', () => {
  render(<AppShell section="overview" onSectionChange={vi.fn()} />)
  expect(screen.getByTestId('desktop-primary-nav').querySelectorAll('a')).toHaveLength(6)
  expect(screen.getByTestId('mobile-primary-nav').querySelectorAll('a')).toHaveLength(6)
  expect(screen.getByRole('link', { name: '个股分析' })).toHaveAttribute('href', '/analysis/key-levels')
})
```

- [ ] **Step 2: Run the navigation tests and verify they fail because nine entries are still rendered**

Run: `npm test -- src/features/navigation/app-shell.test.tsx src/features/navigation/navigation-config.test.ts`

Expected: FAIL on the old count and labels.

- [ ] **Step 3: Replace the flat secondary navigation with six primary entries**

Keep the existing `activeHref` matching behavior. Use labels that describe workspaces rather than individual subtasks; leave analysis, trading, and review subtasks in their page-local tab bars.

- [ ] **Step 4: Simplify shared spacing and typography rules**

Consolidate repeated final overrides into one readable baseline: page width `min(1392px, calc(100% - 32px))`, desktop content gaps around 16–20px, mobile content padding 16px, headings 24–28px, body text at least 14px, muted helper text at least 12px, primary buttons at least 44px. Reduce redundant shadows and avoid adding new card layers around existing panels.

- [ ] **Step 5: Run focused navigation and shell tests**

Run: `npm test -- src/features/navigation/app-shell.test.tsx src/features/navigation/navigation-config.test.ts`

Expected: PASS with six links and preserved concrete active highlighting.

- [ ] **Step 6: Commit the navigation and visual rhythm change**

```bash
git add src/features/navigation app/workspace-polish.css app/globals.css
git commit -m "refactor: simplify stockcal workspace navigation"
```

### Task 4: Full verification and regression review

**Files:**
- Modify: any files required by lint/build findings only

**Interfaces:**
- Consumes: all changes from Tasks 1–3.
- Produces: a verified frontend build with the new state and navigation behavior.

- [ ] **Step 1: Run the complete unit test suite**

Run: `npm test`

Expected: PASS with zero failed tests.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: exit code 0 with zero ESLint errors.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: exit code 0 and a successful Next.js production build.

- [ ] **Step 4: Review the final diff against the spec**

Run: `git diff HEAD~3 --stat && git diff HEAD~3 --check`

Confirm: loading never falls through to terminal empty copy, old snapshots remain visible during refresh, no demo identity is introduced, and six primary navigation entries are present on desktop and mobile.

- [ ] **Step 5: Commit any verification-only fixes**

```bash
git add <only-files-fixed-after-verification>
git commit -m "chore: polish frontend verification fixes"
```
