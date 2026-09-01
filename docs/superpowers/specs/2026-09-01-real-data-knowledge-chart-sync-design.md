# StockCal 真实数据、规则知识库与 K 线同步设计

## 目标

把当前页面从演示数据切换到阿里云后端真实数据，移除独立的“公司行为调整”页面模块，在“经验规则”中接入 GitHub 股票笔记的 Markdown 导入与 ChatGPT 识别流程，并让 K 线绘图及设置在已登录的手机和网页之间持久化同步。

## 已确认边界

- 当前后端只提供日线行情，暂无可验证的公司行为数据接口；本期删除“公司行为调整”页面模块。
- K 线自身的复权模式和价格计算链路不删除、不改写，避免影响现有 K 线。
- 行情来源使用阿里云部署的后端，通过 `STOCKCAL_API_BASE_URL` / `STOCKCAL_API_URL` 配置；请求失败或没有真实行情时展示明确的不可用状态，不显示假价格、假持仓或假回测结果。
- 默认知识来源为 `WooYu/ObsidianNote/印象笔记/股票` 中的 Markdown；导入时保留原文、路径、内容 hash、行号和摘录。
- ChatGPT/AI 只负责从原文提取候选，不得凭空补阈值、把概念或案例变成可执行买卖规则。

## 笔记语料结论

140 篇股票笔记可分为：

1. 可执行规则：MA5/MA10/MA20、BOLL 中轨、葛兰碧第一/第二天、海龟、破位和止损。
2. 策略模式：摸线、三期/四期、攀升、妖股、反弹、照镜子。
3. 参数计算：多周期均线/BOLL、未来值、关键点、目标位、支撑位和阻力位。
4. 风险纪律：不借钱、不杠杆、不满仓、盘前计划、快速止损、技术依据优先于消息。
5. 概念、案例和图片笔记：作为解释证据，不直接参与交易判断。

其中“葛兰碧.md”主要是图片，不能在没有 OCR/人工确认时发布为规则；“关键点/目标位”是语言和观察工具，应标为经验或概念，不能直接生成买卖动作。

## 可维护规则框架

### 生命周期

`Markdown 来源 → AI/本地提取草稿 → 人工修改和审批 → 发布 → 实际回测校准 → 停用/被新版本替代`

### 规则记录

每条草稿或已发布规则包含：

- `kind`：`RULE`、`EXPERIENCE`、`CONCEPT`、`RISK_DISCIPLINE`、`CASE`；
- `category`：`TREND_FILTER`、`ENTRY`、`EXIT`、`RISK`、`MODE`、`CALCULATION`、`CONCEPT`、`CASE`；
- `strength`：原文明确程度，不能等同于统计可靠度；
- `timeframe`、`mode`、`action`；
- 结构化触发条件、动作、失效条件；无法确定时动作必须为 `WAIT`；
- `sourceDocumentId`、源文件路径、起止行号、原文摘录和证据 id；
- `validationStatus`：没有实际样本时显示 `待校准`，不显示伪造的分数、有效样本数或可信度。

只有 `RULE` 且人工审批并发布后才可以参与分析。`EXPERIENCE`、`CONCEPT`、`RISK_DISCIPLINE` 和 `CASE` 只参与解释、提示和待确认经验，不自动产生买卖信号。

### 导入方式

- 服务启动从挂载的 `/notes` 目录幂等导入默认股票笔记；有 AI 配置时识别核心高信号笔记，其他笔记可从界面批量触发识别。
- 网页支持单个/多个 `.md` 文件上传。
- 网页支持粘贴 Markdown 并填写来源名称。
- 网页支持自然语言录入，保存为带 `user://` 路径的来源后走同一识别流程。
- 审批页支持编辑标题、摘要、类别、动作、周期、触发条件和失效条件，并展示原文证据。

## 真实行情页面

- 默认股票使用真实代码 `600519`，允许通过搜索或 `?symbol=` 切换。
- 页面只消费 `MarketSnapshot`；K 线为空时显示空态，不回退到 `demo-data.ts`。
- 删除演示横幅、`DEMO` 标记、虚构股票、虚构持仓、虚构回测和固定预测数字。
- 真实接口状态显示后端数据源名称、最后更新时间及在线/不可用状态。

## K 线跨设备同步

### 统一实体

实体类型为 `CHART_WORKSPACE`，实体 id 为 `${stockCode}:${period}`，payload 保存完整工作区：

```ts
type ChartWorkspaceSnapshot = {
  version: 1
  stockCode: string
  period: 'day' | 'week' | 'month'
  drawings: ChartDrawing[]
  indicators: Record<string, boolean>
  indicatorConfig: Record<string, unknown>
  layers: Record<string, boolean>
  view: { zoom: number; panX: number; panY: number }
  crosshair: boolean
  updatedAt: string
  revision: number
}
```

网页和 Flutter 都先本地持久化，再把完整 payload 写入现有 sync API；登录后携带 Bearer token，未登录只提供本机保存并在界面标明“登录后跨设备同步”。启动、切换股票/周期和登录后拉取变更，按实体取最新版本；版本冲突时按绘图 id 和字段更新时间合并，再用新的 revision 重试，避免第二台设备覆盖第一台设备的绘图。

## 非目标

- 本期不新增公司行为行情供应商，不把不可验证的除权除息数据接入 K 线。
- 本期不把图片 OCR 结果自动发布为规则。
- 本期不把主观经验强行转换成买入/卖出信号。
- 本期不接入券商实盘下单。

## 验收标准

1. 首页和 K 线页没有“公司行为调整”模块，且 K 线复权模式仍可用。
2. 未配置真实行情或后端不可达时没有任何固定演示价格、股票名、持仓或预测数字。
3. 上传两个 Markdown 后能看到来源、草稿、原文摘录、行号和识别方法；重复上传同一内容不产生重复来源。
4. 概念/案例/经验不会出现在可执行规则开关中；未经审批的规则不能参与分析。
5. 同一账号在网页画线后，手机登录并同步可看到相同绘图、指标、图层和周期设置；反向操作同样成立。
6. 前端测试、lint、build 通过；后端测试在具备 Gradle/JDK 网络依赖后通过。
