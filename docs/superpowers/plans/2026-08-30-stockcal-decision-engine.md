# StockCal 决策中枢与可审计 AI 分析实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 StockCal 实现为规则判定、确定性计算、历史校准和受约束 AI 解释组成的完整决策闭环。

**Architecture:** Flutter 负责 local-first 的指标和决策中枢，Spring Boot 负责知识库、历史数据和 AI 解释接口，网页端消费同一套决策字段语义。决策结果是不可变快照；AI 只能解释快照、规则证据和校准摘要，不能修改数值或强行改变 WAIT。

**Tech Stack:** Dart/Flutter 3.44、Java 21/Spring Boot、TypeScript/Next.js、现有 shared_preferences/http/JdbcClient。

**Spec:** `docs/superpowers/specs/2026-08-30-stockcal-decision-engine-design.md`

## Global Constraints

- 决策状态固定为 `ENTER | HOLD | REDUCE | EXIT | AVOID | WAIT`。
- 缺少必要事实、行情过期、无规则命中或规则冲突必须输出 `WAIT`。
- 持仓模式触发硬性失效条件时优先输出 `EXIT`。
- 只有已发布且启用的规则才能参与分析。
- 未达到最小历史样本数时显示「历史样本不足」，不能把启发式分数称为概率。
- AI 只能返回解释，不能改变决策、指标、价格或发布规则。
- 每个规则匹配必须保留规则版本和原文证据。
- 所有新增行为先写失败测试，再实现最小代码。
- 保持现有知识库、预测、复盘和分析测试通过。

---

### Task 1: 决策模型和决策门

**Files:**
- Create: `lib/features/decision/decision_models.dart`
- Create: `lib/features/decision/decision_engine.dart`
- Test: `test/features/decision/decision_engine_test.dart`

**Interfaces:**
- `DecisionAction`：`enter`、`hold`、`reduce`、`exit`、`avoid`、`wait`。
- `StrategyMode`：`baseGranville`、`phase3Opening`、`seaTurtle`、`rebound`、`mirrorRetest`、`sidewaysPhase3`、`monthlyWait`、`demonStock`、`exclusion`。
- `DecisionCandidate(ruleId, ruleVersion, name, mode, action, priority, requiredFactsKnown, evidence, invalidationConditions, calibration)`。
- `DecisionInput(dataFresh, missingFacts, holding, hardInvalidations, exclusions, candidates, support, resistance, target, generatedAt)`。
- `DecisionResult(decision, primaryMode, reason, matchedRules, missingFacts, conflicts, invalidationConditions, support, resistance, target, calibration, generatedAt)`。
- `DecisionEngine.evaluate(DecisionInput input) -> DecisionResult`。

- [ ] **Step 1: 写失败测试**：覆盖缺少事实返回 WAIT、行情过期返回 WAIT、无规则命中返回 WAIT、同优先级互斥动作返回 WAIT、持仓硬失效返回 EXIT、过滤器返回 AVOID、单一入场候选返回 ENTER。
- [ ] **Step 2: 运行 `flutter test test/features/decision/decision_engine_test.dart`，确认因类型和实现不存在而失败。**
- [ ] **Step 3: 创建模型和 `DecisionEngine`，按数据校验 → 硬失效 → 过滤器 → 规则命中 → 冲突 → 正常行动的顺序实现。未知条件不得用默认值补齐。
- [ ] **Step 4: 重新运行该测试，确认全部通过。**
- [ ] **Step 5: 提交 `feat: add auditable decision gate`。**

### Task 2: 扩展规则事实并接入技术分析

**Files:**
- Modify: `lib/features/rules/rule_engine.dart`
- Modify: `lib/features/analysis/technical_analysis.dart`
- Modify: `lib/features/analysis/stock_analysis_controller.dart`
- Modify: `lib/features/analysis/stock_analysis_screen.dart`
- Test: `test/features/rules/rule_engine_test.dart`
- Test: `test/features/analysis/technical_analysis_test.dart`
- Test: `test/features/analysis/stock_analysis_controller_test.dart`

