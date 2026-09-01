# socksample Frontend Baseline Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use the exported `socksample` UI as Sock's visual and interaction baseline while retaining Sock's APIs and business data.

**Architecture:** Keep Sock's Next App Router and feature modules. Port sample design tokens and page composition into shared Shell and feature components, binding them to `StockWorkspaceProvider`, existing calculators, stores, and API clients. Do not copy sample static records into production state.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Vitest, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-01-socksample-frontend-baseline.md`

## Global Constraints

- `socksample` main is the visual source of truth.
- Preserve Sock `/api` routes, record sync, rule storage, default rules, and waiting/indeterminate behavior.
- Keep forecast, live trading, and review records independent.
- Chinese UI labels and sample hierarchy remain; text may be slightly larger.
- Every behavior change gets a failing test before production code.

### Task 1: Use the latest pushed Sock baseline

**Files:** local Git metadata only.

- [ ] Fetch `agent/local-first-watchlist` and create/use `migrate-socksample-ui` at `bd85c2efffdb8a7c72ac9ce576f1319e6e06af80`.
- [ ] Confirm `git status --short --branch` is clean before application edits.

Commands:

```bash
git fetch origin agent/local-first-watchlist
git switch -c migrate-socksample-ui origin/agent/local-first-watchlist
git status --short --branch
```

### Task 2: Port the sample design system and shared shell

**Files:** `frontend/app/globals.css`, `frontend/src/features/navigation/app-shell.tsx`, `frontend/src/features/navigation/product-shell.tsx`, `frontend/src/features/navigation/navigation-config.ts`, related shell tests.

**Produces:** sample-style desktop header, mobile bottom navigation, search form, demo ribbon, alert action, and exact route active states.

- [ ] Add a failing test asserting banner, `主导航`, `演示数据`, and `activeHref="/analysis/future"`.
- [ ] Run `npm test -- --run frontend/src/features/navigation/app-shell.test.tsx` and verify the expected failure.
- [ ] Port the sample tokens and responsive shell rules; keep Sock navigation destinations and `symbol` query handling.
- [ ] Re-run the focused test and commit `feat(web): adopt sample shell baseline`.

### Task 3: Recompose overview from the sample page hierarchy

**Files:** `frontend/src/features/overview/overview-page.tsx`, its unit and interaction tests, shared styles if needed.

**Produces:** portfolio summary, quote header, key-zone decision cards, future-indicator cards, rule summary, and action links using Sock provider data.

- [ ] Add a failing test for headings `组合总览`, selected stock, `关键位决策`, and the analysis link.
- [ ] Verify the test fails before implementation.
- [ ] Implement the sample composition with `StockWorkspaceProvider`; preserve empty-state behavior and existing route/API contracts.
- [ ] Run `npm test -- --run frontend/src/features/overview` and commit `feat(web): recompose overview from sample baseline`.

### Task 4: Align the K-line workspace

**Files:** `frontend/src/features/chart/chart-workspace.tsx`, `chart-toolbar.tsx`, `chart-layer-panel.tsx`, `chart-annotation-store.ts`, chart tests.

**Produces:** grouped controls for period, drawing, indicators, zoom/view, and layers; direct point/drawing interaction; undo/redo and persistent annotations.

- [ ] Add a failing test that opens `更多绘图`, selects `买入点`, clicks the chart, and expects `annotation-buy`.
- [ ] Run the chart test and verify failure because the behavior is absent.
- [ ] Map pointer coordinates to the SVG viewBox and dispatch through the existing annotation store; preserve mobile chart-only horizontal scrolling.
- [ ] Run chart tests and commit `feat(web): align chart workspace with sample interactions`.

### Task 5: Align analysis, rules, trading, and review routes

**Files:** existing TSX files and interaction tests under `frontend/src/features/analysis`, `rules`, `trading`, and `review`.

**Produces:** sample-style tabs, cards, dialogs, toggles, forms, and feedback states without changing API or sync contracts.

- [ ] Add one failing behavior test for analysis tab active state, published-rule disable/detail, trading entry feedback, and review tab switching.
- [ ] Run the focused route-family tests and confirm the expected failures.
- [ ] Implement minimum sample-aligned states using existing providers/stores; route mutations through record sync.
- [ ] Run the route-family tests and commit `feat(web): align feature route interactions with sample`.

### Task 6: Add desktop/mobile Playwright coverage

**Files:** create `frontend/playwright.config.ts`, create `frontend/e2e/socksample-baseline.spec.ts`, modify `frontend/package.json` only if scripts/config require it.

**Produces:** repeatable 1440×900 and 390×844 smoke tests for page loading, navigation, no horizontal overflow, chart controls, and rules dialog.

- [ ] Write the E2E tests before implementation, including:

```ts
for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`overview fits ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/overview')
    await expect(page.getByRole('heading', { name: '组合总览' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
```

- [ ] Run `npm run test:e2e`; if Chromium is unavailable, capture the exact environment error.
- [ ] Add route and interaction smoke flows, then rerun the suite with Chromium.
- [ ] Commit `test(web): add desktop and mobile smoke coverage`.

### Task 7: Verify and publish

**Files:** none unless verification finds a regression.

- [ ] Run `npm run lint && npm test && npm run build`.
- [ ] Run `npm run test:e2e` for both viewports.
- [ ] Run `git diff --check` and confirm only intended files changed.
- [ ] Push the exact commit chain to `agent/local-first-watchlist` through the GitHub connector without force.
- [ ] Verify the remote branch SHA with `git ls-remote origin refs/heads/agent/local-first-watchlist`.
