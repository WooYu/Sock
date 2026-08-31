# StockCal 分析与规则决策闭环实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将真实行情转换为可审计的技术分析和规则决策快照，并接入 Next.js 个股分析页面。

**Architecture:** Spring Boot 负责指标、关键位、已发布规则和等待策略；PostgreSQL 保存分析快照；Next.js BFF 代理分析接口，浏览器只消费同源 API。当前免登录模式下使用匿名分析快照，后续由预测和交易模块引用快照 ID。

**Tech Stack:** Spring Boot、Java、PostgreSQL、Flyway、Next.js App Router、TypeScript、Vitest、Testing Library

**Spec:** `docs/superpowers/specs/2026-08-31-analysis-rules-loop-design.md`

## Global Constraints

- 规则负责判断，计算负责定量，历史结果负责校准，AI 负责解释。
- 条件不完整、行情不可用或规则冲突时，必须输出 `WAITING`，不得强行给出方向。
- 只读取已发布规则，草稿和待审批规则不得进入分析输入。
- 浏览器不得接触 Tushare、数据库、AI token 或后端内部地址。
- 保持 `STOCKCAL_AUTH_REQUIRED=false` 的免登录开发模式。
- 不实现自动交易，不将交易数据写入行情快照。

---

### Task 1: 定义后端分析领域模型和计算服务

**Files:**
- Create: `backend/src/main/java/com/stockcal/analysis/AnalysisModels.java`
- Create: `backend/src/main/java/com/stockcal/analysis/AnalysisCalculator.java`
- Test: `backend/src/test/java/com/stockcal/analysis/AnalysisCalculatorTest.java`

**Interfaces:**
- `AnalysisCalculator.calculate(MarketProvider.MarketSnapshot snapshot, String cycle)` returns `AnalysisModels.CalculatedAnalysis`
- `CalculatedAnalysis` contains status, direction, reason, confidence, indicators, support, resistance, target and generatedAt

- [ ] **Step 1: Write the failing calculation tests**

Create tests for 25 ascending candles and 10 insufficient candles. Assert MA5/MA10/MA20, BOLL middle, support, resistance, `READY`, and `WAITING` with a data-insufficient reason.

- [ ] **Step 2: Run the calculation tests and confirm failure**

Run: `cd backend && bash ./gradlew test --tests com.stockcal.analysis.AnalysisCalculatorTest`

Expected: FAIL because the analysis package and calculator do not exist. If Gradle cannot download the wrapper, record the network failure and use compilation inspection without claiming the test passed.

- [ ] **Step 3: Implement the minimal calculator**

Calculate the last 20 candles, use trailing close averages for MA5/10/20, population standard deviation multiplied by 2 for BOLL, recent low/high for support/resistance, and a target equal to resistance plus half the support-resistance range. Return `WAITING` and zero confidence when fewer than 20 valid candles exist.

- [ ] **Step 4: Run the calculation tests again**

Run the same Gradle test command and confirm all calculation assertions pass when dependencies are available.

- [ ] **Step 5: Commit the calculator**

```bash
git add backend/src/main/java/com/stockcal/analysis backend/src/test/java/com/stockcal/analysis/AnalysisCalculatorTest.java
git commit -m "feat(backend): add stock analysis calculator"
```

### Task 2: Add published-rule evaluation and waiting policy

**Files:**
- Create: `backend/src/main/java/com/stockcal/analysis/RuleEngine.java`
- Create: `backend/src/main/java/com/stockcal/analysis/DecisionPolicy.java`
- Test: `backend/src/test/java/com/stockcal/analysis/RuleEngineTest.java`

**Interfaces:**
- `RuleEngine.evaluate(AnalysisModels.IndicatorSnapshot indicators, List<PublishedRule> rules)` returns `List<RuleEvaluation>`
- `DecisionPolicy.decide(CalculatedAnalysis calculation, List<RuleEvaluation> evaluations)` returns a final `Decision`

- [ ] **Step 1: Write failing rule tests**

Cover: no published rule produces `WAITING`; one bullish rule produces `BULLISH`; opposite bullish and bearish rules produce `WAITING` with a conflict reason; draft rules are not accepted by the engine input type.

- [ ] **Step 2: Run tests and confirm failure**

Run: `cd backend && bash ./gradlew test --tests com.stockcal.analysis.RuleEngineTest`

Expected: FAIL because rule engine and decision policy do not exist.

- [ ] **Step 3: Implement rule evaluation**

Support the first rule predicates: price above/below MA20, MA5 above/below MA20, and price above/below BOLL middle. Evaluate only published rules and attach rule ID/version, direction, score and reason.

- [ ] **Step 4: Implement conservative decision policy**

Return `WAITING` for no matches or opposing directions. Return a direction only when all matched rules agree and the calculated analysis status is `READY`. Clamp confidence to `[0, 1]`.

- [ ] **Step 5: Run rule tests and commit**

Run the targeted Gradle test, then:

```bash
git add backend/src/main/java/com/stockcal/analysis backend/src/test/java/com/stockcal/analysis/RuleEngineTest.java
git commit -m "feat(backend): add conservative published rule decisions"
```

### Task 3: Persist and expose analysis snapshots

**Files:**
- Create: `backend/src/main/resources/db/migration/V11__analysis_snapshots.sql`
- Create: `backend/src/main/java/com/stockcal/analysis/AnalysisSnapshotRepository.java`
- Create: `backend/src/main/java/com/stockcal/analysis/AnalysisService.java`
- Create: `backend/src/main/java/com/stockcal/analysis/AnalysisController.java`
- Test: `backend/src/test/java/com/stockcal/analysis/AnalysisApiTest.java`

