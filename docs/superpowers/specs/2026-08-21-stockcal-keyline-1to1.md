# StockCal 参考站「位界 KEYLINE」全站 1:1 还原

> 状态：已评审通过。范围：全站 1:1（导航 shell + 关键位分析 + 组合总览 + 其余 8 页）。
> 参考来源：`docs/reference/stock-key-levels-reference.md`（位界 KEYLINE 结构分析）。

## 目标

把 StockCal 从「功能齐全但结构仍偏传统 4-tab」改造成与参考站 KEYLINE 一致的交互与视觉：左侧导航 rail + 顶部搜索 + `⌘K` 命令面板，核心「关键位分析」页做到像素级 1:1，其余页面映射到现有功能并套用统一 shell / 组件库 / 主题。

**已确认的决策**：范围=全站；导航=左导航 rail + 命令面板；方向强度=半圆仪表盘；演示模式=不加（保持登录门控）。

## 设计原则

沿用并收紧 `2026-08-20-stockcal-ui-ux-redesign.md` 的原则：

1. 可读性优先：tabular 数字对齐、对比度达 WCAG 2.2。
2. 智能密度 + 渐进披露：首页先答最要紧的问题，深度按需展开。
3. 冷静优于噪音：每屏只留一个主行动；红涨绿跌且颜色不单独承载语义。
4. 克制配色：现有深海军蓝 `#0B1220` + 薄荷青 `#47D7C7` 主题**已对齐参考站深色**，保持不变；浅色主题保留。
5. 感知速度：加载用骨架屏，不用转圈（测试中允许）。

## 一、导航 Shell

### 结构

桌面端（`width >= 900`）三栏：

- **左导航 rail**（约 224px）：站点标识 + 10 项主导航 + 底部账户区。
- **主内容区**：当前目的地内容。
- **顶栏**：持久搜索框（`/` 或点击聚焦）+ `⌘K` 命令面板触发 + 通知 + 头像菜单（账户同步 / 设置 / 管理后台 / 退出）。

移动端（`width < 900`）：顶栏保留搜索 + 头像；导航收进 **NavigationDrawer**（10 项放不下底部栏）。

### 导航目的地（`NavDestination` 数据模型）

引入声明式 `NavDestination { key, title, icon, builder }`，同时驱动 rail、drawer、命令面板与路由，避免三处硬编码。

| key | title | icon | 内容 |
|---|---|---|---|
| overview | 组合总览 | dashboard | 首页仪表盘（Phase 3） |
| key-levels | 关键位分析 | candlestick_chart | `StockAnalysisScreen`（Phase 2） |
| patterns | 盈利模式 | auto_graph | 规则命中页 |
| future | 未来指标 | insights | `analysis.future` 三日延伸 |
| predictions | 预测记录 | history | `PersistentPredictionRepository` 历史 |
| trades | 交易与盈亏 | account_balance_wallet | `PortfolioScreen` + ledger |
| charts | 统计图表 | bar_chart | 收益曲线 + 持仓分布（新增） |
| review | 当日复盘 | rate_review | `ReviewWorkspace` |
| ai-strategy | AI策略 | psychology | 策略建议 + 三层可解释流水线 |
| rules | 经验规则 | library_books | `KnowledgeWorkspace` |

### 命令面板（⌘K / Ctrl+K）

- 模态浮层，输入即过滤。
- 结果两类：**导航目的地**（10 项，回车跳转）与**股票搜索**（`marketService.search`，选中后进入关键位分析）。
- 快捷键注册用 `Shortcuts`/`Actions`（`FocusableActionDetector` + `CallbackShortcuts`），`⌘K` 在 web/desktop、`Ctrl+K` 在其它平台。
- 打开命令面板后可继续输入过滤；Esc 关闭。

### 顶栏账户菜单

头像点击弹出菜单：账户同步 / 设置 / 管理后台 / 退出登录。未登录时显示「登录」入口。登录门控不变（不引入演示模式）。

## 二、数据模型扩展（`technical_analysis.dart`）

