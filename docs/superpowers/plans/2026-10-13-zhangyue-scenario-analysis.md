# 掌阅科技多周期情景分析 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 以掌阅科技（603533）为首个真实行情案例，按趋势→葛阶段→盈利模式→前三后三参考位→交易原则组织分析；大阳线后按日线→1小时→30分钟逐级确认，并滚动计算各周期MA/BOLL。
**Architecture:** 新增独立的 `frontend/src/features/scenario/`，以纯函数处理时间、指标、状态和原则，轻量hook加载多周期行情，独立快照账本保存依据；在现有研究工作台接入分析面板与图表周期联动。
**Tech Stack:** Next.js 16.3.3、React 19、TypeScript、现有腾讯公开行情接口、Vitest、Testing Library、Playwright；不增加依赖。
**Spec:** [已确认方向的设计](../specs/2026-10-13-zhangyue-scenario-analysis-design.md)

状态：2026-10-15已完成8项任务和独立审查修正；检查点保留在当前工作区。本地验证、真实行情与已知限制见 [首版证据](../../../research/zhangyue-scenario-v1/README.md)。

## Global Constraints

- 原始 `notes/`、已完成的标签目录与旧新易盛研究保留；标签“已核对”不代表形态条件或收益已验证。分析引用固定的笔记版本，不改标签解释当前涨跌。
- 日、60m、30m均用真实的同口径不复权行情，独立计算指标。共享明确的 `asOf`，完整K线用于确认；未完成K线仅展示观察信息。
- 不设未经确认的大阳线百分比、葛阶段修正系数或模式概率。大阳线由人工确认开启下钻；缺失的形态定义返回待确认。
- 默认未来第1/2/3根相对最后完整K线；需要“从今日起明后第三天”时可显式选第2/3/4根。参数目标时间与当前覆盖窗口分别保存。
- 日线背景不会被30分钟反弹覆盖；风险底线包含周期，不把小时MA5叫“五日线”。
- 使用现有 `movingAverage`、`bollinger`、`canonicalPeriodTime` 与 `BrowserMarketClient.series`。不替换旧 `StockAnalysis` 或后端价格预测，不接自动交易或账户同步。
- 用户选择603533通过已有 `/?symbol=603533` 入口；不修改全站默认股票。示例仍用DEMO并隔离真实分析账本。
- 编码前阅读 `frontend/AGENTS.md` 指定的相关Next文档；沿用当前隔离云目录，不另建worktree。
- 命令均在 `/workspace/Sock/frontend` 执行，另标注的除外。每任务按红→绿→检查差异推进；只有新增修改才重复相应验证。
- 任务检查点只包含本任务文件。若git写入可用，逐任务提交；当前git受限时保留可评审差异，不混入此前标签工作，不为提交扩大权限。

## Review Focus

| 易错输入／失败 | 必须证明的行为 | 所属任务 |
| --- | --- | --- |
| 盘中日线、小时尾柱、未来K线混入 | 正式输入只含已结束K线；修改未来数据不改变旧结果 | 1、3、5 |
| 周末、休市、午休与盘前原点 | 日／小时／30m按交易时段编号；日历不足显示未知日期 | 1、2 |
| 大阳线、常数窗口、非法BOLL或收盘路径 | 滚动结果可复算；不足与无效结果有原因，不交换上下轨 | 2 |
| 30m失败、换股后的旧请求返回 | 保留上层结果，拒绝旧股票响应，展示缺失确认层 | 6、7 |
| 同名不同语境的规则、小周期风险线 | 不误合并例外，不猜缺失条件，不覆盖日线底线 | 3、4、7 |

---

## Task 1: 定义数据契约、完整K线与交易时间边界

**Files:** 新增 `scenario-types.ts`、`scenario-inputs.ts`、`scenario-calendar.ts`、`scenario-inputs.test.ts`、`scenario-calendar.test.ts`、`scenario-test-fixtures.ts`，均在 `src/features/scenario/`。
**Consumes:** 现有 `Candle`、`ChartSeries`、`MarketSnapshot['source']`、`canonicalPeriodTime`。
**Produces:** 后续任务共用的契约，以及 `normalizeScenarioSeries(series: ChartSeries, asOf: string): PeriodInput`、`futureBarTargets(period: AnalysisPeriod, originBarKey: string, horizons: Horizon[], calendar: TradingCalendar | null): BarTarget[]`。

