# StockCal Mixed Workspace Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild StockCal’s shell and key workspaces into the approved mixed visual system while preserving real-market, rule, chart, and record behavior.

**Architecture:** Add an explicit workspace-tone contract at the application shell, then implement small feature-level presentation components instead of duplicating styling across pages. Home/analysis use the restrained cyber tone, the chart uses a chart-first light canvas, and rules/review use a white information-flow tone; navigation and semantic state remain shared.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, CSS custom properties, Vitest, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-04-stockcal-trading-workspace-design.md`

## Global Constraints

- Preserve existing market client, rule evaluation, local record, and chart annotation APIs.
- Keep actual price data visually distinct from forecast paths; forecasts use dashed paths and scenario labels.
- Desktop body text is at least 14px; mobile body and controls are at least 14px; touch targets are at least 44px.
- Desktop navigation has exactly 首页、分析、规则、复盘、设置; mobile navigation has the same five destinations.
- K-line retains day/week/month, MA/BOLL, layers, zoom, crosshair, drawing and prediction-path behavior.
- Rules with incomplete conditions cannot be published; persisted enabled state remains the analysis source of truth.
- No horizontal overflow below 640px.

---

## File Structure

- `frontend/src/features/navigation/navigation-config.ts`: five-destination navigation contract and chart/trading route mapping.
- `frontend/src/features/navigation/app-shell.tsx`: workspace-tone class and shared desktop/mobile navigation markup.
- `frontend/app/globals.css`: semantic tokens, accessibility states, shared mobile constraints.
- `frontend/app/workspace-polish.css`: workspace-tone and component presentation rules.
- `frontend/src/features/overview/live-overview-page.tsx`: cyber-tone market/home composition.
- `frontend/src/features/analysis/analysis-page.tsx`: cyber-tone decision-first analysis composition.
- `frontend/src/features/chart/chart-page.tsx` and `frontend/src/features/chart/chart-workspace.tsx`: chart-first shell, dockable panels, compact mobile tool sheet.
- `frontend/src/features/rules/rules-page.tsx`: information-flow list, filter/search/detail structure.
- `frontend/src/features/review/review-page.tsx`: information-flow review form, linked records and mobile save action.
- Existing feature test files: behavior regression plus new tone/navigation/responsive assertions.
- `frontend/e2e/workspace-redesign.spec.ts`: desktop and mobile browser acceptance coverage.

### Task 1: Establish the shared five-destination shell and tokens

**Files:**
- Modify: `frontend/src/features/navigation/navigation-config.ts`
- Modify: `frontend/src/features/navigation/app-shell.tsx`
- Modify: `frontend/app/globals.css`
- Modify: `frontend/app/workspace-polish.css`
- Test: `frontend/src/features/navigation/navigation-config.test.ts`
- Test: `frontend/src/features/navigation/app-shell.test.tsx`

**Interfaces:**
- Produces `WorkspaceTone = 'cyber' | 'chart' | 'feed' | 'neutral'` and `ProductShell` tone prop consumed by all routes.
- Produces exactly five `NavigationItem`s for desktop and mobile.

- [ ] **Step 1: Write failing navigation and tone tests**

```tsx
expect(desktopNavigation.map((item) => item.label)).toEqual(['首页', '分析', '规则', '复盘', '设置'])
render(<AppShell activeHref="/rules" section="rules" tone="feed"><div>内容</div></AppShell>)
expect(screen.getByTestId('app-shell')).toHaveClass('sc-tone-feed')
expect(screen.getAllByRole('link', { name: /首页|分析|规则|复盘|设置/ })).toHaveLength(10)
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `npm run test -- src/features/navigation/navigation-config.test.ts src/features/navigation/app-shell.test.tsx`

Expected: FAIL because the old six-item navigation and no `tone` prop remain.

- [ ] **Step 3: Implement the minimal shared contract**

```ts
export type WorkspaceTone = 'cyber' | 'chart' | 'feed' | 'neutral'
export const desktopNavigation: NavigationItem[] = [
  { section: 'overview', label: '首页', href: '/overview', icon: '◈' },
  { section: 'analysis', label: '分析', href: '/analysis/key-levels', icon: '↗' },
  { section: 'rules', label: '规则', href: '/rules', icon: '◇' },
  { section: 'review', label: '复盘', href: '/review/daily', icon: '↺' },
  { section: 'settings', label: '设置', href: '/settings', icon: '⚙' },
]
```

