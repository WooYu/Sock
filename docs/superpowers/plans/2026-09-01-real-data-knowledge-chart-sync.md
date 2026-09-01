# Real Data, Knowledge Rules, and Chart Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace demo-facing product behavior with Aliyun-backed market data, maintainable Markdown-derived knowledge rules, and authenticated cross-device K-line workspace sync.

**Architecture:** Keep the existing Spring Boot backend as the source of truth for market, knowledge, and sync APIs. Keep browser requests same-origin through Next BFF routes, while local-first chart state uses the existing sync log with a full `CHART_WORKSPACE` snapshot. The UI renders only real snapshots or explicit unavailable states, and knowledge remains source-evidence-first through import, extraction, approval, and publication.

**Tech Stack:** Spring Boot, JDBC migrations, Java records, Next.js App Router, React 19, TypeScript, Vitest/Testing Library, Flutter/Dart, existing REST sync and auth endpoints.

**Spec:** `docs/superpowers/specs/2026-09-01-real-data-knowledge-chart-sync-design.md`

## Global Constraints

- Do not display fixed demo prices, fake holdings, fake predictions, or `DEMO` labels in production pages.
- Delete only the page-level company-action module; keep K-line adjustment/复权 calculation code unchanged.
- Preserve Markdown source content, path, content hash, line range, and excerpt for every extracted item.
- Only approved and published `RULE` items can participate in analysis; other kinds remain explanatory evidence.
- Use `WAIT` when source conditions or invalidation cannot be established without invention.
- Cross-device chart sync requires a shared authenticated account; unauthenticated state is local-only and must say so.
- Every production behavior change starts with a failing test and is verified with fresh commands before being claimed complete.

---

### Task 1: Add regression tests for company-action removal and real-data empty states

**Files:**
- Create: `frontend/src/features/socksample/sample-dashboard.regression.test.tsx`
- Modify: `frontend/app/root-layout.test.ts`
- Test: `frontend/src/features/socksample/sample-dashboard.regression.test.tsx`

**Interfaces:**
- Consumes: `SampleDashboard` and the browser market snapshot client seam.
- Produces: assertions that the production entry point has no company-action module and does not render demo identity when a market request is unavailable.

- [ ] **Step 1: Write the failing tests**