契约中的字符串时间必须是带时区ISO；日线barKey为日期，分钟barKey为上海时区区间结束时间。缺项使用null并带issue，禁止用0代替价格。

```ts
type AnalysisPeriod = 'day' | '60m' | '30m'
type Horizon = 1 | 2 | 3 | 4
type Indicator = 'ma5' | 'ma10' | 'ma20' | 'bollUpper' | 'bollMiddle' | 'bollLower'
type TradingCalendar = { fromDay: string; throughDay: string; tradingDays: string[]; sourceUrl: string; verifiedAt: string }
type PeriodInput = { symbol: string; period: AnalysisPeriod; asOf: string; adjustment: 'none';
  source: MarketSnapshot['source']; closed: Candle[]; observed: Candle[]; lastClosedAt: string | null; issues: string[] }
type AnalysisInput = { symbol: string; asOf: string; sourceMode: 'real' | 'demo';
  calendar: TradingCalendar | null; periods: Partial<Record<AnalysisPeriod, PeriodInput>>;
  loadIssues: Partial<Record<AnalysisPeriod, string[]>> }
type BarTarget = { horizon: Horizon; barKey: string | null; endAt: string | null; issues: string[] }
type ExecutionWindow = { period: AnalysisPeriod; startAt: string; endAt: string }
type EvidenceRef = { recordId: string; tagVersion: number; sourceHash: string; sourceUrl: string;
  startLine: number; endLine: number; quote: string }
type CloseScenario = { id: string; symbol: string; period: AnalysisPeriod; originBarKey: string;
  kind: 'base' | 'continuation' | 'pullback';
  closes: number[]; condition: string; selectedAt: string; evidence: EvidenceRef[] }
type PriceReference = { id: string; period: AnalysisPeriod; indicator: Indicator;
  method: 'average_delta' | 'last_delta' | 'rolling_close'; scenarioId: string | null;
  originBarKey: string; originEndAt: string; asOf: string; target: BarTarget;
  executionWindow: ExecutionWindow | null; value: number | null; valid: boolean; issues: string[] }
```

- [x] 添加失败测试：`daily_bar_stays_observed_before_1500`、`minute_bucket_end_controls_completeness`、`future_mutations_do_not_change_closed_history`、`invalid_ohlc_does_not_compress_history`。例如asOf为2026-10-12 14:15 +08:00，日线当日未完成，60m最多确认14:00尾柱；15:00柱不参与指标。
- [x] 添加日历失败测试：固定测试日历含10月9、12、13、14、15日；日线原点9日的1/2/3目标为12/13/14日；12日11:30的60m目标为14:00、15:00、13日10:30，30m目标为13:30、14:00、14:30。另用明确标注的虚构休市日检查跳过，不声称测试日历来自交易所。
- [x] 运行 `npm test -- src/features/scenario/scenario-inputs.test.ts src/features/scenario/scenario-calendar.test.ts`，确认因模块缺失或断言不满足失败。
- [x] 实现合法OHLC、有限正价格、非负量、周期／股票／复权校验；以asOf及来源采集时间的较早者确定截止。日线结束时间15:00，分钟用标准区间终点；不使用字段endTime中的盘中采样时间提前确认整柱。
- [x] 重复同键冲突、非法柱或已知缺柱均报告问题，不静默删除后拼接连续窗口。完整指标仅使用缺口后的连续有效尾段；未知是否缺柱也保留来源限制。
- [x] 实现有覆盖区间的日历与固定A股时段枚举。日历为空或越界时仍返回各horizon，目标日期为null；不将工作日等同交易日。将所有fixture标为合成测试数据。
- [x] 重跑上述测试至通过，检查本任务差异并保存检查点。

## Task 2: 实现常规外推、大阳线情景滚动与价位合并