**Interfaces:**
- 在 `RuleField` 增加 `closeAboveMa5`、`closeAboveBollMiddle`、`ma5SlopePositive`、`bollMiddleSlopePositive`、`granvilleDay`、`phase`、`marketPanic`、`relativeStrength`、`phase3Opening`、`mirrorRetest`。
- `RuleFacts` 保留现有构造参数，新增字段使用可空值；`valueFor` 返回未知状态而不是伪造数值。
- `RuleVersion` 增加可选 `DecisionAction action`、`StrategyMode mode`、`String timeframe`、`List<String> invalidationConditions` 和 `List<String> evidenceIds`。
- `StockAnalysis` 增加可选 `DecisionResult decision`。
- `StockAnalyzer.analyze` 增加可选参数 `bool holding = false`、`bool dataFresh = true` 和 `CalibrationBook? calibration`。

- [ ] **Step 1: 为未知 RuleFact、MA5 破位、BOLL 中轨下方和阶段候选写失败测试。**
- [ ] **Step 2: 运行对应 Flutter 测试，确认新字段和决策结果尚不存在。**
- [ ] **Step 3: 扩展 RuleBook，并在 StockAnalyzer 中生成确定性事实：MA5/BOLL 位置、MA5/BOLL 斜率、葛兰碧第一天启发式、镜像形态、数据完整性和基础趋势候选。**
- [ ] **Step 4: 使用 DecisionEngine 生成 `StockAnalysis.decision`；持仓且跌破 MA5/BOLL 中轨时生成 EXIT，非持仓无明确候选时生成 WAIT。**
- [ ] **Step 5: 在 Controller 中将历史不足、行情过期和离线状态转换为 WAIT；在 Screen 中显示决策状态、等待原因、冲突和失效条件，禁止只显示目标位。**
- [ ] **Step 6: 运行分析、规则和 Controller 测试，确认通过。**
- [ ] **Step 7: 提交 `feat: connect deterministic analysis to decision gate`。**

### Task 3: 历史结果校准

**Files:**
- Create: `lib/features/rules/calibration.dart`
- Modify: `lib/features/rules/backtest_engine.dart`
- Modify: `lib/features/review/review_service.dart`
- Modify: `lib/features/analysis/technical_analysis.dart`
- Test: `test/features/rules/calibration_test.dart`
- Test: `test/features/rules/backtest_engine_test.dart`

**Interfaces:**
- `CalibrationKey(ruleId, ruleVersion, mode, timeframe, horizonSessions)`。
- `CalibrationSummary(sampleCount, hitRate, meanAbsoluteError, meanSlippage, maximumDrawdown, calibrated, confidence, invalidationReasons)`。
- `CalibrationBook(Map<CalibrationKey, CalibrationSummary> summaries)`。
- `CalibrationService.fromBacktest(BacktestResult result, RuleVersion rule) -> CalibrationSummary`。
- `CalibrationService.fromReviews(Iterable<TradeReview> reviews, CalibrationKey key) -> CalibrationSummary`。
- 默认最小样本数为可配置值，测试使用显式传入的较小值验证边界。

- [ ] **Step 1: 写样本不足、样本达到阈值、命中率/误差计算和失效原因汇总测试。**
- [ ] **Step 2: 运行测试确认失败。**
- [ ] **Step 3: 实现校准模型和服务；BacktestResult/TradeReview 只读，不修改原始记录。**
- [ ] **Step 4: 将 CalibrationBook 注入 StockAnalyzer/DecisionEngine；未校准决策显示 `calibrated=false` 和样本数。**
- [ ] **Step 5: 运行回测、复盘和校准测试。**
- [ ] **Step 6: 提交 `feat: calibrate strategy confidence from history`。**