```tsx
test('does not render the company-action module', () => {
  render(<SampleDashboard />)
  expect(screen.queryByText('公司行为调整')).not.toBeInTheDocument()
})

test('shows unavailable state instead of a demo quote', async () => {
  render(<SampleDashboard marketClient={failingMarketClient} />)
  expect(await screen.findByText(/真实行情暂不可用/)).toBeInTheDocument()
  expect(screen.queryByText('华芯动力')).not.toBeInTheDocument()
  expect(screen.queryByText('DEMO·001')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run the focused test and verify it fails for the missing behavior**

Run: `npm test -- --run src/features/socksample/sample-dashboard.regression.test.tsx`

Expected: FAIL because the current dashboard renders `公司行为调整`, `华芯动力`, and `DEMO·001`, and has no injected failing client.

- [ ] **Step 3: Commit the red tests**

```bash
git add frontend/src/features/socksample/sample-dashboard.regression.test.tsx frontend/app/root-layout.test.ts
git commit -m "test(web): cover real-data dashboard boundaries"
```

### Task 2: Build a live snapshot dashboard entry point

**Files:**
- Create: `frontend/src/features/overview/live-overview-page.tsx`
- Modify: `frontend/app/page.tsx`
- Modify: `frontend/src/features/workspace/stock-workspace-provider.tsx`
- Test: `frontend/src/features/overview/live-overview-page.test.tsx`

**Interfaces:**
- Consumes: `useStockWorkspace()` and `MarketSnapshot`.
- Produces: `LiveOverviewPage`, with real quote/candle state, search/symbol selection, explicit loading/error/empty states, and links to `/chart` and `/rules`.

- [ ] **Step 1: Write a failing live-page test**

```tsx
test('renders the live security and source from the market snapshot', () => {
  render(<LiveOverviewPage snapshot={fixtureSnapshot} />)
  expect(screen.getByText('贵州茅台')).toBeInTheDocument()
  expect(screen.getByText('600519')).toBeInTheDocument()
  expect(screen.getByText('Tushare Pro')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the test and observe the missing component**

Run: `npm test -- --run src/features/overview/live-overview-page.test.tsx`

Expected: FAIL with the new component missing.

- [ ] **Step 3: Implement the minimal live page and wire the root route**

Use `StockWorkspaceProvider initialSymbol={symbol ?? '600519'}` in `app/page.tsx`; render the snapshot’s security, quote, last updated time, candle count, source status, and explicit “真实行情暂不可用” state. Do not import `demo-data.ts` or define fallback numeric values.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- --run src/features/overview/live-overview-page.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the live entry point**

```bash
git add frontend/app/page.tsx frontend/src/features/overview/live-overview-page.tsx frontend/src/features/overview/live-overview-page.test.tsx frontend/src/features/workspace/stock-workspace-provider.tsx
git commit -m "feat(web): use live market snapshot on home"
```

### Task 3: Remove the page-level company-action module and demo-only assets

**Files:**
- Modify: `frontend/src/features/socksample/sample-dashboard.tsx`
- Modify: `frontend/src/features/overview/overview-page.tsx`
- Modify: `frontend/src/features/chart/chart-workspace.tsx`
- Modify: `frontend/src/features/navigation/app-shell.tsx`
- Modify: `frontend/app/globals.css`
- Modify: `frontend/e2e/socksample-baseline.spec.ts`

**Interfaces:**
- Consumes: existing chart adjustment transformer and live snapshot components.
- Produces: no page-level company-action UI, no demo ribbon or fallback labels in production routes, and a smoke test that asserts real-data empty-state behavior.

- [ ] **Step 1: Write a failing smoke assertion**

```ts
test('home has no company action or demo ribbon', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('公司行为调整')).toHaveCount(0)
  await expect(page.getByText('演示数据')).toHaveCount(0)
})
```

- [ ] **Step 2: Run the smoke test and verify it fails against the current UI**

Run: `npm run test:e2e -- e2e/socksample-baseline.spec.ts`

Expected: FAIL because the current root still renders the demo dashboard.

- [ ] **Step 3: Remove only the page module and its CSS**

Delete the `CompanyActionPanel` render/imports and related page styles. Keep `ChartDataTransformer.adjust`, Flutter adjustment controls, and chart data transformation untouched. Remove all demo-only dashboard sections from production routes; keep fixtures only under test helpers.

- [ ] **Step 4: Run frontend tests, lint, and the focused E2E**

Run: `npm test -- --run && npm run lint && npm run test:e2e -- e2e/socksample-baseline.spec.ts`

Expected: PASS with no company-action/demo landmarks.

- [ ] **Step 5: Commit the page cleanup**

```bash
git add frontend/src/features frontend/app frontend/e2e/socksample-baseline.spec.ts
git commit -m "refactor(web): remove demo dashboard and company actions"
```

### Task 4: Add source classification and default note extraction on the backend

**Files:**
- Modify: `backend/src/main/java/com/stockcal/knowledge/KnowledgeModels.java`
- Modify: `backend/src/main/java/com/stockcal/knowledge/NoteExtractor.java`
- Modify: `backend/src/main/java/com/stockcal/knowledge/OpenAiKnowledgeExtractor.java`
- Modify: `backend/src/main/java/com/stockcal/knowledge/ChatCompletionsKnowledgeClient.java`
- Modify: `backend/src/main/java/com/stockcal/knowledge/KnowledgeWorkflow.java`
- Modify: `backend/src/main/java/com/stockcal/knowledge/KnowledgeConfiguration.java`
- Create: `backend/src/main/resources/db/migration/V15__knowledge_categories.sql`
- Test: `backend/src/test/java/com/stockcal/knowledge/NoteExtractorTest.java`
- Test: `backend/src/test/java/com/stockcal/knowledge/KnowledgeWorkflowTest.java`

**Interfaces:**
- Consumes: existing `KnowledgeDraft`, source repository, AI extractor, and `/notes` startup scan.
- Produces: explicit kind/category metadata, safe extraction rules, and idempotent startup import/recognition of the high-signal stock notes.

- [ ] **Step 1: Write failing extractor tests**

```java
@Test
void classifiesRiskDisciplineWithoutCreatingAnEntrySignal() {
    var drafts = extractor.extract(source("不借钱、不杠杆、不满仓，盘前先写计划。"));
    assertThat(drafts).singleElement().extracting(KnowledgeDraft::kind)
        .isEqualTo(KnowledgeKind.RISK_DISCIPLINE);
    assertThat(drafts.getFirst().action()).isEqualTo("WAIT");
}

@Test
void keepsSourceLineEvidenceForExecutableRule() {
    var draft = extractor.extract(source("价格站上MA5，回踩不破再参与。")).getFirst();
    assertThat(draft.sourceLineStart()).isEqualTo(1);
    assertThat(draft.sourceExcerpt()).contains("MA5");
}
```

- [ ] **Step 2: Run the backend tests and verify the new assertions fail**

Run: `bash gradlew test --tests com.stockcal.knowledge.NoteExtractorTest --tests com.stockcal.knowledge.KnowledgeWorkflowTest`

Expected: FAIL because only `RULE`, `EXPERIENCE`, and `CONCEPT` exist and the extractor does not classify risk discipline/categories.

- [ ] **Step 3: Add schema and model fields**

Add `KnowledgeCategory` and `validation_status`; use a migration that backfills existing records as `UNSPECIFIED`/`PENDING_CALIBRATION`. Keep old constructors delegating to safe defaults.

- [ ] **Step 4: Update local and AI extraction prompts/validation**

Allow the new non-executable kinds and category. Reject actions other than `WAIT` for non-`RULE` kinds. Require exact source line/excerpt and preserve explicit uncertainty.

- [ ] **Step 5: Make startup import idempotently recognize configured core notes**

Import all `.md` files from `STOCKCAL_NOTES_PATH`; when AI is configured, extract the high-signal filenames from the analyzed corpus, catching/logging per-file failures so Aliyun startup remains healthy. Expose the remaining sources for manual batch extraction.

- [ ] **Step 6: Run the focused backend tests and verify they pass**

Run: `bash gradlew test --tests com.stockcal.knowledge.NoteExtractorTest --tests com.stockcal.knowledge.KnowledgeWorkflowTest`

Expected: PASS when Gradle dependencies are available; if the environment still cannot download Gradle, record the exact network limitation and continue with static compilation checks.

- [ ] **Step 7: Commit the knowledge model change**

```bash
git add backend/src/main/java/com/stockcal/knowledge backend/src/main/resources/db/migration backend/src/test/java/com/stockcal/knowledge
git commit -m "feat(knowledge): classify note evidence safely"
```

### Task 5: Add Markdown import and evidence-first rule management APIs/UI

**Files:**
- Modify: `backend/src/main/java/com/stockcal/knowledge/KnowledgeController.java`
- Create: `frontend/src/lib/api/knowledge-client.ts`
- Create: `frontend/app/api/knowledge/sources/route.ts`
- Create: `frontend/app/api/knowledge/sources/[id]/extract/route.ts`
- Create: `frontend/app/api/knowledge/drafts/route.ts`
- Create: `frontend/app/api/knowledge/drafts/[id]/approve/route.ts`
- Create: `frontend/app/api/knowledge/drafts/[id]/publish/route.ts`
- Modify: `frontend/src/features/rules/rules-page.tsx`
- Modify: `frontend/src/features/rules/default-rules.ts`
- Create: `frontend/src/features/rules/markdown-import-panel.tsx`
- Test: `frontend/src/features/rules/markdown-import-panel.test.tsx`
- Test: `frontend/src/features/rules/rules-page.interaction.test.tsx`

**Interfaces:**
- Consumes: backend knowledge endpoints and `getAuthorizationHeader()`.
- Produces: upload/paste/natural-language entry, source extraction, draft review, approval/publication, and evidence-based rule cards without fake score/sample fields.

- [ ] **Step 1: Write failing import UI tests**

```tsx
test('uploads multiple markdown files and starts extraction', async () => {
  render(<MarkdownImportPanel />)
  const input = screen.getByLabelText('导入 Markdown')
  await userEvent.upload(input, [markdownFile('买股原则.md'), markdownFile('五日线.md')])
  expect(await screen.findByText('已提交 2 个 Markdown 来源')).toBeInTheDocument()
})

test('does not show statistical reliability fields without calibration', () => {
  render(<RulesPage initialRules={[uncalibratedRule]} />)
  expect(screen.getByText('待校准')).toBeInTheDocument()
  expect(screen.queryByText(/有效样本/)).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `npm test -- --run src/features/rules/markdown-import-panel.test.tsx src/features/rules/rules-page.interaction.test.tsx`

Expected: FAIL because the panel and remote knowledge client do not exist and current cards show legacy fields.

- [ ] **Step 3: Implement BFF/client and import panel**

Read files with `File.text()`, reject non-Markdown files and empty content, post `{path, content}`, then call extract. Use the existing authorization header and show per-file success/error. Add paste and natural-language modes that share the same source endpoint.

- [ ] **Step 4: Replace built-in fake rules with source-backed records**

Keep only the analyzed high-signal defaults, attach real source names/line ranges, and classify experience/concept/risk records outside the executable toggle list. Remove legacy raw score/effective sample/reliability presentation unless `validationStatus` proves actual calibration.

- [ ] **Step 5: Run focused frontend tests and verify they pass**

Run: `npm test -- --run src/features/rules/markdown-import-panel.test.tsx src/features/rules/rules-page.interaction.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit the knowledge UI**

```bash
git add backend/src/main/java/com/stockcal/knowledge/KnowledgeController.java frontend/app/api/knowledge frontend/src/lib/api/knowledge-client.ts frontend/src/features/rules
git commit -m "feat(web): import and review markdown knowledge"
```

### Task 6: Persist and synchronize complete K-line workspace state on web

**Files:**
- Create: `frontend/src/features/chart/chart-workspace-state.ts`
- Create: `frontend/src/features/chart/chart-workspace-sync.ts`
- Modify: `frontend/src/features/chart/chart-workspace.tsx`
- Modify: `frontend/src/features/records/record-sync.ts`
- Test: `frontend/src/features/chart/chart-workspace-state.test.ts`
- Test: `frontend/src/features/chart/chart-workspace-sync.test.ts`

**Interfaces:**
- Consumes: existing annotation/drawing state, `applySyncMutation`, `pullSyncChanges`, client id, and auth header.
- Produces: `ChartWorkspaceSnapshot`, `mergeChartWorkspace(local, remote)`, local-first persistence, upload queue, pull/apply flow, and sync status UI.

- [ ] **Step 1: Write failing serialization/merge tests**

```ts
test('round trips chart drawings, indicators, layers, and view', () => {
  expect(deserializeChartWorkspace(serializeChartWorkspace(snapshot))).toEqual(snapshot)
})

test('merges drawings by id and keeps the newest field update', () => {
  const merged = mergeChartWorkspace(localSnapshot, remoteSnapshot)
  expect(merged.drawings.map((drawing) => drawing.id)).toEqual(['local', 'remote'])
})
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `npm test -- --run src/features/chart/chart-workspace-state.test.ts src/features/chart/chart-workspace-sync.test.ts`

Expected: FAIL because the state module and merge function do not exist.

- [ ] **Step 3: Implement the canonical snapshot and local persistence**

Persist under `stockcal:chart-workspace:${stockCode}:${period}`. Include `version: 1`, `updatedAt`, and `revision`; debounce writes and enqueue the complete snapshot, not only annotation metadata.

- [ ] **Step 4: Implement sync conflict handling**

On load/pull, group changes by entity id, select the latest server snapshot, merge drawings and settings, and retry with `revision = max(local.revision, remote.revision) + 1` when the server reports a revision conflict. Keep local state usable if the network fails.

- [ ] **Step 5: Wire chart controls and display sync status**

Persist period, indicator switches/config, layers, zoom/pan, crosshair, and drawings. Use real snapshot candles only; do not restore the chart’s `demoCandles` fallback. Show “本机保存” when unauthenticated and “已同步/待同步” when authenticated.

- [ ] **Step 6: Run focused chart tests and verify they pass**

Run: `npm test -- --run src/features/chart/chart-workspace-state.test.ts src/features/chart/chart-workspace-sync.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit web chart sync**

```bash
git add frontend/src/features/chart frontend/src/features/records/record-sync.ts
git commit -m "feat(web): sync complete chart workspaces"
```

### Task 7: Upload and pull complete chart state in Flutter

**Files:**
- Modify: `lib/features/chart/chart_annotations.dart`
- Modify: `lib/features/sync/remote_sync_service.dart`
- Modify: `lib/features/home/home_screen.dart`
- Create: `test/features/chart/chart_workspace_sync_test.dart`

**Interfaces:**
- Consumes: existing `ChartAnnotationController`, persistent repository/outbox, remote auth session, and `/api/v1/sync/changes`.
- Produces: full annotation payloads, cursor-based pull, remote merge, and refresh after sign-in/stock switch.

- [ ] **Step 1: Write failing Dart tests**

```dart
test('serializes annotation points in sync payload', () async {
  final payload = annotationPayload(annotation);
  expect(payload['points'], hasLength(2));
  expect(payload['type'], 'trendLine');
})

test('pull applies a remote annotation not present locally', () async {
  await worker.pull('token', '600519');
  expect(controller.annotations.single.id, 'remote-1');
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `flutter test test/features/chart/chart_workspace_sync_test.dart`

Expected: FAIL because the current worker uploads only stock code/timestamp and has no pull method.

- [ ] **Step 3: Add full payload serialization and cursor persistence**

Send annotation id, stock code, type, points, hidden, updatedAt, and revision. Store the per-account cursor in the existing persistent chart store or a focused sync metadata store.

- [ ] **Step 4: Add pull/merge and wire lifecycle events**

Pull after session restore, after drain, and when the chart stock changes. Apply remote annotations only when their revision/timestamp is newer; preserve local pending writes and requeue merged state.

- [ ] **Step 5: Run Dart tests and analyze**

Run: `flutter test test/features/chart/chart_workspace_sync_test.dart && flutter analyze`

Expected: PASS with no analyzer errors.

- [ ] **Step 6: Commit Flutter chart sync**

```bash
git add lib/features/chart lib/features/sync lib/features/home test/features/chart/chart_workspace_sync_test.dart
git commit -m "feat(flutter): sync chart annotations across devices"
```

### Task 8: Verify Aliyun deployment configuration and final acceptance

**Files:**
- Modify: `compose.yaml`
- Modify: `backend/src/main/resources/application.yml`
- Modify: `README.md`
- Create: `docs/handoff/2026-09-01-real-data-knowledge-chart-sync.md`

**Interfaces:**
- Consumes: production backend provider, note volume, auth configuration, and frontend BFF environment variables.
- Produces: deployment checklist and explicit runtime behavior for missing API keys, note mount, auth, and sync.

- [ ] **Step 1: Write a failing configuration test/check**

```bash
test -n "$STOCKCAL_API_BASE_URL"
test -n "$TUSHARE_TOKEN"
test -d ./notes
```

Run it in a clean shell without variables to confirm deployment prerequisites are not silently assumed.

- [ ] **Step 2: Make production configuration explicit**

Document `STOCKCAL_API_BASE_URL`, `STOCKCAL_API_URL`, `STOCKCAL_AUTH_REQUIRED=true`, `STOCKCAL_MARKET_API_KEY`/`TUSHARE_TOKEN`, `STOCKCAL_NOTES_PATH=/notes`, and AI provider/key settings. Ensure missing market token yields an unavailable response, not the deterministic configured sample provider in production.

- [ ] **Step 3: Run the full verification suite**

Run: `cd frontend && npm test -- --run && npm run lint && npm run build`; then `bash gradlew test` from `backend` when Gradle dependencies are available; then `flutter test && flutter analyze`.

Expected: frontend commands exit 0; backend/Dart results are recorded with exact counts or exact environment blockers.

- [ ] **Step 4: Inspect diff and acceptance landmarks**

Run: `git diff --check`; `rg -n "公司行为调整|演示数据|DEMO·|华芯动力|本地演示|demoCandles|demo-data" frontend/app frontend/src --glob '!**/*.test.*'`; verify no production matches remain except test-only fixtures and documented migration history.

- [ ] **Step 5: Commit deployment handoff and push the verified branch**

```bash
git add compose.yaml backend/src/main/resources/application.yml README.md docs/handoff/2026-09-01-real-data-knowledge-chart-sync.md
git commit -m "docs: document live data and cross-device sync"
git push origin agent/local-first-watchlist
```
