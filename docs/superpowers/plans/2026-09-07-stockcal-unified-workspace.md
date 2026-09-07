# StockCal Unified Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mixed cyber/chart/feed presentation with one responsive light professional trading-terminal system across every StockCal page.

**Architecture:** Keep the existing Next.js feature and data boundaries. Establish shared visual contracts in the application shell and global CSS, then migrate each feature page without changing its market, rule, record, or chart state semantics. Validate each slice with Vitest interaction tests and finish with desktop/mobile Playwright screenshots.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, plain CSS, Vitest, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-07-stockcal-unified-workspace-design.md`

## Global Constraints

- Canvas `#F5F7FA`, surface `#FFFFFF`, border `#D8DEE8`, primary `#4F46E5`.
- Body, button, and table text is at least 14px; helper text is at least 12px.
- Mobile primary tap targets are at least 44px and content must not be covered by the bottom navigation.
- Preserve existing real-market, rule execution, prediction, record, and chart data contracts.
- Do not add dark mode, cyber gradients, social-feed styling, fake market data, fake returns, or a sixth primary navigation item.
- Trading routes remain grouped under the `复盘` primary navigation item.

---

### Task 1: Unified tokens and application shell

**Files:**
- Modify: `frontend/app/globals.css`
- Modify: `frontend/app/workspace-polish.css`
- Modify: `frontend/src/features/navigation/navigation-config.ts`
- Modify: `frontend/src/features/navigation/app-shell.tsx`
- Test: `frontend/src/features/navigation/app-shell.test.tsx`
- Test: `frontend/src/features/navigation/navigation-config.test.ts`

**Interfaces:**
- Consumes: existing `PrimarySection`, `WorkspaceTone`, desktop/mobile navigation arrays.
- Produces: one `sc-shell` visual system, stable five-item navigation, shared `sc-page-header`, `sc-panel`, `sc-button`, `sc-tabs`, `sc-alert`, and responsive control contracts.

- [ ] **Step 1: Write failing shell tests**

Add assertions that all tones render the same `sc-shell` contract, the brand reads `StockCal`, trading selects `复盘`, and every mobile navigation link has a readable icon label.

```tsx
render(<AppShell section="trading" tone="cyber" onSectionChange={vi.fn()} />)
expect(screen.getByTestId('app-shell')).toHaveClass('sc-shell-unified')
expect(screen.getByRole('link', { name: '回到总览' })).toHaveTextContent('StockCal')
expect(screen.getByTestId('mobile-primary-nav').querySelector('a[href="/review/daily"]')).toHaveAttribute('aria-current', 'page')
```

- [ ] **Step 2: Run the navigation tests and verify RED**

Run: `npm test -- src/features/navigation/app-shell.test.tsx src/features/navigation/navigation-config.test.ts`

Expected: FAIL because `sc-shell-unified` and the StockCal brand copy do not exist.

- [ ] **Step 3: Implement the shared shell and tokens**

Make `tone` a compatibility input only, add `sc-shell-unified`, replace the brand copy, convert text glyph icons to one consistent line-icon treatment, define the exact spec tokens, remove theme-specific gradients, and consolidate repeated button/panel/tab/form/focus styles.

- [ ] **Step 4: Run the navigation tests and verify GREEN**

Run: `npm test -- src/features/navigation/app-shell.test.tsx src/features/navigation/navigation-config.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/globals.css frontend/app/workspace-polish.css frontend/src/features/navigation/navigation-config.ts frontend/src/features/navigation/app-shell.tsx frontend/src/features/navigation/app-shell.test.tsx frontend/src/features/navigation/navigation-config.test.ts
git commit -m "feat: unify StockCal application shell"
```

### Task 2: Overview and analysis decision workspace

**Files:**
- Modify: `frontend/src/features/overview/live-overview-page.tsx`
- Modify: `frontend/src/features/analysis/analysis-page.tsx`
- Modify: `frontend/src/features/analysis/stock-header.tsx`
- Modify: `frontend/src/features/analysis/key-levels-panel.tsx`
- Modify: `frontend/app/workspace-polish.css`
- Test: `frontend/src/features/overview/live-overview-page.test.tsx`
- Test: `frontend/src/features/analysis/analysis-page.interaction.test.tsx`

**Interfaces:**
- Consumes: `StockWorkspaceProvider`, existing live snapshot, analysis decision, key-level and rule evidence data.
- Produces: `sc-decision-workspace`, `sc-decision-primary`, `sc-context-rail`, and consistent loading/error/action regions.

- [ ] **Step 1: Write failing layout contract tests**

Assert that the live overview exposes a named decision region and analysis exposes a contextual action rail without changing existing data assertions.

```tsx
expect(screen.getByRole('region', { name: '投资决策' })).toHaveClass('sc-decision-primary')
expect(screen.getByRole('complementary', { name: '分析操作' })).toBeInTheDocument()
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/features/overview/live-overview-page.test.tsx src/features/analysis/analysis-page.interaction.test.tsx`

Expected: FAIL because the new semantic regions are absent.