### Task 4: Spring Boot 结构化 AI 解释接口

**Files:**
- Create: `backend/src/main/java/com/stockcal/analysis/StrategyExplanationModels.java`
- Create: `backend/src/main/java/com/stockcal/analysis/StrategyExplanationClient.java`
- Create: `backend/src/main/java/com/stockcal/analysis/ChatCompletionsStrategyExplanationClient.java`
- Create: `backend/src/main/java/com/stockcal/analysis/StrategyExplanationConfiguration.java`
- Create: `backend/src/main/java/com/stockcal/analysis/StrategyExplanationController.java`
- Test: `backend/src/test/java/com/stockcal/analysis/StrategyExplanationApiTest.java`
- Test: `backend/src/test/java/com/stockcal/analysis/StrategyExplanationClientTest.java`

**Interfaces:**
- `POST /api/v1/analysis/strategy-explanation` 接收决策、快照摘要、匹配规则、证据、冲突和校准摘要。
- 响应 `StrategyExplanation(decision, summary, evidenceIds, risks, unknowns)`。
- AI 响应中的 `decision` 必须与请求决策一致；`evidenceIds` 必须来自请求证据集合。

- [ ] **Step 1: 写 API 测试：AI 改写 decision 返回 4xx/5xx；未知 evidenceId 被拒绝；AI 未配置时返回确定性降级信息。**
- [ ] **Step 2: 运行 `cd backend && ./gradlew test --tests '*StrategyExplanation*'`，确认失败。**
- [ ] **Step 3: 实现请求/响应模型、严格 JSON 解析、证据校验和 provider-agnostic Chat Completions 客户端。**
- [ ] **Step 4: 使用系统提示明确 AI 只能解释输入事实，不能产生新价格或投资建议。**
- [ ] **Step 5: 运行后端测试。**
- [ ] **Step 6: 提交 `feat: add constrained strategy explanation api`。**

### Task 5: Flutter AI 解释和决策 UI

**Files:**
- Create: `lib/features/decision/strategy_explanation.dart`
- Create: `lib/features/decision/remote_strategy_explanation_adapter.dart`
- Modify: `lib/features/analysis/stock_analysis_controller.dart`
- Modify: `lib/features/analysis/stock_analysis_screen.dart`
- Test: `test/features/decision/strategy_explanation_test.dart`
- Test: `test/features/analysis/stock_analysis_screen_test.dart`

**Interfaces:**
- `StrategyExplanationAdapter.explain(DecisionResult result) -> Future<StrategyExplanation>`。
- `StrategyExplanationService.generate(DecisionResult result)`：校验返回 decision 与输入一致。
- AI 服务不可用时保留确定性决策，界面显示「AI 不可用，以下为本地规则结果」。

- [ ] **Step 1: 写服务测试：AI 改变 decision 被拒绝；AI 服务失败不覆盖确定性结果；WAIT 结果能生成等待解释。**
- [ ] **Step 2: 运行测试确认失败。**
- [ ] **Step 3: 实现远程适配器、超时/错误降级和解释版本留痕。**
- [ ] **Step 4: 在分析页增加决策状态卡、证据、缺失条件、冲突、失效条件和 AI 解释入口。**
- [ ] **Step 5: 运行 Flutter 全量测试。**
- [ ] **Step 6: 提交 `feat: show auditable decision and AI explanation`。**

### Task 6: 网页端接入同一决策语义

**Files:**
- Create: `frontend/src/features/analysis/analysis-engine.ts`
- Modify: `frontend/src/features/workspace/stock-workspace-types.ts`
- Modify: `frontend/src/features/workspace/stock-workspace-provider.tsx`
- Modify: `frontend/src/features/analysis/ai-strategy-panel.tsx`
- Modify: `frontend/src/features/analysis/patterns-panel.tsx`
- Modify: `frontend/src/features/analysis/key-levels-panel.tsx`
- Test: `frontend/src/features/analysis/analysis-engine.test.ts`
- Test: `frontend/src/features/analysis/analysis-panels.test.tsx`