`StockAnalysis` 增加字段（均由 `StockAnalyzer` 计算，缺失时用安全默认值）：

| 字段 | 类型 | 说明 |
|---|---|---|
| `amplitude` | double | 振幅 =（当日最高 − 当日最低）/ 昨收 × 100 |
| `atr` | double | N 日平均真实波幅（默认 14） |
| `parameters` | `List<ParameterItem>` | 「今日参数」快照（约 12 项：MA5/MA20/EMA12/BOLL 上中下/ATR/振幅/量比/昨收/今开/最高/最低） |
| `ruleHitCount` / `ruleTotalCount` | int | 规则命中数 / 总数，来自 `RuleBook` 评估 |
| `conditions` | `List<ConditionCheck>` | 主策略详情勾选：MA5 上移 / BOLL 抬升 / 振幅达标，各含 `met` |
| `ruleCredibility` | double | 规则可信度（0–100），独立于策略匹配度 |
| `modelName` | String | 当前模型名（常量「GPT-5 轻量分类模型」占位） |

新增值对象：

- `ParameterItem { label, value, unit }`
- `ConditionCheck { label, met }`
- `RuleBand { primary, alternate, risk, caution }`（enum）
- `MatchedRule` 增加 `band` 字段。

### 规则匹配统一

当前 `StockAnalyzer.analyze` 用硬编码启发式生成 `matchedRules`，与 `RuleBook` 脱节。改造：

- `StockAnalyzer` 增加可选 `RuleBook? ruleBook` 与 `RuleFacts` 计算；当提供 `ruleBook` 时，用 `ruleBook.activeRules` 逐条 `evaluate()` 得到真实命中数 `ruleHitCount/ruleTotalCount`。
- 硬编码启发式评分列表保留为「策略列表」，仅新增 `band` 分档：`>=80` 主策略、`60–79` 备选、`40–59` 风控、`<40` 警戒（区间可调）。
- 未提供 `ruleBook` 时（测试/独立场景）`ruleHitCount/ruleTotalCount` 回退为 `matchedRules.length / 启发式总数`。

## 三、关键位分析 1:1（`stock_analysis_screen.dart`）

长滚动页，区块自上而下：

1. **个股头部**：名称 / 代码·行业 / 自选标签 + 现价 + 涨跌（红涨绿跌）。保留现有实现，补「行业」与自选加星。
2. **方向强度（半圆仪表盘）**：自绘 `CustomPaint` 半圆仪表 —— 半圆刻度、指针、空头/中性/多头三段分区、`64/100` 数值居中。替换现有线性进度条。颜色与现有 `_directionColor` 一致：多头用 `gain`（红）、空头用 `loss`（绿）、中性用灰；指针/数值用 `primary`（薄荷青）。
3. **盈利模式识别 · 规则匹配**：
   - 摘要行：今日参数（折叠为「12 项」芯片）· 振幅匹配 · 规则命中 `N/总数`。
   - 策略列表按分数排序，每组带 `band` 徽标：主策略(86 攀升) / 备选(74 照镜子止盈) / 风控(61 反弹止损) / 警戒(39 弱势处理)。
4. **主策略详情**：买入关注区间 / 卖出·止盈区间 / 失效条件 + **条件勾选**（MA5 上移 / BOLL 抬升 / 振幅达标，`Checkbox` + 打勾色）。
5. **模型编排 · 可解释分析（AI 策略分析中心）**：三层流水线可视化（数值计算层 12 项 → 规则引擎层 N/总数 命中 → AI 解释层 分数）已存在，**补**：
   - 策略结论 / 解释依据 / 待确认经验 三行文本；
   - 底部三个指标：策略匹配度（= confidence×100）/ 规则可信度（= ruleCredibility）/ 风险等级（已有）；
   - 当前模型行：`modelName`。
6. 保留现有「技术指标」「未来三日指标延伸」「相关经验与概念」区块（参考站无但属现有能力，按「用现在项目中的」保留）。

## 四、组合总览 1:1（首页仪表盘）