- [ ] **Step 3: Implement the unified decision layout**

Restructure only presentation markup: desktop list/decision/context columns, 390px single-column order, consistent page header and actions, 14px minimum controls, and spec-compliant skeleton/error panels. Preserve all query, retry, analysis and prediction callbacks.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- src/features/overview/live-overview-page.test.tsx src/features/analysis/analysis-page.interaction.test.tsx src/features/analysis/analysis-panels.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/overview frontend/src/features/analysis frontend/app/workspace-polish.css
git commit -m "feat: align overview and analysis workspaces"
```

### Task 3: Professional chart workspace

**Files:**
- Modify: `frontend/src/features/chart/chart-workspace.tsx`
- Modify: `frontend/src/features/chart/chart-toolbar.tsx`
- Modify: `frontend/src/features/chart/chart-layer-panel.tsx`
- Modify: `frontend/app/workspace-polish.css`
- Test: `frontend/src/features/chart/chart-workspace.test.tsx`

**Interfaces:**
- Consumes: existing period, MA/BOLL, layer, zoom, crosshair, annotation, sync, and price-label state.
- Produces: unified toolbar groups, desktop chart/inspector grid, and accessible `图表工具` mobile sheet.

- [ ] **Step 1: Write failing chart presentation tests**

Add assertions for the unified workspace class, mobile tool-sheet dialog semantics, and grouped 44px controls while retaining existing interaction assertions.

```tsx
expect(container.querySelector('.sc-kline-terminal')).toBeInTheDocument()
await user.click(screen.getByRole('button', { name: '图表工具' }))
expect(screen.getByRole('dialog', { name: '图表工具' })).toBeInTheDocument()
```

- [ ] **Step 2: Run the chart test and verify RED**

Run: `npm test -- src/features/chart/chart-workspace.test.tsx`

Expected: FAIL because the terminal class and dialog contract are absent.

- [ ] **Step 3: Implement the accepted chart composition**

Apply the shared surface and controls, keep the chart dominant, organize period/indicator/drawing/zoom/layer groups, implement dialog labeling and focus restoration for mobile tools, and preserve all existing chart calculations and annotation prices.

- [ ] **Step 4: Run the chart tests and verify GREEN**

Run: `npm test -- src/features/chart/chart-workspace.test.tsx src/features/chart/chart-workspace-state.test.ts src/features/chart/chart-workspace-sync.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/chart frontend/app/workspace-polish.css
git commit -m "feat: unify professional chart workspace"
```

### Task 4: Rules library table and inspector

**Files:**
- Modify: `frontend/src/features/rules/rules-page.tsx`
- Modify: `frontend/src/features/rules/knowledge-review-panel.tsx`
- Modify: `frontend/src/features/rules/markdown-import-panel.tsx`
- Modify: `frontend/app/workspace-polish.css`
- Test: `frontend/src/features/rules/rules-page.interaction.test.tsx`
- Test: `frontend/src/features/rules/knowledge-review-panel.test.tsx`
- Test: `frontend/src/features/rules/markdown-import-panel.test.tsx`

**Interfaces:**
- Consumes: existing rule filters, counts, pagination, draft review, create/import, publish and persistent enable handlers.
- Produces: responsive `规则表格`, selected rule inspector, mobile rule list/detail sheet, and shared form errors.

- [ ] **Step 1: Write failing rules layout tests**

Assert that desktop rules expose a table with named columns, selection opens `规则详情`, and incomplete create/import flows use an alert linked to the invalid field.

```tsx
expect(screen.getByRole('table', { name: '规则表格' })).toBeInTheDocument()
await user.click(screen.getAllByRole('button', { name: '查看详情' })[0])
expect(screen.getByRole('dialog', { name: '规则详情' })).toBeInTheDocument()
```

- [ ] **Step 2: Run focused rules tests and verify RED**

Run: `npm test -- src/features/rules/rules-page.interaction.test.tsx src/features/rules/knowledge-review-panel.test.tsx src/features/rules/markdown-import-panel.test.tsx`

Expected: FAIL because the current card list is not a semantic table and detail is not a dialog/inspector.

- [ ] **Step 3: Implement table/list plus inspector**

Use one filtered source for tabs and table rows, preserve 20-row pagination, render desktop table and mobile compact rows from the same data, place persistent enable state and completeness in explicit columns, and reuse accessible drawer/dialog behavior for detail and create/import.

- [ ] **Step 4: Run focused rules tests and verify GREEN**

Run: `npm test -- src/features/rules/rules-page.interaction.test.tsx src/features/rules/knowledge-review-panel.test.tsx src/features/rules/markdown-import-panel.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/rules frontend/app/workspace-polish.css
git commit -m "feat: unify rules library workspace"
```

### Task 5: Trading, review, and settings workspaces

**Files:**
- Modify: `frontend/src/features/trading/trading-page.tsx`
- Modify: `frontend/src/features/review/review-page.tsx`
- Modify: `frontend/src/features/settings/settings-page.tsx`
- Modify: `frontend/src/features/records/record-sync-button.tsx`
- Modify: `frontend/app/workspace-polish.css`
- Test: `frontend/src/features/trading/trading-page.interaction.test.tsx`
- Test: `frontend/src/features/review/review-page.interaction.test.tsx`
- Test: `frontend/src/features/settings/settings-page.test.tsx`

**Interfaces:**
- Consumes: local record storage/sync, trade form, positions, predictions, daily/trade/history/backtest review, and settings state.
- Produces: positions summary/table/inspector, ledger and prediction lists, mobile trade sheet, structured review form, and shared settings groups.

- [ ] **Step 1: Write failing workspace tests**

Assert a named positions table, accessible `新增交易` dialog, structured review sections, and a common settings page header.

```tsx
expect(screen.getByRole('table', { name: '持仓列表' })).toBeInTheDocument()
await user.click(screen.getByRole('button', { name: '记录交易' }))
expect(screen.getByRole('dialog', { name: '新增交易' })).toBeInTheDocument()
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/features/trading/trading-page.interaction.test.tsx src/features/review/review-page.interaction.test.tsx src/features/settings/settings-page.test.tsx`

Expected: FAIL because the current trading views are card/flow layouts and do not expose the accepted semantic structure.

- [ ] **Step 3: Implement the unified secondary workspaces**

Render positions as a desktop table and mobile list, retain existing local calculation semantics, convert trade entry to an accessible responsive dialog/sheet, keep ledger and prediction actions, split daily review into market/execution/improvement fields without changing record persistence, and style settings with shared form/panel primitives.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- src/features/trading/trading-page.interaction.test.tsx src/features/trading/trading-review-rules.test.tsx src/features/review/review-page.interaction.test.tsx src/features/settings/settings-page.test.tsx src/features/records/record-store.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/trading frontend/src/features/review frontend/src/features/settings frontend/src/features/records frontend/app/workspace-polish.css
git commit -m "feat: unify records and review workspaces"
```

