# Price Evaluation and Note Learning Implementation Plan

交付更新（2026-10-17）：用户已另行授权整理、提交并推送GitHub，供本地运行。下文“不提交／不推送”是原实施阶段的历史约束；本次交付按用户新指令执行。当前使用说明见[本地运行指南](../../handoff/2026-10-17-stockcal-local-run.md)。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将正式计算及其笔记依据保存到PostgreSQL，自动核对后续完整日K的开高低收，并提供逐篇学习建议与可追溯的成功、失败样本。

**Architecture:** 现有Next同源BFF连接独立研究记录接口；Spring JDBC以追加版本保存预测、评价、笔记研究。确定性评分和后台核对共用服务，浏览器继续保存原有本地备份。新语义建议采用独立研究通道。

**Tech Stack:** Next 16.3.3、React 19、TypeScript、Vitest、Playwright；Java 21、Spring Boot 4.1、Jackson 3、JDBC、Flyway、PostgreSQL。复用现有依赖与身份机制。

**Spec:** [已批准设计](../specs/2026-10-16-price-evaluation-and-note-learning-design.md)。用户在2026-10-16回复“可以了”确认设计，随后回复“实施吧”批准执行；采用Native顺序实施与一次独立最终审阅。

## Global Constraints

- 工作目录`/workspace/Sock`；保留全部既有未提交修改。不开工作树、不提交、不推送、不发布。各任务的检查点是本地差异和验证记录，替代通常的提交检查点。
- 不修改原始`notes/`、原标签种子及用户浏览器人工修订。146篇语义研究与271条主张仍为候选；53篇含未检查附件，研究未证明提高准确度。
- 保持日线优先及既有按需下钻；只保存实际参与周期。保持单一所选方法、完整链接1%平均合并、按收盘涨跌幅筛选全部实际价位，不填充数量、不夹到边界。
- 评分定义固定`ohlc-price-closeness-v1`，以实际价为分母严格小于1%。四价接近、范围覆盖、指标误差、交易盈亏分别展示。分钟支撑压力本阶段为未评估。
- 客户端价格保留客户端来源；本阶段不自动采用AI新规律，不增加AI密钥要求。生产鉴权和现有行情选择机制保持原有配置。
- 实施前读取适用技能及`frontend/AGENTS.md`要求的Next文档；涉及React组件时应用React规范。执行命令分别在标注目录运行，不将凭据打印到输出。

## Review Focus

1. **分母、取整与严格边界错误：** 任务1验证有序1%边界、全部价位、空集和掌阅科技固定回放。
2. **事后信息混入前瞻效果：** 任务2、4验证未来柱、每版本首次服务器时间、09:15截止及目标缺日/补发。
3. **追加记录重复计分或丢失修订：** 任务3、5、6验证并发幂等、409、重启、修订、复查故障与默认样本唯一性。
4. **笔记或用户历史被替换：** 任务3、9验证身份、精确旧引用键、原文哈希与引文、人工v2/v3及研究状态分离。
5. **页面显示成功但未保存，或切股后串结果：** 任务7、8、10、11验证真实回执、断网重试、异步竞态、筛选分页和含冻结依据的导出。

---

## Shared Interfaces and Invariants

先在任务1声明以下Java records和等价TypeScript DTO；后续任务直接使用，禁止各层自行解释同名字段。Java公共DTO放在`ScenarioContracts`的嵌套record中；时间使用`Instant`、日期使用`LocalDate`，JSON为ISO字符串，价格运算使用整数分/`BigDecimal`，不使用浮点阈值比较。