**Files:** 新增 `scenario-calculator.ts`、`scenario-calculator.test.ts`、`scenario-levels.ts`、`scenario-levels.test.ts`。
**Consumes:** Task 1契约与现有 `chart-math.ts` 的MA、BOLL总体标准差实现。
**Produces:** `computeReferences(input: AnalysisInput, options: { period: AnalysisPeriod; method: PriceReference['method']; horizons: Horizon[]; scenario?: CloseScenario; executionWindow: ExecutionWindow | null }): PriceReference[]`；
`createFlatScenario(input: PeriodInput): CloseScenario`、`mergeReferenceLevels(refs: PriceReference[], tolerance?: number): MergedLevel[]`，其中 `MergedLevel={id:string; value:number; references:PriceReference[]}`。

- [x] 编写失败测试：`average_delta_uses_last_three_indicator_values`、`large_bull_flat_path_rolls_ma_and_boll`、`twenty_bars_allow_rolling_but_not_three_boll_origins`、`invalid_extrapolated_boll_is_flagged`、`constant_prices_have_zero_bandwidth`、`scenario_origin_and_period_must_match`。
- [x] 将下列验算放入测试，fixture为此前19根收盘10、最新收盘11；`valueAt(refs, indicator, horizon)`是本测试文件内的查找助手，不新增生产接口。

```ts
const shockOrigin = shockInput.periods.day!.closed.at(-1)!.day
const refs = computeReferences(shockInput, {
  period: 'day', method: 'rolling_close', horizons: [1, 2, 3],
  scenario: { id: 'flat', symbol: '603533', period: 'day', originBarKey: shockOrigin,
    kind: 'base', closes: [11, 11, 11],
    condition: '保持原点收盘价', selectedAt: shockInput.asOf, evidence: [] },
  executionWindow: null,
})
expect([1, 2, 3].map(h => valueAt(refs, 'ma5', h))).toEqual([10.4, 10.6, 10.8])
expect(valueAt(refs, 'bollUpper', 1)).toBeCloseTo(10.7, 10)
expect(valueAt(refs, 'bollUpper', 2)).toBeCloseTo(10.864142842854285, 10)
expect(valueAt(refs, 'bollUpper', 3)).toBeCloseTo(11, 10)
```

- [x] 添加 `preopen_targets_from_today_use_horizons_2_3_4` 与hour／30m相同路径但独立周期标签测试；平均增量MA5对照为10.30/10.40/10.50。20根输入的平均增量BOLL缺少前两次窗口，返回不足，不复用当前值补齐。
- [x] 添加合并失败测试：10.000、10.009、10.018在0.001容差下前两项可合并，三项不可链式合并；日／小时同价保留双方来源，重复id不重复计数。
- [x] 运行 `npm test -- src/features/scenario/scenario-calculator.test.ts src/features/scenario/scenario-levels.test.ts`，确认失败。
- [x] 实现三点平均增量、最近一天增量对照，以及逐根更新收盘窗口的情景重算。每根同一窗口计算MA5/10/20和BOLL20/2，不按大阳线前三天均增量继续滚动BOLL。
- [x] 路径长度须覆盖最大horizon，所有收盘有限且大于零；createFlatScenario返回4个所属周期原点收盘价，覆盖1/2/3与2/3/4两种选择。延续／回撤只接收明确条件路径，校验股票、周期、原点和选择时点，错周期路径拒绝；不自动填涨跌百分比或概率。缺少延续／回撤条件时只展示基准与缺项。
- [x] BOLL任一轨无效或次序颠倒时标记该组无效，保留诊断，不交换轨道。合法结果按两价均值作分母、0.001阈值、确定性完整链接分组；代表值取中位数。
- [x] 重跑上述测试至通过，核对各horizon的来源与目标时间，保存检查点。

## Task 3: 分开记录趋势、葛事件和盈利模式

**Files:** 新增 `scenario-state.ts`、`scenario-state.test.ts`，扩展 `scenario-types.ts`。
**Consumes:** 完整 `PeriodInput`、指标序列、人工确认信息；原文引用来自已有标签目录。
**Produces:** `derivePeriodState(input: PeriodInput, annotations: AnalysisAnnotations, kind: 'live' | 'replay'): PeriodState`、`matchModeCandidates(states: Partial<Record<AnalysisPeriod, PeriodState>>, annotations: AnalysisAnnotations): ModeCandidate[]`。