**Interfaces:**
- `GET /api/v1/analysis/stocks/{code}?cycle=short|swing|long`
- `AnalysisService.analyze(String code, String cycle)` returns `AnalysisSnapshot`

- [ ] **Step 1: Write failing API tests**

Assert that a valid request returns symbol, cycle, indicators, rules and generated time; insufficient data returns HTTP 200 with `WAITING`; invalid cycle returns HTTP 400; unknown stock preserves the market provider’s 404.

- [ ] **Step 2: Run API tests and confirm failure**

Run: `cd backend && bash ./gradlew test --tests com.stockcal.analysis.AnalysisApiTest`

Expected: FAIL because the route, migration and service do not exist.

- [ ] **Step 3: Add the migration and repository**

Create an `analysis_snapshot` table containing ID, symbol, cycle, status, direction, reason, confidence, indicator JSON, key-level JSON, rule-evaluation JSON, market source, market day and generated time. Add indexes on `(symbol, cycle, generated_at)`.

- [ ] **Step 4: Implement the service and controller**

Load the market snapshot, calculate indicators, load published rules from the existing knowledge repository, evaluate rules, apply the waiting policy, save the snapshot, and return it. Validate cycle before calling the provider.

- [ ] **Step 5: Run API tests, inspect migration and commit**

Run the targeted Gradle test and inspect the generated response for secret leakage. Commit with:

```bash
git add backend/src/main/java/com/stockcal/analysis backend/src/main/resources/db/migration/V11__analysis_snapshots.sql backend/src/test/java/com/stockcal/analysis/AnalysisApiTest.java
git commit -m "feat(backend): expose persisted stock analysis snapshots"
```

### Task 4: Connect Next.js workspace and analysis panels

**Files:**
- Modify: `frontend/src/features/workspace/stock-workspace-types.ts`
- Modify: `frontend/src/features/workspace/stock-workspace-provider.tsx`
- Modify: `frontend/src/lib/api/browser-client.ts`
- Modify: `frontend/src/lib/api/backend-client.ts`
- Create: `frontend/app/api/market/stocks/[symbol]/analysis/route.ts`
- Modify: `frontend/src/features/analysis/*.tsx`
- Test: `frontend/src/features/workspace/stock-workspace-provider.test.tsx`
- Test: `frontend/app/api/market/market-route.test.ts`

**Interfaces:**
- Browser BFF: `/api/market/stocks/:symbol/analysis?cycle=`
- `BrowserMarketClient.analysis(symbol, cycle, signal)` returns `StockAnalysis`

- [ ] **Step 1: Write failing BFF and integration tests**

Assert the analysis route forwards symbol and cycle, the provider stores the returned analysis, and a waiting response is rendered as a waiting state rather than as zero-valued cards.

- [ ] **Step 2: Run targeted frontend tests and confirm failure**

Run: `cd frontend && npm run test -- src/features/workspace frontend/app/api/market src/features/analysis`

Expected: FAIL because the analysis client and route are not defined.

- [ ] **Step 3: Implement typed BFF and provider integration**

Proxy only to the server-side backend client, pass `cycle`, preserve the current request-version/abort behavior, and stop calculating analysis inside the provider once the backend response is available.

- [ ] **Step 4: Update panels to consume backend result**

Render status, reason, calculation time, indicator values, rule evaluations and key levels from the response. Keep AI explanation as a clearly labeled unavailable step.

- [ ] **Step 5: Run frontend tests, lint and build**

Run: `cd frontend && npm run test && npm run lint && npm run build`

Expected: all tests pass, no lint errors, production build succeeds.

- [ ] **Step 6: Commit the frontend integration**

```bash
git add frontend/app/api/market frontend/src/features/analysis frontend/src/features/workspace frontend/src/lib/api
git commit -m "feat(web): connect analysis snapshots to stock workspace"
```

### Task 5: End-to-end verification and handoff

**Files:**
- Modify: `docs/deployment/web-first-deployment.md`
- Create: `docs/verification/2026-08-31-analysis-rules-loop.md`

- [ ] **Step 1: Verify local API contracts**

Run the frontend full test/lint/build commands and, when the backend environment is available, run the analysis API tests and query `/api/v1/analysis/stocks/600519?cycle=swing`.

- [ ] **Step 2: Verify conservative outcomes**

Check data insufficient, no published rules, aligned rules and conflicting rules. Record the actual JSON status and reason for each case; do not call demo fallback a real analysis result.

- [ ] **Step 3: Document deployment migration**

Add the V11 migration note, required restart command, and rollback note. Do not include token values.

- [ ] **Step 4: Commit verification notes**

```bash
git add docs/deployment/web-first-deployment.md docs/verification/2026-08-31-analysis-rules-loop.md
git commit -m "docs: verify analysis and rule decision loop"
```

## Self-check

- Calculation, rule evaluation, persistence, API and frontend integration are separate tasks with test gates.
- Every decision path has an explicit waiting outcome.
- Draft rules cannot enter the engine because the service provides published rules only.
- The plan does not claim backend tests pass when Gradle dependencies are unavailable.
- Trading, review, AI and authentication are intentionally outside this first sub-project and will consume `AnalysisSnapshot` later.