Make `AppShell` render `data-testid="app-shell"` and `sc-tone-${tone}`. Map chart and trading routes to `analysis` and `review` respectively without changing their URLs.

- [ ] **Step 4: Add semantic CSS tokens and mobile shell constraints**

```css
.sc-tone-cyber { --sc-page: #07111f; --sc-surface: #0c1a2c; --sc-text: #eef6ff; }
.sc-tone-chart { --sc-page: #f4f6f8; --sc-surface: #ffffff; --sc-text: #17212b; }
.sc-tone-feed { --sc-page: #ffffff; --sc-surface: #ffffff; --sc-text: #0f1419; }
@media (max-width: 639px) { .sc-product-shell { overflow-x: clip; } .sc-mobile-nav a { min-height: 44px; font-size: 14px; } }
```

- [ ] **Step 5: Run focused tests and lint**

Run: `npm run test -- src/features/navigation/navigation-config.test.ts src/features/navigation/app-shell.test.tsx && npm run lint`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/navigation frontend/app/globals.css frontend/app/workspace-polish.css
git commit -m "feat: add mixed workspace shell"
```

### Task 2: Migrate overview and analysis to the cyber decision flow

**Files:**
- Modify: `frontend/src/features/overview/live-overview-page.tsx`
- Modify: `frontend/src/features/analysis/analysis-page.tsx`
- Modify: route pages that construct `ProductShell` for overview and analysis
- Test: `frontend/src/features/overview/live-overview-page.test.tsx`
- Test: `frontend/src/features/analysis/analysis-page.interaction.test.tsx`

**Interfaces:**
- Consumes `tone="cyber"` from `ProductShell`.
- Produces labelled `今日关注`, `关键位`, `预测路径`, and `规则结论` regions.

- [ ] **Step 1: Write failing semantic-region tests**

```tsx
render(<LiveOverviewPage snapshot={snapshot} status="ready" />)
expect(screen.getByRole('region', { name: '今日关注' })).toBeVisible()
expect(screen.getByRole('region', { name: '最近分析' })).toBeVisible()
render(<AnalysisPage tab="key-levels" />)
expect(screen.getByRole('region', { name: '规则结论' })).toBeVisible()
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `npm run test -- src/features/overview/live-overview-page.test.tsx src/features/analysis/analysis-page.interaction.test.tsx`

Expected: FAIL because the labelled decision-flow regions do not exist.

- [ ] **Step 3: Implement the decision-first layout without changing data sources**

```tsx
<section aria-label="今日关注" className="sc-cyber-watchlist">...</section>
<section aria-label="关键位" className="sc-cyber-levels">...</section>
<section aria-label="规则结论" className="sc-cyber-decision">...</section>
```

Reuse existing analysis and snapshot values. Render WAIT, missing facts and conflicts as visible content rather than creating an optimistic fallback.

- [ ] **Step 4: Add responsive styling for a one-column mobile flow**

```css
@media (max-width: 639px) {
  .sc-cyber-overview { grid-template-columns: minmax(0, 1fr); }
  .sc-cyber-levels, .sc-cyber-decision { min-width: 0; }
}
```

- [ ] **Step 5: Run focused tests and lint**