**Interfaces:**
- `analyzeMarketSnapshot(snapshot: MarketSnapshot, options?: { holding?: boolean }) -> StockAnalysis`。
- 网页 `StockAnalysis` 增加 `decision`、`missingFacts`、`conflicts`、`invalidationConditions` 和 `calibration`。
- Provider 加载行情后必须生成分析对象，不再固定写入 `analysis: null`。

- [ ] **Step 1: 写不足 20 根 K 线、震荡无规则、破位 EXIT 和正常入场测试。**
- [ ] **Step 2: 运行 `cd frontend && npm run test -- analysis-engine.test.ts`，确认失败。**
- [ ] **Step 3: 实现与 Flutter 语义一致的 MA/BOLL/关键位/WAIT 决策计算。**
- [ ] **Step 4: 将分析结果接入 Provider 和各分析面板；WAIT 时隐藏误导性的买入/目标建议。**
- [ ] **Step 5: 运行 `npm run test && npm run lint && npm run build`。**
- [ ] **Step 6: 提交 `feat: connect web analysis to decision engine`。**

### Task 7: 知识库规则结构化

**Files:**
- Modify: `backend/src/main/java/com/stockcal/knowledge/KnowledgeModels.java`
- Modify: `backend/src/main/java/com/stockcal/knowledge/ChatCompletionsKnowledgeClient.java`
- Modify: `backend/src/main/java/com/stockcal/knowledge/OpenAiKnowledgeExtractor.java`
- Modify: `backend/src/main/java/com/stockcal/knowledge/JdbcKnowledgeRepository.java`
- Create: `backend/src/main/resources/db/migration/V11__structured_published_rules.sql`
- Modify: `lib/features/knowledge/knowledge.dart`
- Modify: `lib/features/knowledge/remote_knowledge_repository.dart`
- Test: `backend/src/test/java/com/stockcal/knowledge/OpenAiKnowledgeExtractorTest.java`
- Test: `test/features/knowledge/remote_knowledge_repository_test.dart`

**Interfaces:**
- 草稿/发布规则新增 `mode`、`timeframe`、`action`、`conditions`、`invalidationConditions`、`strength` 和 `evidence`。
- AI 提炼 JSON 必须返回上述字段；无法确定的字段返回 null/空集合，不能猜测。
- 未批准或 disabled 规则不进入 DecisionEngine。

- [ ] **Step 1: 写 AI 提炼结构化 JSON、未知字段拒绝执行、规则启停和证据保留测试。**
- [ ] **Step 2: 运行知识库测试确认失败。**
- [ ] **Step 3: 增加数据库字段和模型映射，兼容既有规则默认值。**
- [ ] **Step 4: 更新 AI 提炼器 prompt 和证据验证。**
- [ ] **Step 5: 将已发布规则转换为本地 RuleVersion，接入 RuleBook。**
- [ ] **Step 6: 运行后端与 Flutter 知识库测试。**
- [ ] **Step 7: 提交 `feat: persist structured knowledge rules`。**

### Task 8: 全量验证和交付

**Files:**
- Modify: `docs/superpowers/progress.md`
- Create: `docs/handoff/2026-08-30-stockcal-decision-engine-status.md`

- [ ] **Step 1: 运行 `cd backend && ./gradlew test`。**
- [ ] **Step 2: 运行 `flutter analyze && flutter test`。**
- [ ] **Step 3: 运行 `cd frontend && npm run test && npm run lint && npm run build`。**
- [ ] **Step 4: 检查分支 diff、迁移顺序、API 字段前后端一致性和敏感配置未入库。**
- [ ] **Step 5: 记录真实测试数量、剩余限制和未纳入的附件 OCR/音频转写。**
- [ ] **Step 6: 只有所有验证命令有新鲜结果后，才报告完成。**