新增类型：`TrendDirection='rising'|'falling'|'sideways'|'unknown'`，`RiseStyle='climbing'|'surging'|'unknown'`；`PeriodState`含period、客观facts、方向候选、形态候选、确认状态、葛语境／起点／stage／重置历史、缺项及证据。
`AnalysisAnnotations`含各周期人工趋势确认、大阳线确认、葛事件列表、选择的模式与模式周期、照镜子的预选参考线和突破／回抽事件、箱体边界、选定底线、持仓状态、停用规则及原因，以及有来源的价格不连续事件标记。每次确认带barKey、eventAt、confirmedAt、理由；枚举模式为 `trend_climb|mirror_retest|down_rebound|range`。持仓状态仅为 `flat|held|unknown`，镜子参考线须保存selectedAt和原始指标／价位。

- [x] 添加失败测试：`granville_requires_anchor`、`up_and_down_anchors_have_separate_context`、`reset_starts_stage_one`、`daily_downtrend_survives_30m_rebound`、`mirror_line_must_be_selected_before_break`、`future_confirmation_cannot_change_prior_state`、`known_discontinuity_blocks_cross_event_indicators`。
- [x] 固定验收值：日线9日起点=葛一，12日=葛二；小时4根不增加日线stage；13日确认新起点后=葛一，旧起点仍在历史。无起点时stage=null。
- [x] 运行 `npm test -- src/features/scenario/scenario-state.test.ts`，确认失败。
- [x] 输出MA位置与斜率、BOLL方向／带宽、乖离、实体／影线、量能及高低点变化等可复算facts。零均线差、零波幅不除零。未定义横盘窗口、沿线容差或大阳幅度时保留缺项，人工确认前不称已识别成功。
- [x] 葛计数从同周期完整起点柱记1，每根有效柱推进；语境与重置单独保存。完整历史不足以涵盖起点时不推算stage。
- [x] 照镜子必须满足参考线选择≤突破／跌破≤回抽≤asOf的事件顺序，分别展示角色互换、成功、失败、转强候选；缺少事件或容差只输出待确认。没有事前选线记录时不补造selectedAt。箱体模式必须先提供已确认边界。
- [x] 区分事件时间与实际确认时间：live的eventAt和confirmedAt均须≤asOf；replay允许事后人工补标，但eventAt仍≤asOf，并在结果保留confirmedAt与replay标记。旧快照不会被新确认更新；事后补选镜子参考线不视为事前选线。
- [x] 人工大阳线确认仅启用下钻和情景候选，不意味着上涨继续。分别显示日／小时／30m冲突；模式候选保留缺失条件和引用。
- [x] 重跑测试至通过，保存检查点。

## Task 4: 按模式与周期选择原则，生成风险参考

**Files:** 新增 `scenario-rule-registry.ts`、`scenario-rules.ts`、`scenario-rules.test.ts`、`scenario-engine.ts`、`scenario-engine.test.ts`，扩展类型。
**Consumes:** Task 1–3结果、冻结的 `NoteTagRecord` 版本；可复用 `evaluateRuleConditions` 与null事实机制。
**Produces:** `buildScenarioRuleRegistry(records: NoteTagRecord[]): ScenarioRule[]`、`evaluateScenarioRules(input: AnalysisInput, states: Partial<Record<AnalysisPeriod, PeriodState>>, annotations: AnalysisAnnotations, registry: ScenarioRule[]): {rules: RuleApplication[]; risk: RiskReference[]; entryBlocked: boolean}`；
`buildScenarioAnalysis(input: AnalysisInput, annotations: AnalysisAnnotations, options: {id:string; version:number; previousVersion?:number; createdAt:string; kind:'live'|'replay'; registry:ScenarioRule[]; scenarios:CloseScenario[]; horizons:Horizon[]; executionWindow:ExecutionWindow|null}): ScenarioAnalysis`。