| 类型 | 固定约定 |
| --- | --- |
| `SaveForecastRequest` | `snapshot`为原`ScenarioAnalysis`；`noteBindings`保存选用研究UUID及哈希，或完整旧标签版本/引用键。拥有者与接收时间均不由请求指定。 |
| `LegacyNoteKey` | `legacyRecordId, level(document/fragment), sourceHash, tagVersion, channel`；服务端将owner加入查找与唯一键。找不到原版本时为`unresolved`，保留原内嵌证据。 |
| `ForecastRecord` | UUID、客户端ID/版本、前版本UUID、`serverReceivedAt`、原快照、冻结`noteBindings`、规范请求`payloadHash`；重试返回首次保存的相同记录。 |
| `ForecastLevel` | `id, priceCents, groupIds`；仅取冻结`dailyPriceLadder.up/down`中的实际显示价，不用未显示的原始均值替代。 |
| `PriceClosenessResult` | `definitionVersion, levels, targets, totalLevels, closeLevels, levelClosenessRatio, coveredTargets, exactLevels`；每价包括四项误差、全部接近项及最近项。空集比例为null。 |
| `TargetResolution` | `version, state, targetDay, evidence`；state为`pending/target_unverified/verified`。日期证据变化才新增解析版本；不得按评分优劣选日期。 |
| `PriceEvaluation` | 设计要求的版本、目标解析、实际柱及原响应哈希、采集/评价时间、资格理由和评分；待核对/故障状态不伪装成评分。 |
| `EvaluationView` | `latestStatus`与当前有效解析版本的`latestSuccessful`分别返回；无成功为null。历史另由评价历史接口返回。 |
| `StudyImport` | `sourceFile, sourceHash, sourceText, sourceUrl, channel, parentRevisionId, legacyKey?, payload`；AI建议、人工解释及效果状态独立，导入不发布规则。 |
| `LearningFilters` | `symbol, anchorFrom, anchorThrough, method, forecastDefinitionVersion, evaluationDefinitionVersion, directionCandidate, directionConfirmed, noteFile, status, forwardEligible`；方向取日线，日期为基准日，页面明确标注。 |
| `Page<T>` | `items, nextCursor, asOf`；先按owner/全部筛选条件及asOf选择版本，再按`received_at DESC,id DESC`分页。游标绑定查询条件，改变条件重置游标。 |

规范请求哈希采用递归排序对象键、保留数组顺序的UTF-8 JSON；拒绝非有限数。服务端解析所得笔记UUID/状态在首次插入时冻结，不参与客户端请求哈希；相同请求重试不能改为当前最新标签。来源柱哈希覆盖provider、symbol、adjustment=none、day、OHLCV；`fetchedAt`与响应字节哈希另存。供应商接口无原始字节时标注其规范适配响应哈希，不能称原始HTTP哈希。只有任务认领、重试及复查索引等运行元数据可更新；预测、笔记与评价版本的payload、时点及证据不可覆盖。

任务依赖：1 → 2/3/4 → 5 → 6 → 7 → 8/9 → 10 → 11。本阶段推荐单代理在当前会话顺序实施，按任务检查，最后独立审阅。

### Task 1: 冻结跨层DTO与四价评分

**Files — Create:** `backend/src/main/java/com/stockcal/scenario/ScenarioContracts.java`、`backend/src/main/java/com/stockcal/scenario/PriceClosenessEvaluator.java`、`backend/src/test/java/com/stockcal/scenario/PriceClosenessEvaluatorTest.java`、`backend/src/test/resources/scenario/zhangyue-close14-price-closeness.json`、`frontend/src/features/scenario/scenario-record-types.ts`。

**Interfaces:** `PriceClosenessEvaluator.evaluate(List<ForecastLevel> levels, MarketProvider.Candle actual): PriceClosenessResult`。输入来自任务2冻结价位；输出供任务5持久化、任务8展示，不重算预测。

- [x] 先写失败用例`strictThresholdUsesActualDenominator`：P101/A100不通过、P100.99/A100通过、P100/A101通过；完全相同另记exactMatch。验证四项误差和全部接近项，最近项并列时按开/高/低/收固定顺序，不丢弃并列符合项。
- [x] 从现有`research/zhangyue-scenario-v1/price-evaluation-example-2026-10-15.json`制作持久化测试夹具，保留事后回放标记与来源。测试价位30.75/29.75/29.04/28.65/27.69，对29.51/32.91/28.95/29.01应为2/5接近、3/4覆盖、exact=0，高价最近误差约6.5633546%。
- [x] 增加空集、全部未接近、零/负/超范围价格的用例。运行`./gradlew test --tests com.stockcal.scenario.PriceClosenessEvaluatorTest`（backend），确认因缺实现失败，再实现整数比较`abs(P-A)*100 < A`及独立分母统计。
- [x] 运行同一命令至通过；检查DTO字段与上表一致。记录本地差异和实际测试结果，不运行旧离线研究替代产品评分。