Run: `npm run test -- src/features/overview/live-overview-page.test.tsx src/features/analysis/analysis-page.interaction.test.tsx && npm run lint`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/overview frontend/src/features/analysis frontend/app
git commit -m "feat: redesign overview and analysis flow"
```

### Task 3: Build the chart-first K-line workspace

**Files:**
- Modify: `frontend/src/features/chart/chart-page.tsx`
- Modify: `frontend/src/features/chart/chart-workspace.tsx`
- Modify: `frontend/src/features/chart/chart-toolbar.tsx`
- Modify: `frontend/src/features/chart/chart-layer-panel.tsx`
- Test: `frontend/src/features/chart/chart-workspace.test.tsx`
- Test: `frontend/src/features/chart/chart-workspace-state.test.ts`

**Interfaces:**
- Consumes current chart workspace state and annotation store.
- Produces labelled `绘图工具`, `分析面板`, `预测路径`, and mobile `工具` sheet.

- [ ] **Step 1: Write failing interaction tests**

```tsx
render(<ChartWorkspace />)
await user.click(screen.getByRole('button', { name: '工具' }))
expect(screen.getByRole('dialog', { name: 'K线工具' })).toBeVisible()
expect(screen.getByText('预测路径')).toBeVisible()
expect(screen.getByLabelText('绘图工具')).toBeVisible()
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `npm run test -- src/features/chart/chart-workspace.test.tsx src/features/chart/chart-workspace-state.test.ts`

Expected: FAIL because the mobile tool dialog and labelled workspace regions do not exist.

- [ ] **Step 3: Implement the chart dock layout**

```tsx
<aside aria-label="自选股" className="sc-chart-watchlist">...</aside>
<nav aria-label="绘图工具" className="sc-chart-drawing-rail">...</nav>
<main className="sc-chart-canvas">...</main>
<aside aria-label="分析面板" className="sc-chart-analysis">...</aside>
```

Retain `aggregateCandles`, indicator toggles, pointer crosshair, zoom and annotation state. Render forecast paths with `strokeDasharray` and a scenario label.

- [ ] **Step 4: Implement the mobile tools dialog**

```tsx
{toolsOpen ? <section aria-label="K线工具" aria-modal="true" className="sc-chart-tool-sheet" role="dialog">...</section> : null}
```

The dialog contains existing drawing, layer, indicator and zoom controls. Close it on overlay click, Escape and the explicit close button.

- [ ] **Step 5: Run focused tests and lint**

Run: `npm run test -- src/features/chart/chart-workspace.test.tsx src/features/chart/chart-workspace-state.test.ts && npm run lint`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/chart frontend/app
git commit -m "feat: redesign chart-first workspace"
```

### Task 4: Convert the rules workspace to an information-flow list

**Files:**
- Modify: `frontend/src/features/rules/rules-page.tsx`
- Modify: `frontend/src/features/rules/knowledge-review-panel.tsx`
- Test: `frontend/src/features/rules/rules-page.interaction.test.tsx`
- Test: `frontend/src/features/rules/knowledge-review-panel.test.tsx`

**Interfaces:**
- Consumes `RulesClient` and persisted `toggle` result.
- Produces filter tabs, searchable rule rows and a `规则详情` dialog/bottom sheet.

- [ ] **Step 1: Write failing rules-list tests**

```tsx
render(<RulesPage initialRules={rules} client={client} />)
expect(screen.getByRole('tab', { name: '已上线' })).toBeVisible()
await user.type(screen.getByRole('searchbox', { name: '搜索规则' }), '均线')
expect(screen.getAllByRole('article', { name: /规则/ })).toHaveLength(1)
await user.click(screen.getByRole('button', { name: /查看详情/ }))
expect(screen.getByRole('dialog', { name: /规则详情/ })).toBeVisible()
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `npm run test -- src/features/rules/rules-page.interaction.test.tsx src/features/rules/knowledge-review-panel.test.tsx`

Expected: FAIL because the information-flow filter/search semantics are absent.

- [ ] **Step 3: Implement list and inspector semantics**

```tsx
<input aria-label="搜索规则" role="searchbox" value={query} onChange={(event) => setQuery(event.target.value)} />
<div role="tablist" aria-label="规则状态">...</div>
<article aria-label={`规则 ${rule.title}`} className="sc-rule-row">...</article>
```

Keep current condition-validation, publication guard and persisted enabled toggle. The detail surface explicitly displays `参与分析`, missing-condition and conflict messages.

- [ ] **Step 4: Add mobile bottom-sheet presentation and list-safe CSS**

```css
@media (max-width: 639px) {
  .sc-rule-table-head { display: none; }
  .sc-rule-row { grid-template-columns: minmax(0, 1fr) auto; min-height: 64px; }
  .rule-detail-panel { inset: auto 0 0; border-radius: 20px 20px 0 0; }
}
```