`ScenarioRule`至少包含id、version、definitionVersion、mode、period、action、conditions、exceptions、semanticKey、evidence及未定义条件列表；明确默认适用持仓状态，不把研究解释当作原文。`RuleApplication`状态固定为 `adopted|not_applicable|insufficient|duplicate|manual_disabled`，保留原因、条件、版本与全部EvidenceRef。
`RiskReference`保存周期、规则id、指标／参考线、当前值、触发条件，kind为 `price|dynamic_line|deadline|condition`。
`ScenarioAnalysis`含schemaVersion=1、definitionVersion、id／版本链、kind、createdAt、input、annotations、states、modeCandidates、原始references、mergedLevels、rules、risk、entryBlocked。

初始注册表只整理本轮已引用的条目，语义分支单独注册：

| 固定片段id | 用途与适用约束 |
| --- | --- |
| `fragment:买股原则2.md:b3-r01`、`b3-r03`（同文件前缀） | 日MA20／下行MA5、MA10的新参与风险过滤；明确标注收盘确认的研究定义 |
| `fragment:买股原则2.md:b3-r10`、`b3-r11`（同文件前缀） | 攀升与飙升分开；摸线三期、双高等条件未知时insufficient |
| `fragment:盈利模式.md:b1-r06`、`b1-r03`、`b1-r21`（同文件前缀） | 沿底线持有、下跌反抽压力、照镜子；不共用一个退出规则 |
| `fragment:照镜子.md:b3-r25` | 角色互换来源；不是可直接执行的买卖阈值 |
| `fragment:格兰碧.md:b3-r06`、`fragment:格兰碧_1.md:b2-r11` | 分别保留下跌／上涨起点原文，不互换语境 |

- [x] 添加失败测试：`tag_review_does_not_define_rule_conditions`、`missing_phase_does_not_match_surge_exit`、`same_words_different_exceptions_are_not_duplicates`、`30m_ma5_cannot_replace_daily_stop`、`flat_position_gets_entry_filter_without_fake_profit`。
- [x] 加入固定冲突：日收盘低于日MA20但30m上涨→日风险过滤仍存在；选择日MA5=10.20底线、30mMA5=10.80→风险参考仍指day/ma5/10.20。
- [x] 运行 `npm test -- src/features/scenario/scenario-rules.test.ts src/features/scenario/scenario-engine.test.ts`，确认失败。
- [x] 注册表从按需加载后冻结的NoteTagRecord解析原文hash、标签版本、行号和研究定义版本，通过options.registry传入纯计算引擎；缺失片段或阈值的分支留为insufficient。只有已有明确定义的事实可填入旧规则事实，摸线phase不从葛stage猜测。
- [x] 仅在条件、模式、周期、动作、例外均相同的显式语义键下合并重复引用；人工停用要求原因。输入的相关规则逐条留下本次状态。
- [x] 依次构建状态→模式→参考位→规则／风险结果。每个可用周期分别生成平均增量、最近增量对照和平价基准，显式情景仅应用到匹配的股票／周期／原点。已标记价格不连续时，正式指标仅用事件后的连续柱，原始快照仍保留完整输入与原因，不把除权标记解释为暴跌。
- [x] 风险只引用模式确认的周期；时间退出保留期限、动态线保留动态条件。无成本与数量不计算盈利额，不补仓位建议。
- [x] 重跑测试至通过，保存检查点。

## Task 5: 保存不可覆盖的分析快照，区分参考位覆盖与预测误差

**Files:** 新增 `scenario-ledger.ts`、`scenario-ledger.test.ts`、`scenario-evaluation.ts`、`scenario-evaluation.test.ts`。
**Consumes:** 完整 `ScenarioAnalysis` 与实际窗口K线。
**Produces:** `parseScenarioLedger(raw: string | null): ScenarioAnalysis[]`、`appendScenarioSnapshot(records: ScenarioAnalysis[], next: ScenarioAnalysis): ScenarioAnalysis[]`；
`evaluateRangeCoverage(snapshot: ScenarioAnalysis, actual: PeriodInput, window: ExecutionWindow): CoverageResult`、`evaluateIndicatorError(snapshot: ScenarioAnalysis, actual: PeriodInput): IndicatorErrorResult`。
`CoverageResult`含eligible、issues、逐位covered、coveredCount、anyCovered；`IndicatorErrorResult`逐位记录referenceId、actualValue、absoluteError、relativeError、状态与issues。交易净收益本版不计算。