### Task 2: 冻结预测校验与可信元数据

**Files — Create:** `backend/src/main/java/com/stockcal/scenario/ScenarioRecordValidator.java`、`backend/src/test/java/com/stockcal/scenario/ScenarioRecordValidatorTest.java`、`backend/src/test/resources/scenario/valid-day-forecast.json`。

**Interfaces:** `validate(SaveForecastRequest request): ValidatedForecast`；输出客户端ID/版本、上一版本号、股票、kind、createdAt/inputAsOf、基准日、方法/定义、规范请求哈希、全部`ForecastLevel`和原请求。服务端时钟在任务5注入。

- [x] 先写`rejectsFutureClosedBarsAndForeignSymbol`、`rejectsChangedMergeOrLadder`、`preservesActualParticipatingPeriods`。夹具从现有真实模式引擎输出构建，不依赖`/tmp`，标为合成/历史测试输入。
- [x] 校验schema、real来源、六位股票、none复权、时间排序、各周期完整柱结束时间不晚于inputAsOf及采集时间；拒绝DEMO、非有限数、重复ID和跨股票引用。观测柱与完整柱分开，不能把盘中观测柱送入正式计算价。
- [x] 校验所选方法及rolling路径、`reference-mean-1pct-v1`完整链接分组/算术平均、日线收盘锚点、涨跌幅过滤及分价取整、全部最终价位与冻结来源一致；不增加预测周期，不宣称验证全部形态识别。旧固定档数v1只作历史展示，不进入当前定义默认统计。
- [x] 运行`./gradlew test --tests com.stockcal.scenario.ScenarioRecordValidatorTest`（backend）确认失败，再实现并运行至通过；保留所用规则/标签原版本和未解析引用，不以最新版本替换。

### Task 3: 三表迁移、不可覆盖仓库及笔记导入

**Files — Create:** `backend/src/main/resources/db/migration/V15__scenario_research_records.sql`、`backend/src/main/resources/db/migration/V16__research_query_visibility.sql`、`backend/src/main/java/com/stockcal/scenario/ScenarioRecordRepository.java`、`backend/src/main/java/com/stockcal/scenario/NoteStudyService.java`、`backend/src/main/java/com/stockcal/scenario/NoteStudyValidator.java`、`backend/src/main/resources/scenario/note-tag-ids.json`、`backend/src/test/java/com/stockcal/scenario/ScenarioRecordPostgresTest.java`、`backend/src/test/java/com/stockcal/scenario/NoteStudyValidatorTest.java`、`backend/src/test/resources/application-scenario-postgres.yml`、`backend/scripts/test-scenario-postgres.sh`。**Modify:** `backend/src/test/resources/schema.sql`，只为既有H2测试补兼容研究表定义。

**Interfaces:** 仓库`save(owner, ValidatedForecast, Instant receivedAt): ForecastRecord`、`findOwned(owner, UUID): Optional<ForecastRecord>`、`appendEvaluation(UUID forecastId, PriceEvaluation): PriceEvaluation`、`findDue(Instant now, int limit): List<UUID>`；`NoteStudyService.importRevision(owner, StudyImport): NoteStudyRevision`及`resolveBindings(owner, bindings): List<FrozenNoteBinding>`。

- [x] 先写真实PostgreSQL测试`concurrentSameRequestReturnsOriginalReceipt`、`sameKeyDifferentPayloadConflicts`、`ownerCannotReadAnotherOwner`、`legacyBindingIncludesLevelAndVersion`。新版本引用同owner、同客户端ID的前版；缺少前版时明确409，不静默重排历史。
- [x] 实现测试脚本：复用安全配置创建本任务随机命名的隔离schema，启用Flyway V1至V16，禁用H2 schema初始化；仅清理该任务schema。测试profile必须断言数据库确为PostgreSQL，凭据缺失明确失败，禁止跳过后报告成功。默认H2测试不执行PG专用测试。
- [x] `bash scripts/test-scenario-postgres.sh --tests com.stockcal.scenario.ScenarioRecordPostgresTest`（backend）确认迁移/仓库缺失失败。按批准设计建三张表、外键、owner/客户端版本唯一键、评价版本及成功评分幂等约束、owner/股票/接收时间与到期任务索引。状态也追加，不修改预测payload。
- [x] 规范请求相同只返回既有UUID及首次接收时间；冲突返回领域409。并发追加评价在短事务内锁定预测行分配版本号，成功唯一约束覆盖同预测、解析版本、实际柱哈希、评分定义；状态重试不改变旧评分。跨owner前版本或研究引用拒绝。
- [x] 从现有taxonomy生成允许标签ID资源并加一致性断言。测试sourceText的UTF-8哈希、逐引文行范围、未知标签、同文件不同sourceHash、document/fragment、v1/v2、人工/AI channel均不串用；精确旧映射缺历史时保留unresolved及内嵌引文。
- [x] 运行`./gradlew test --tests com.stockcal.scenario.NoteStudyValidatorTest`及上述PG命令至通过。记录迁移结果与并发断言；不清理开发数据、不修改既有sync表。