- **组合总览卡**：持仓股票 N 只 / 总投入 / 当前市值 / 总浮动盈亏 / 已实现盈亏 / 组合收益率（用 `MetricCard` 网格）。
- **持仓表格**：列 `股票 | 持仓/成本 | 现价/市值 | 浮动盈亏 | 收益率`，每行尾「查看详情 →」（跳转交易与盈亏）。
- 保留现有「关键位提醒」「最新预测」区块，样式统一。

## 五、其余 8 页（映射 + 套 shell）

| key | 现状 | 改动 |
|---|---|---|
| patterns 盈利模式 | 规则引擎 `RulesWorkspace` | 抽出「命中视图」：列出 `RuleBook.activeRules` 与命中状态 |
| future 未来指标 | `analysis.future` | 独立页展示三日延伸表（表格化） |
| predictions 预测记录 | `PersistentPredictionRepository` | 历史列表页（不可变快照） |
| trades 交易与盈亏 | `PortfolioScreen` + ledger | 已有，套 shell + 组件库 |
| charts 统计图表 | 无 | 新增：收益曲线（按日）+ 持仓分布（饼/条） |
| review 当日复盘 | `ReviewWorkspace` | 已有，套 shell |
| ai-strategy AI策略 | 策略建议 + 流水线 | 从关键位分析抽出为独立页（同一数据） |
| rules 经验规则 | `KnowledgeWorkspace` | 已有，套 shell |

## 六、错误处理

- 未登录访问需鉴权接口：提示「请先登录」，不报 401 技术信息（沿用现有登录卡）。
- 行情/搜索/分析异常：`ErrorState`（友好文案 + 重试）。
- AI/知识库加载失败：保留现有 `MaterialBanner`，文案统一。
- 空状态一律 `EmptyState`（说明 + CTA）。

## 七、测试策略

- 现有 180+ Flutter 测试保持全绿；导航重构涉及的 `product_surface_test.dart`、`watchlist_screen_test.dart` 等同步适配。
- 新增：
  - 数据模型：振幅/ATR/参数快照/规则命中数/分档/条件勾选/可信度 的单元测试（`StockAnalyzer`）。
  - 半圆仪表盘：`CustomPaint` 冒烟 + 数值/方向文案断言。
  - 命令面板：打开/过滤/导航跳转/股票搜索（fake adapter）。
  - 导航 shell：rail 与 drawer 目的地渲染、顶栏账户菜单。
  - 组合总览：持仓表格「查看详情 →」跳转。
- 每阶段结束跑 `flutter analyze` + `flutter test`，重建 Web 验收。

## 八、涉及文件

- 新增：`lib/features/navigation/`（`NavDestination`、`AppShell`、`CommandPalette`）、`lib/features/analysis/direction_gauge.dart`、`lib/features/charts/statistics_workspace.dart`、`lib/features/patterns/patterns_workspace.dart`、`lib/features/future/future_workspace.dart`、`lib/features/predictions/predictions_workspace.dart`。
- 修改：`lib/features/home/home_screen.dart`（shell 接入）、`lib/features/analysis/technical_analysis.dart`（模型扩展）、`lib/features/analysis/stock_analysis_screen.dart`（关键位分析 1:1）、`lib/features/analysis/stock_analysis_controller.dart`（RuleBook 注入）、`lib/features/portfolio/portfolio_screen.dart`（组合总览）、`lib/theme/stockcal_theme.dart`（如需微调）。
- 相关测试文件。

## 九、阶段与提交

按提交推进（每阶段可独立验收）：

1. `feat: extend analysis model with amplitude/ATR/params/rule-bands/conditions`（数据模型 + 测试）
2. `feat: add navigation shell with left rail, top bar, command palette`（导航 shell）
3. `feat: semicircular direction gauge + profit-pattern strategy bands`（关键位分析前半）
4. `feat: strategy conditions + model detail`（关键位分析后半）
5. `feat: portfolio overview 1:1 with holdings table`
6. `feat: map remaining pages (patterns/future/predictions/charts/ai-strategy)`（其余页 + 统计图表）
7. `feat: wire login-gated shell account menu`（账户菜单 + 收尾）