- [x] 添加失败测试：`append_preserves_old_input_and_versions`、`damaged_ledger_is_not_overwritten`、`demo_cannot_enter_real_ledger`、`plan_after_window_start_is_ineligible`、`daily_range_cannot_evaluate_partial_day`、`actual_indicator_uses_target_bar_not_latest_bar`、`missing_target_is_not_zero_error`。
- [x] 固定覆盖测试：窗口开始前保存的日线参考10.40/10.60/10.80，实际日范围10.35–10.65→前两项覆盖、第三项未覆盖；第二项即使属于未来第2根，也可在当前窗口覆盖。计算后才回放的历史案例标replay，不当作当时实际发布的计划。
- [x] 运行 `npm test -- src/features/scenario/scenario-ledger.test.ts src/features/scenario/scenario-evaluation.test.ts`，确认失败。
- [x] 使用独立键 `stockcal.scenario-analysis.v1`；验证股票、完整输入、类型、版本链和时间关系。追加深拷贝记录；同id版本冲突拒绝，原记录不变。不把源标签localStorage写入分析账本。
- [x] 只对真实live计划且asOf、createdAt均早于执行窗口开始的记录统计实盘前置计划覆盖。actual须同股票、同价格口径，K线范围足以覆盖窗口且不包含窗口外高低点；缺项返回不可评估。逐位统计使用原始references，不用合并代表价替代原价。
- [x] 在真实窗口结束后再评价完整窗口；盘中显示观察状态而不提前判未覆盖。只称“价格范围覆盖”，不根据OHLC推断触发先后／成交收益。
- [x] 指标误差使用同股票／口径的完整实际历史重算目标barKey的MA/BOLL；未知目标日期或目标未结束时返回不足。绝对误差为abs(参考-实际)，相对误差除以正的实际指标值；不能把当前窗口覆盖称为未来指标预测准确。
- [x] UI存储写入失败保留内存结果并说明未保存；损坏账本保留原值供导出。并发标签页重新读取最新账本，版本冲突提示重载，不宣称localStorage提供事务。
- [x] 修改未来柱与后来的人工确认不改变已存快照／原计算。重跑测试至通过，保存检查点。

## Task 6: 加载多周期行情并处理失败与换股

**Files:** 新增 `scenario-loader.ts`、`scenario-loader.test.ts`、`use-scenario-inputs.ts`、`use-scenario-inputs.test.tsx`。
**Consumes:** `Pick<BrowserMarketClient,'series'>`、Task 1规范化；Task 3的大阳线人工确认状态。
**Produces:** `loadScenarioInputs({symbol,asOf,calendar,client,signal}: LoadScenarioArgs): Promise<AnalysisInput>`；
`useScenarioInputs({symbol,calendar,client,sourceMode}: ScenarioInputArgs)`返回 `{input,status,issues,refresh,load30m}`。status为 `idle|loading|ready|partial|error`。

`LoadScenarioArgs={symbol:string; asOf:string; calendar:TradingCalendar|null; client:Pick<BrowserMarketClient,'series'>; signal?:AbortSignal}`；
`ScenarioInputArgs`去掉asOf／signal，增加sourceMode。hook用可替换测试时钟生成asOf，input可为null，refresh／load30m返回Promise<void>。