### Task 4: 实际日线、目标解析及盘前资格

**Files — Create:** `backend/src/main/java/com/stockcal/scenario/DailyActualSource.java`、`backend/src/main/java/com/stockcal/scenario/TencentDailyActualSource.java`、`backend/src/main/java/com/stockcal/scenario/TargetResolver.java`、`backend/src/main/java/com/stockcal/scenario/ForwardEligibility.java`、`backend/src/test/java/com/stockcal/scenario/TencentDailyActualSourceTest.java`、`backend/src/test/java/com/stockcal/scenario/TargetResolverTest.java`、`backend/src/test/java/com/stockcal/scenario/ForwardEligibilityTest.java`、`backend/src/test/resources/scenario/tencent-daily.json`。

**Interfaces:** `DailyActualSource.fetch(String symbol): DailyActualSeries`（柱、来源、采集时间及哈希）；`TargetResolver.resolve(ForecastRecord record, List<PriceEvaluation> history, DailyActualSeries actual, Instant now): TargetResolution`；`ForwardEligibility.assess(ForecastRecord, TargetResolution): Eligibility`。所有时间测试使用固定Clock。

- [x] 先写正常、损坏、超时/缺日/乱序响应及不复权/股票错误用例。配置供应商可用时包装既有`MarketProvider`；公开模式仅补腾讯不复权日线，不改全局行情provider或小时/30分钟加载。
- [x] 写`incompleteTodayRemainsPending`：上海时间14:59未结束、15:00及以后完整柱可候选。跨自然日缺口为target_unverified，不凭周末或缺日猜休市；仅有明确日历/停牌/来源证据时确认。
- [x] 写`earlierBackfillAppendsResolutionRevision`：先见16日后补15日，原目标保留历史，新解析基于日期证据；同柱仅fetchedAt变化不改candleHash，OHLCV修订改hash。解析不能查评分选目标。
- [x] 写`auctionCutoffAppliesToEachRevision`：目标日09:14:59.999可满足时间条件，09:15:00及09:25不满足；serverReceivedAt、clientCreatedAt、inputAsOf均严格在前，replay/迟上传旧记录及后续版本各自评估，未知目标不能授予前瞻资格。
- [x] 运行`./gradlew test --tests com.stockcal.scenario.TencentDailyActualSourceTest --tests com.stockcal.scenario.TargetResolverTest --tests com.stockcal.scenario.ForwardEligibilityTest`（backend）确认失败，最小实现后同命令通过。网络测试用固定响应，不将实时行情可用作为单测条件。

### Task 5: 自动核对、重试及七日复查

**Files — Create:** `backend/src/main/java/com/stockcal/scenario/ScenarioRecordService.java`、`backend/src/main/java/com/stockcal/scenario/ScenarioEvaluationService.java`、`backend/src/main/java/com/stockcal/scenario/ScenarioEvaluationJob.java`、`backend/src/main/java/com/stockcal/scenario/ScenarioResearchConfiguration.java`、`backend/src/test/java/com/stockcal/scenario/ScenarioEvaluationServiceTest.java`、`backend/src/test/java/com/stockcal/scenario/ScenarioEvaluationJobPostgresTest.java`。**Modify:** `backend/src/main/resources/application.yml`、`backend/src/test/resources/application.yml`，增加可关闭的研究任务配置，普通测试默认关闭后台定时器。