- [ ] **Step 5: Run focused tests and lint**

Run: `npm run test -- src/features/rules/rules-page.interaction.test.tsx src/features/rules/knowledge-review-panel.test.tsx && npm run lint`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/rules frontend/app
git commit -m "feat: redesign rule information flow"
```

### Task 5: Convert review and settings to focused mobile-safe workspaces

**Files:**
- Modify: `frontend/src/features/review/review-page.tsx`
- Modify: settings route/page and its shell call site
- Test: `frontend/src/features/review/review-page.test.tsx`
- Test: settings page test if present, otherwise create `frontend/src/features/settings/settings-page.test.tsx`

**Interfaces:**
- Consumes record-store functions already used by `ReviewPage`.
- Produces labelled `市场判断`, `执行情况`, `改进点` fields and a mobile fixed `保存当日总结` control.

- [ ] **Step 1: Write failing structured-review tests**

```tsx
render(<ReviewPage initialTab="daily" />)
expect(screen.getByLabelText('市场判断')).toBeVisible()
expect(screen.getByLabelText('执行情况')).toBeVisible()
expect(screen.getByLabelText('改进点')).toBeVisible()
expect(screen.getByRole('button', { name: '保存当日总结' })).toBeVisible()
```

- [ ] **Step 2: Run focused test and verify it fails**

Run: `npm run test -- src/features/review/review-page.test.tsx`

Expected: FAIL because daily review has one unstructured field.

- [ ] **Step 3: Implement structured daily review without breaking saved records**

```ts
const sections = ['市场判断', '执行情况', '改进点'] as const
const content = sections.map((section) => `## ${section}\n${draft[section]}`).join('\n\n')
```

When loading an existing record, show its full existing content in `市场判断` rather than discarding it. Keep the current record ID and sync behavior.

- [ ] **Step 4: Implement white feed styling and mobile save bar**

```css
.sc-review-workspace { background: var(--sc-page); }
@media (max-width: 639px) { .sc-review-save-bar { position: sticky; bottom: 0; padding: 12px; } }
```

- [ ] **Step 5: Run focused tests and lint**

Run: `npm run test -- src/features/review/review-page.test.tsx && npm run lint`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/review frontend/src/features/settings frontend/app
git commit -m "feat: redesign review workspace"
```

### Task 6: Run browser acceptance and full regression

**Files:**
- Create: `frontend/e2e/workspace-redesign.spec.ts`
- Modify: feature tests only if browser findings expose a real regression

**Interfaces:**
- Consumes the completed application routes and accessible labels from Tasks 1–5.
- Produces desktop and 390px-mobile screenshots for visual comparison with the accepted concept images.

- [ ] **Step 1: Write desktop and mobile browser tests**

```ts
test('chart workspace remains usable on desktop and mobile', async ({ page }) => {
  await page.goto('/chart?symbol=002475')
  await expect(page.getByLabel('绘图工具')).toBeVisible()
  await page.getByRole('button', { name: '工具' }).click()
  await expect(page.getByRole('dialog', { name: 'K线工具' })).toBeVisible()
})
```

Add checks for `/overview`, `/rules`, `/review/daily`, `规则详情`, `规则结论`, and a 390px viewport with no `document.documentElement.scrollWidth > window.innerWidth`.

- [ ] **Step 2: Run browser tests and verify initial failures are meaningful**

Run: `npm run test:e2e -- workspace-redesign.spec.ts`

Expected: PASS after Tasks 1–5; if the environment lacks Playwright browsers, record the exact browser-install blocker and continue with component tests and production build.

- [ ] **Step 3: Capture final desktop and mobile screenshots**

Use the browser at the concept dimensions where practical. Compare K-line workspace against the approved cyber, X-style and TradingView-style concepts: chart dominance, information hierarchy, typography, selected states and mobile tool-sheet behavior.

- [ ] **Step 4: Run the complete quality gate**

Run: `npm run test && npm run lint && npm run build`

Expected: all commands exit 0.

- [ ] **Step 5: Commit acceptance tests and final fixes**

```bash
git add frontend/e2e frontend/src frontend/app
git commit -m "test: cover mixed workspace redesign"
```