- [x] 添加失败测试：`loads_day_and_60m_before_optional_30m`、`failed_30m_preserves_parent_inputs`、`old_symbol_resolution_is_ignored`、`aborts_on_unmount`、`rejects_wrong_symbol_period_or_adjustment`。
- [x] 运行 `npm test -- src/features/scenario/scenario-loader.test.ts src/features/scenario/use-scenario-inputs.test.tsx`，确认失败。
- [x] 日线与60m独立加载并使用Promise.allSettled保留成功结果。每次refresh记录同一个asOf；30m下钻使用该asOf，刷新时同时更新已经打开的30m，避免混用两次分析时点。
- [x] `load30m`仅在人工大阳线确认或主动下钻调用；共享AbortSignal与请求代号。换股清空当前分析／确认草稿并取消旧请求；旧响应即使不支持abort也不能写入新股票。
- [x] 某周期失败只生成对应缺项，30m失败保留日／小时结果与重试入口；全部失败明确错误。真实来源失败不自动退回DEMO。
- [x] 来源滞后以来源时间、最后完整柱和已核实日历列出，不伪造最新柱。日历未核实时日期缺项继续传入面板。
- [x] 重跑测试至通过，保存检查点。

## Task 7: 接入研究页面与日→小时→30分钟操作

**Files:** 新增 `scenario-analysis-panel.tsx`、`scenario-confirmation-form.tsx`、`scenario-reference-table.tsx`、`scenario-analysis-panel.css`、`scenario-analysis-panel.test.tsx`（均在scenario目录）；修改 `src/features/research/research-studio.tsx`、`src/features/chart/chart-workspace.tsx`、`chart-workspace.test.tsx`。
**Consumes:** Task 1–6、已有标签目录的按需加载与来源链接。
**Produces:** `ScenarioAnalysisPanel({symbol,sourceMode,activePeriod,onPeriodChange,client})`，props类型分别为string、AnalysisInput['sourceMode']、ChartPeriod、(period:ChartPeriod)=>void、Pick<BrowserMarketClient,'series'>；
图表增加可选受控props `period?: ChartPeriod; onPeriodChange?: (period: ChartPeriod) => void`，不传时保持现有内部周期状态。

- [x] 先阅读Next客户端组件／按需加载文档。添加组件失败测试：大阳线确认→1小时→30分钟；独立周期MA名称；日下跌／30m反弹并列；缺日历日期提示；未完整日线禁用正式起点确认；保存、修订、重载及原文链接。
- [x] 图表测试验证外部设60m／30m和工具栏回传周期，已有绘图按股票／周期隔离且不丢失。运行 `npm test -- src/features/scenario/scenario-analysis-panel.test.tsx src/features/chart/chart-workspace.test.tsx` 确认失败。
- [x] 在ResearchStudio内管理受控图表周期，将面板放在图表下、原ResearchEvidence上方；按需加载标签目录并构建冻结注册表，待来源加载完成再启用相关确认，不再复制整套知识UI。换股时面板使用selectedSymbol，不能把lastSuccessful旧股票行情当作新股票。
- [x] 面板顺序：行情时点→各层方向与形态→葛起点／重置→模式依据→计算方法与条件路径→分周期参数表／合并价位→风险条件→采用与忽略规则→快照历史。
- [x] 大阳线确认后突出“看1小时”“继续看30分钟”，点击同时切图并读取相应真实数据。其他图表周期仍可用，但不把周线等当作当前日／小时分析输入。
- [x] 人工表单从有效完整barKey中选择起点／重置，分别确认模式周期、镜子预选线和底线；未定义阈值必须显示缺项。历史补标保存为replay；live确认刷新asOf后保存所见输入。
- [x] 参数表明确：原点、未来第几根、目标日期／时段、日／小时／30m、方法、情景条件、执行窗口、当前距离、无效原因。不显示编造的概率，30m后三根不写“后三天”。
- [x] 给各周期独立失败／重试状态。保存失败、版本冲突、历史只读与导出均可用。DEMO标记贯穿面板，真实账本保存禁用。
- [x] 手机以可展开卡片／表格容器呈现，不让页面横向溢出；键盘可操作，状态更新有aria-live。重跑上述测试至通过，保存检查点。

## Task 8: 浏览器验收与掌阅科技行情证据