**Interfaces:** `ScenarioRecordService.save(owner, SaveForecastRequest): ForecastRecord`冻结首次回执及笔记绑定；`ScenarioEvaluationService.evaluate(owner, UUID recordId): EvaluationView`复用目标解析/资格/评分；`ScenarioEvaluationJob.runDue(Instant now): int`供定时器与恢复测试使用，不依赖浏览器。

- [x] 写`pendingAndSourceFailureNeverBecomeMisses`、`correctedCandleAppendsOneNewScore`、`failedRecheckRetainsLastSuccess`、`restartResumesPersistedDueWork`，先用固定Clock/伪行情获得失败证据。
- [x] 保存事务调用任务2/3，不把网络行情放入数据库长事务。待核对扫描默认15分钟，故障退避15/30/60分钟至6小时，参数可配置；调度不持有永久内存队列。多实例竞争通过PostgreSQL短租约/认领字段限制，认领及到期释放不改研究payload。
- [x] 首次成功后7个自然日内每日复查，记录到期时间；相同实际柱不新增成功评价，修订追加。状态追加到评价记录，下一次调度位置持久化到预测的运行索引；7日后保留手动评价能力，不宣称自动发现更晚修订。
- [x] 任务3迁移在预测表同步包含`next_check_at/claim_until/retry_count/first_success_at/recheck_until`运行索引；状态变化仍以评价版本追加，不另增第四张研究表。重复手动/后台请求仍只产生一份对应成功评价，瞬时故障保留最后成功及故障提示。失效租约可恢复，不依赖删除历史状态。
- [x] 运行`./gradlew test --tests com.stockcal.scenario.ScenarioEvaluationServiceTest`和`bash scripts/test-scenario-postgres.sh --tests com.stockcal.scenario.ScenarioEvaluationJobPostgresTest`（backend）至通过；以两个应用上下文/进程重建证明恢复，不能只重建内存对象冒充持久化重启。

### Task 6: 身份隔离的研究接口与学习查询

**Files — Create:** `backend/src/main/java/com/stockcal/scenario/ResearchIdentity.java`、`backend/src/main/java/com/stockcal/scenario/ScenarioRecordController.java`、`backend/src/main/java/com/stockcal/scenario/NoteStudyController.java`、`backend/src/main/java/com/stockcal/scenario/LearningSampleController.java`、`backend/src/test/java/com/stockcal/scenario/ScenarioResearchApiTest.java`、`backend/src/test/java/com/stockcal/scenario/LearningSamplePostgresTest.java`。**Modify:** 任务3的`ScenarioRecordRepository.java`，增加分页/关联查询。

**Interfaces:** 实现设计列出的8组`/api/v1/scenario-records`、`note-studies`、`learning-samples`路由；列表返回`Page<T>`，评价动作返回`EvaluationView`，单条记录返回完整冻结依据。`listSamples(owner, LearningFilters, cursor, limit): Page<LearningSample>`，默认limit=25、上限100。

- [x] 写鉴权开启时匿名拒绝、合法Principal、开发X-Client-Id、缺失/过长clientId、跨身份读/评价/笔记引用拒绝测试。复用现有规则，不接受body指定owner；已存在外部owner的ID统一不可读取。
- [x] 写`latestSuccessfulActiveTargetOnly`、`failedRecheckDoesNotEraseSuccess`、`filterBeforePagination`、`cursorFreezesCohortAsOf`。默认每预测/当前有效目标解析/评分定义只取最新成功，旧目标和旧成功不重复计数，失败预测及未核对记录仍可筛选查看。
- [x] 实现参数化SQL；需要查询的趋势/笔记引用可读取冻结JSON文本的PostgreSQL JSON投影，禁止取一页后内存筛选。游标保留asOf边界并在该时点选择解析/成功版本，绑定筛选条件；无资格和target_unverified记录默认不进入前瞻汇总，但保留在明细与对应筛选。
- [x] 运行`./gradlew test --tests com.stockcal.scenario.ScenarioResearchApiTest`及`bash scripts/test-scenario-postgres.sh --tests com.stockcal.scenario.LearningSamplePostgresTest`（backend）确认先失败、后通过；验证400/401/404/409与待核对200，缺行情不返回预测失败。

### Task 7: 独立记录BFF与浏览器传输