### Task 6: Responsive and accessibility regression coverage

**Files:**
- Modify: `frontend/e2e/workspace-regression.spec.ts`
- Modify: `frontend/app/globals.css`
- Modify: `frontend/app/workspace-polish.css`

**Interfaces:**
- Consumes: all page routes and accepted 1440px/390px layouts.
- Produces: browser evidence for desktop/mobile navigation, no overflow, dialogs, chart tools, forms and screenshots.

- [ ] **Step 1: Extend browser checks before final polish**

For `/overview`, `/analysis/key-levels`, `/chart`, `/rules`, `/trading/positions`, `/review/daily`, and `/settings`, assert the active primary navigation, `document.documentElement.scrollWidth <= window.innerWidth`, visible 14px body controls, and mobile 44px primary targets. Capture named screenshots for visual comparison.

- [ ] **Step 2: Run browser tests and observe failures**

Run: `npm run test:e2e -- --project=desktop --project=mobile`

Expected: any remaining visual overflow, inaccessible dialog or undersized target fails with its route and selector.

- [ ] **Step 3: Apply only evidence-driven responsive fixes**

Correct the reported grid collapse, safe-area, overflow, sticky action, focus, or control-size rules without changing data behavior or adding new visual patterns.

- [ ] **Step 4: Re-run browser tests and verify GREEN**

Run: `npm run test:e2e -- --project=desktop --project=mobile`

Expected: PASS on both projects with screenshots created.

- [ ] **Step 5: Commit**

```bash
git add frontend/e2e/workspace-regression.spec.ts frontend/app/globals.css frontend/app/workspace-polish.css
git commit -m "test: verify unified workspace responsiveness"
```

### Task 7: React review and release verification

**Files:**
- Modify only files identified by React review or verification failures.

**Interfaces:**
- Consumes: completed unified workspace.
- Produces: release-ready branch with fresh verification evidence.

- [ ] **Step 1: Review changed TSX files against React best practices**

Check state ownership, derived values, effect dependencies, event handlers, list keys, accessibility, client boundaries, unnecessary rerenders and duplicated markup. For every discovered defect, write a failing test before changing production code.

- [ ] **Step 2: Run the full automated suite**

Run: `npm test`

Expected: all Vitest files and tests PASS with zero failures.

- [ ] **Step 3: Run static and production checks**

Run: `npm run lint`

Expected: exit 0 with no ESLint errors.

Run: `npm run build`

Expected: exit 0 and a successful Next.js production build.

- [ ] **Step 4: Perform final visual comparison**

Open the accepted concept images and the latest desktop/mobile browser screenshots with `view_image`. Compare palette, typography, navigation, panel density, tables, chart proportions, forms and mobile sheets. If an agency reviewer would flag a mismatch, return to the relevant task and fix it before repeating Steps 2–4.

- [ ] **Step 5: Check the final diff and commit review fixes**

Run: `git diff --check && git status --short && git log --oneline -10`

Expected: no whitespace errors and only intentional project changes.

```bash
git add frontend
git commit -m "fix: complete unified workspace review"
```