**Files:** 新增 `frontend/e2e/scenario-analysis.spec.ts`、`frontend/e2e/fixtures/scenario-series.json`、`frontend/scripts/capture-scenario-inputs.mjs`、`frontend/scripts/capture-scenario-inputs.test.mjs`；
新增 `research/zhangyue-scenario-v1/README.md`、`manifest.json`、`day.json`、`60m.json`、`30m.json`（仅成功读取后）；按证据需要新增有来源的 `frontend/src/features/scenario/trading-calendar.json` 并接入日历读取；补充README使用入口。
**Consumes:** 已完成页面、现有公开行情API、此前标签成果。
**Produces:** 自动化浏览器验收记录、带来源与hash的实际行情输入；独立报告计算正确性、可评估覆盖与样本限制。
采集脚本导出 `captureScenarioInputs({apiBase,symbol,outputDir,fetchImpl})`，默认symbol=603533、fetchImpl=fetch；CLI仅在直接运行脚本时调用，API根地址必须为本机服务。日历读取沿用Task 1契约，无有效静态文件时返回null。

- [x] 写失败E2E，用明确标注的固定合成API响应验证 `/?symbol=603533` 的日→小时→30m、模式确认、来源、参考位、日线风险底线、保存重载。另测30m失败及换股旧响应；mock不计为真实行情联调。
- [x] 运行 `npm run test:e2e -- e2e/scenario-analysis.spec.ts --project=desktop --project=mobile` 确认缺功能失败；完成必要修复后通过。如云内仅有系统Chromium，用临时配置指定其路径，结果／截图保存在/tmp，不加入浏览器依赖。
- [x] 用Node内置测试先证明采集脚本缺口：错误symbol拒绝、30m失败仍保留成功周期、文件hash可复算；运行 `node --test scripts/capture-scenario-inputs.test.mjs` 确认失败。实现后通过同一命令验证。
- [x] capture脚本只读取本机现有API的603533/day、60m、30m，写入独立目录；拒绝错误symbol／period／复权及覆盖已有冻结文件。manifest记录采集时间、来源时间、完整柱截止、数量、字节hash、参数和每周期失败，缺周期不造数据。运行 `node scripts/capture-scenario-inputs.mjs --symbol 603533 --output ../research/zhangyue-scenario-v1` 留存成功输入。
- [x] 真实读取若受云网络配置阻断，按已使用的cloud-environment-onboarding流程检查配置并保留现有域名，准备仅所需公开行情域名的增量配置；报告阻断，不绕过网络／TLS校验。固定测试与页面验证照常完成。
- [x] 若能核实交易所日历，存覆盖区间、原始来源URL和核实时间并注入应用；不能核实时保持null日期缺项。不能从行情中缺少某股票的日期推断全市场休市。
- [x] 对冻结的真实数据读取，人工指定至少一个有完整上下文的日线大阳线案例；若分钟历史不覆盖该案例，明确缺失，不拿其他日期小时线拼接。固定原点后比较flat滚动、平均增量、最近一天增量及明确条件路径。
- [x] 真实历史比较作为replay；没有在窗口前保存的live记录时，不报告实盘前置计划覆盖率。少量样本只报告逐例结果，不声称掌阅策略胜率／盈利已验证，旧新易盛结果不继承。
- [x] 最终运行 `npm test`、`npm run lint`、`npm run build`，再运行上述桌面／手机E2E及 `e2e/note-tags.spec.ts`。已有测试失败须定位属于本改动或已有问题，不覆盖此前工作。
- [x] 打开实际桌面与手机截图，检查指标周期、图表切换、文本可读性、保存错误与无横向溢出；核对源笔记未修改。根目录运行 `git diff --check`，记录验证结果并保存最终检查点。

## 执行顺序与完成条件

按1→2→3→4→5→6→7→8执行；文件接口共用，先让计算可复算，再接交互。首版完成条件是：603533入口可用、日／小时核心分析可读、大阳线可下钻30m、参考位与风险条件注明周期、缺项可解释、来源可追溯、快照可重载，且计算与浏览器检查通过。

真实行情源或分钟历史不足作为明确限制记录，不能用示例验收替代真实数据证据；不因尚无收益证明阻止交付已验证的研究工具。

建议选择Native执行（在本会话由主代理按任务推进），便于保持时间契约与状态接口一致；需要逐任务独立实施／审查时再选择subagent-driven方式。实施前请审阅本计划并选择执行方式。