**Files — Create:** `frontend/src/lib/api/research-backend-client.ts`、`frontend/src/lib/api/research-backend-client.test.ts`、`frontend/src/features/scenario/scenario-api.ts`、`frontend/src/features/scenario/scenario-api.test.ts`、`frontend/app/api/scenario-records/route.ts`、`frontend/app/api/scenario-records/[id]/route.ts`、`frontend/app/api/scenario-records/[id]/evaluate/route.ts`、`frontend/app/api/scenario-records/[id]/evaluations/route.ts`、`frontend/app/api/note-studies/route.ts`、`frontend/app/api/learning-samples/route.ts`、`frontend/app/api/scenario-records/route.test.ts`。**Modify:** `frontend/.env.example`。

**Interfaces:** 服务器`researchRequest<T>(path, init, identityHeaders): Promise<T>`只访问已配置研究后端；浏览器`saveForecast(request, signal?)`、`evaluateForecast(id, signal?)`、`listLearningSamples(filters, cursor?, signal?)`及列表/详情/研究导入方法使用任务1 DTO。

- [x] 先读本地Next 16 Route Handlers、environment variables文档。写独立地址/旧地址回退、未配置、409/401透传、损坏JSON=400、身份头转发及AbortSignal测试。
- [x] 配置`STOCKCAL_RECORDS_API_BASE_URL`为server-only，空时回退`STOCKCAL_API_BASE_URL`；两者都空返回明确503未连接。本地保存和行情继续可用。复用现有浏览器clientId/Authorization，不在客户端暴露后端地址或凭据。
- [x] Next动态路由await Promise params；fetch用no-store，限制路径为设计列出的研究资源，保留查询参数和后端状态，不接受客户端自选上游URL。研究地址配置不能改变公开行情分支。
- [x] 运行`npm test -- src/lib/api/research-backend-client.test.ts src/features/scenario/scenario-api.test.ts app/api/scenario-records/route.test.ts`（frontend）确认失败后实现并通过；补全其余路由的薄适配，复用已测传输。

### Task 8: 保存回执、逐价核对和冻结导出

**Files — Create:** `frontend/src/features/scenario/use-scenario-cloud-records.ts`、`frontend/src/features/scenario/use-scenario-cloud-records.test.tsx`、`frontend/src/features/scenario/scenario-price-evaluation.tsx`、`frontend/src/features/scenario/scenario-price-evaluation.test.tsx`、`frontend/src/features/scenario/scenario-research-export.ts`、`frontend/src/features/scenario/scenario-research-export.test.ts`。**Modify:** `frontend/src/features/scenario/scenario-analysis-panel.tsx`、`frontend/src/features/scenario/scenario-analysis-panel.test.tsx`、`frontend/src/features/scenario/scenario-analysis-panel.css`。

**Interfaces:** `useScenarioCloudRecords({symbol, localRecords})`返回按客户端ID/版本索引的receipt、状态、`saveFrozen(snapshot, noteBindings)`、`retry(id,version)`、评价及历史加载；`buildResearchExport(record, evaluationView, evaluationHistory): ResearchExport`只使用冻结版本，不计算新预测价。

- [x] 先写本地成功/后端失败、重复点击、重试相同版本、409、刷新恢复及切股/切身份后的迟到响应测试。浏览器回执使用独立`stockcal.scenario-cloud.v1`并按当前身份隔离；身份变化使旧请求失效，不能自动上传前一身份的待重试项，不把令牌写入回执/导出。失败重试提交原快照，不能把新草稿换进旧ID/版本。
- [x] 保留现有本地保存校验及备份；只有用户“保存分析”生成版本并上传。依次显示仅本地/待同步/已入库/失败可重试，已入库必须有服务器UUID及serverReceivedAt；后端确认前不能显示成功。
- [x] 新面板展示完整目标日/时点资格、实际四价、每价四项误差/全部接近项、未接近价与未覆盖目标、空集null及源故障。明确2/5与3/4的不同意义；盘中支撑压力标未评估，已有范围/指标评价保留各自定义。
- [x] 导出原预测、指定评价ID/历史、目标解析证据、实际柱/采集时间/来源/哈希、冻结笔记研究版本/原文与哈希。未解析旧引用及未取得资料明确缺失，不从最新标签补齐；下载后仍能独立核对已具备的证据。
- [x] 运行`npm test -- src/features/scenario/use-scenario-cloud-records.test.tsx src/features/scenario/scenario-price-evaluation.test.tsx src/features/scenario/scenario-research-export.test.ts src/features/scenario/scenario-analysis-panel.test.tsx`（frontend）确认先失败后通过。额外断言保存/评分不触发新的小时或30分钟预测请求。

