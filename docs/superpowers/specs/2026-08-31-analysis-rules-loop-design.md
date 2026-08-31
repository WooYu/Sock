# StockCal 分析与规则决策闭环设计

**日期：** 2026-08-31  
**范围：** 第一阶段闭环：真实行情 → 技术计算 → 规则判断 → 等待/方向结论 → 分析快照

## 目标

把当前前端临时计算升级为可复用、可审计的后端分析服务。系统必须能说明每个结论使用了哪些行情、指标和规则；条件不足或规则冲突时输出“等待/不可判断”，不能强行生成买卖结论。

## 边界

本阶段只实现分析与规则决策，不实现自动交易，不修改当前免登录策略，也不实现持仓、交易流水和复盘记录。后续阶段通过分析快照 ID 复用本阶段结果。

## 架构

Spring Boot 从 `MarketProvider` 获取行情快照，`AnalysisService` 计算 MA/BOLL/支撑压力，`RuleEngine` 读取已发布规则并执行条件判断，`AnalysisController` 提供查询接口。分析结果保存到 PostgreSQL，前端通过 Next.js BFF 调用后端，不在浏览器保存 Tushare 或 AI 密钥。

数据流：

```text
MarketProvider
  → AnalysisService
  → RuleEngine
  → DecisionPolicy
  → AnalysisSnapshotRepository
  → GET /api/v1/analysis/stocks/{code}
  → Next.js BFF
  → 个股分析页面
```

## 决策规则

1. 少于 20 根有效日线时，状态为 `WAITING`，原因必须包含数据不足。
2. 指标无法计算、行情源离线或行情时间过期时，状态为 `WAITING`。
3. 没有已发布规则命中时，不输出买卖结论，方向为 `NEUTRAL`。
4. 已发布规则同时命中相反方向时，状态为 `WAITING`，原因标记为规则冲突。
5. 只有同一方向规则达到最低门槛且指标条件完整时，才允许输出 `BULLISH` 或 `BEARISH`。
6. `confidence` 为 0 到 1 的数值；规则冲突或等待状态时必须为 0。
7. 结论必须保存计算时间、行情源、最近交易日、指标值、规则版本和解释文本。

## 数据结构

后端新增以下概念：

- `AnalysisStatus`: `READY`、`WAITING`
- `AnalysisDirection`: `BULLISH`、`NEUTRAL`、`BEARISH`
- `IndicatorSnapshot`: MA5、MA10、MA20、BOLL 上中下轨
- `RuleEvaluation`: 规则 ID、版本、方向、是否命中、分数、原因
- `AnalysisSnapshot`: 股票代码、周期、行情时间、指标、关键位、决策、规则评估列表

规则只允许使用已发布版本作为分析输入；草稿和待审批规则不得影响结果。

## 接口

```text
GET /api/v1/analysis/stocks/{code}?cycle=short|swing|long
```

返回分析快照，包括：

```json
{
  "symbol": "600519",
  "cycle": "swing",
  "status": "WAITING",
  "direction": "NEUTRAL",
  "reason": "没有已发布规则命中，暂不判断。",
  "confidence": 0,
  "indicators": {},
  "support": 0,
  "resistance": 0,
  "target": 0,
  "rules": [],
  "generatedAt": "2026-08-31T00:00:00Z"
}
```

接口失败时返回明确的 HTTP 状态和用户可读错误；不得返回 Tushare token、数据库连接信息或内部请求地址。

## 前端改造

Next.js 增加同源 BFF：

```text
GET /api/market/stocks/{symbol}/analysis?cycle=swing
```

工作区同时加载行情和分析，分析请求必须遵守现有请求版本与 AbortController 竞态保护。个股分析四个页签只消费后端分析快照，不在组件内重复计算。AI 页签本阶段只展示数值和规则结果，AI 解释继续显示服务未接通状态。

## 验收标准

- 使用 Tushare 行情时，分析结果的最近交易日和行情源与快照一致。
- 20 根以上 K 线可得到 MA/BOLL 和关键位。
- 无已发布规则、数据不足、离线和规则冲突均显示“等待/不可判断”。
- 前端不再把 `matchedRules` 固定为空数组。
- 同一股票重复查询生成可追踪的分析快照。
- 前端和后端测试覆盖正常、等待、冲突和异常场景。
- 前端全量测试、Lint、生产构建通过；后端测试在服务器具备 Gradle 依赖后执行。

## 后续阶段

本阶段完成后，第二阶段新增预测快照；第三阶段新增持仓和交易流水；第四阶段新增复盘和回测；第五阶段接入 AI 解释和认证。所有阶段引用 `AnalysisSnapshot`，不重新复制计算逻辑。