### Task 9: 146篇逐篇学习建议及所选依据

**Files — Create:** `frontend/scripts/build-note-study.mjs`、`frontend/src/server/note-study-seed.json`、`frontend/src/lib/knowledge/note-study-proposals.ts`、`frontend/src/lib/knowledge/note-study-proposals.test.ts`、`frontend/app/api/note-study-proposals/route.ts`、`frontend/app/api/note-study-proposals/route.test.ts`、`frontend/src/features/knowledge/note-study-selections.ts`、`frontend/src/features/knowledge/note-study-selections.test.ts`、`frontend/src/features/knowledge/note-study-workbench.tsx`、`frontend/src/features/knowledge/note-study-workbench.test.tsx`。**Modify:** `frontend/package.json`、`frontend/src/features/knowledge/note-tag-workbench.tsx`、`frontend/src/features/knowledge/note-tag-workbench.test.tsx`、`frontend/src/features/knowledge/note-tag-workbench.css`、`frontend/src/features/scenario/scenario-analysis-panel.tsx`。

**Interfaces:** 服务器`listProposals()`返回轻量索引/计数，`getProposal(file)`返回该篇冻结语义记录及原文；`/api/note-study-proposals?file=...`按白名单返回。研究导入通过既有任务7的POST note-studies。`loadStudySelections(identityScope)`/`saveStudySelection(identityScope, revision)`保存已入库UUID/sourceHash；情景面板正式保存时读取并冻结到noteBindings。

- [x] 先写146篇覆盖、引文/哈希完整、271条主张、附件未读状态以及标签v2/v3不受影响的用例。`node scripts/build-note-study.mjs --check`校验研究产物与当前notes哈希、taxonomy及服务器资源，过期明确失败，不改写原研究或原标签种子。
- [x] 生成器只读取`research/zhangyue-scenario-v1/note-study-2026-10-16/`和notes，生成服务器专用资产，包含对应原文和来源哈希；默认生成与--check分开。该大文件只由服务器模块导入，列表轻量、详情按篇加载，不进入初始浏览器bundle。
- [x] 在现有笔记工作台增加懒加载“逐篇学习建议”，展示覆盖进度、AI候选标签与当前用户标签差异、九种计算角色、主张/输入/条件/缺定义、原文行号、附件及用户规则冲突。BOLL期别与葛阶段分开，文档标签不能赋值股票当前阶段。
- [x] “保存研究建议”调用独立研究channel，收到后端确认才显示入库；“选为后续分析依据”仅记录解释版本，不启用价格公式。选择项用按身份隔离的`stockcal.note-study-selections.v1`，现有原始/人工标签不变。旧引用导入按完整键/原版本；仅有摘录而无可验证源历史时显示unresolved。
- [x] 运行`node scripts/build-note-study.mjs --check`与`npm test -- src/lib/knowledge/note-study-proposals.test.ts app/api/note-study-proposals/route.test.ts src/features/knowledge/note-study-selections.test.ts src/features/knowledge/note-study-workbench.test.tsx src/features/knowledge/note-tag-workbench.test.tsx src/features/scenario/scenario-analysis-panel.test.tsx`（frontend），确认缺实现失败后生成/实现并通过。读取异常或导入失败可重试，不写成效果验证通过。

### Task 10: 学习样本视图及版本筛选

**Files — Create:** `frontend/src/features/knowledge/learning-samples-view.tsx`、`frontend/src/features/knowledge/learning-samples-view.test.tsx`。**Modify:** `frontend/app/knowledge/page.tsx`、`frontend/src/features/knowledge/experience-workbench.tsx`、`frontend/src/features/knowledge/experience-workbench.test.tsx`、`frontend/src/features/knowledge/experience-workbench.css`。

**Interfaces:** `/knowledge?view=samples`懒加载`LearningSamplesView`，调用`listLearningSamples`，详情复用只读预测/评价及研究导出；URL与popstate继续支持现有library/notes/backtest。

- [x] 先写候选方向与人工确认方向独立、全部筛选参数、切筛选重置游标、后退恢复、跨请求迟到响应、空结果/故障及未确认葛阶段用例。包含接近与未接近价格的记录都必须可见，不生成“胜率”。
- [x] 接入股票、基准日、方法/定义版本、日线候选/确认趋势、笔记、评价状态、前瞻资格筛选。默认汇总说明仅纳入已验证目标且前瞻有效的当前成功评价，事后回放/缺资料仍可查看，不默默删除。
- [x] 每行展示冻结采用周期、方法、全部价位接近数及四价覆盖数、最新故障/最后成功状态；打开详情与导出都绑定具体记录和评价ID，不能打开当前草稿冒充历史。
- [x] 运行`npm test -- src/features/knowledge/learning-samples-view.test.tsx src/features/knowledge/experience-workbench.test.tsx`（frontend）确认失败、实现至通过；再次确认原笔记和回测入口可用。

### Task 11: 真实数据库、桌面/手机与回归交付

**Files — Create:** `frontend/e2e/scenario-research.spec.ts`、`frontend/e2e/fixtures/scenario-research.json`、`research/zhangyue-scenario-v1/price-evaluation-implementation-validation.md`。**Modify:** `README.md`，补充开发记录服务地址、调度开关、运行/排错及证据链接。

**Interfaces:** 无新增产品接口。固定行情夹具证明业务边界；另以开发后端/隔离PostgreSQL走真实BFF保存、重启读取和评价，报告清楚哪些检查使用固定响应、哪些使用真实服务。

- [x] 先写桌面/手机用例：保存/重复保存、断网仅本地及恢复重试、逐价四价核对、未覆盖高点、逐篇建议/人工v3保留、筛选/分页、下载导出。用可控时间和固定行情，不能等真实交易时钟；重启测试保留原服务器回执。
- [x] 先运行`npm run test:e2e -- e2e/scenario-research.spec.ts`（frontend）得到缺功能失败；完善后在desktop/mobile两项目通过。有Browser插件则优先使用；不可用时记录原因，使用现有Playwright/已安装Chromium，不为测试擅自升级依赖。
- [x] 运行`bash scripts/test-scenario-postgres.sh`（backend）覆盖新PG测试，运行`./gradlew test`覆盖后端正常套件；前端运行`npm test`、`npm run lint`、`npm run build`及相关已有`scenario-analysis.spec.ts`、`note-tags.spec.ts`。只因新修改/失败/未解决风险补跑，不反复重复全量测试。
- [x] 运行`python research/zhangyue-scenario-v1/note-study-2026-10-16/verify_records.py`（仓库根目录，禁止--merge），生成器--check及`git diff --check`；确认原notes/标签种子哈希与用户原有修订、按需周期请求规则保持。
- [x] 验证新Next配置实际指向开发后端且公开行情仍可用，测试09:15边界、先16后15、OHLC修订、同柱刷新、七日复查边界、故障恢复；将实际命令、计数、PG迁移/重启证据、页面截图和未解决限制写入验证记录。不能沿用之前573项测试计数或把历史回放称事前成功。
- [x] 根据执行方式完成独立最终审阅，处理实质问题并针对性复验。检查无凭据/临时文件进入差异；交付访问入口与验证结果。保持所有修改未提交，不部署、不自动启用候选公式。

## Plan Review and Execution Handoff

计划自检覆盖：设计各条验收均有所属任务；DTO、身份与时间来源只有一套定义；严格1%、09:15、缺日修订、七日复查、精确笔记版本和前端失败状态都有专门用例。实施过程中若真实数据结构要求改变上述契约，先记录具体证据并更新受影响任务，不默默扩大范围。

已按 **Native：当前会话顺序实施，结束后独立审阅** 执行。最终独立审阅发现两项Important：评价完成时点与查询可见性、缺失引文绕过校验；均补充RED→GREEN回归后修复。V16为分页游标补充PostgreSQL事务可见性，排除查询开始时尚未提交的记录，不改变评分标准。验收与限制见 [实现验收记录](../../../research/zhangyue-scenario-v1/price-evaluation-implementation-validation.md)。原工作区和本轮修改全部保持未提交，未发布应用。
