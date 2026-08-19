# StockCal UI/UX 重设计

> 状态：待评审。范围：交互层 + 视觉层 + 结构层三档全做。

## 目标

让 StockCal 从「功能齐全但门面素、交互生硬」变成「一眼专业的深色金融终端」：核心路径一步直达、视觉统一、错误与空状态有引导、K 线图深色原生。

## 现状问题（全界面审计结论）

| # | 问题 | 位置 |
|---|---|---|
| 1 | 登录入口藏在「更多→账户同步」，未登录时核心功能静默失效 | `home_screen.dart` |
| 2 | 自选股「添加股票」硬编码 3 只股票，非真实搜索 | `watchlist_screen.dart` |
| 3 | 错误提示是技术文本（`snapshot.error.toString()`） | `home_screen.dart` |
| 4 | 空状态只陈述不引导 | 多处 |
| 5 | 组件不统一（有的卡片指标、有的裸文本） | `portfolio_screen.dart`、`review_workspace.dart` 等 |
| 6 | K 线图硬编码 light 配色 + 指标线颜色写死 | `professional_chart_screen.dart` |
| 7 | 导航 5 tab + 「更多」藏 7 入口，功能难找 | `home_screen.dart` |
| 8 | 首页是平铺空状态列表，无仪表盘感 | `home_screen.dart` |

## 一、交互层（可用性修复）

1. **登录引导卡**：未登录时，「行情」默认态顶部显示一张卡片「登录以获取行情与 AI 分析」+「去登录」按钮，点击跳转「我的→账户同步」登录页。保留离线本地功能，不强推。
2. **自选股真搜索**：`WatchlistScreen` 接收 `marketService`；「添加股票」弹窗改调 `marketService.search(query)`（300ms 防抖 + 加载中/空结果状态），返回全市场 A 股。
3. **友好错误**：`_MarketSnapshotLoader` 的 `snapshot.error.toString()` 改为「行情加载失败，请稍后重试」+ 重试；未登录时提示「请先登录以获取行情」。
4. **空状态 CTA**：所有空状态（持仓/复盘/规则/预测/知识）加说明 + 行动按钮。

## 二、视觉层（统一 + 深色原生）

5. **统一组件库**（`lib/widgets/`）：
   - `MetricCard`：卡片式指标（小标签 + 大字 tabular 数值 + 涨跌色），替换组合页 `_Value`、复盘页 `_Value`、分析页 `_ValueTile`、仪表盘 `_Metric`。
   - `EmptyState`：图标 + 标题 + 说明 + 可选 CTA 按钮。
   - `ErrorState`：友好中文 + 重试按钮。
6. **K 线深色适配**：蜡烛红涨绿跌改用 `StockCalColors.gain/loss`（`#F23645`/`#089981`），图表背景/网格/轴文字从 `Theme.of(context)` 取；MA5/MA20/EMA/BOLL 指标线颜色统一到主题色板，删除硬编码 `#B57900`/`#2667A8`/`#7B4FA3`/`#65717E`。

## 三、结构层（导航 + 仪表盘）

7. **导航重构为 4 个主 tab**：

   | Tab | 内容 |
   |---|---|
   | 行情（默认） | 顶部持久搜索框；未选中显示**总览仪表盘**，选中显示**个股分析**+「专业 K 线」按钮 |
   | 自选 | 自选股分组 + 行情列表（涨跌色 + 迷你走势） |
   | 组合 | 现有组合页（已较完善） |
   | 我的 | 卡片网格入口：复盘 AI / 规则回测 / 知识规则 / 账户同步 / 设置 / 管理后台 |

   桌面端用对应导航 rail；「更多」列表移除（入口并入「我的」）。

8. **仪表盘（行情默认态）**：
   - 未登录：登录引导大卡。
   - 已登录：总资产大数字卡（渐变背景）+ 自选股实时行情卡列表（名称/代码/现价/涨跌幅，涨跌色）+ 关键位提醒 + 快速入口。

## 数据流改动

- `WatchlistScreen` 新增 `marketService`（`AShareMarketAdapter`）参数，由 `home_screen.dart` 传入；搜索走真实 API。
- `_Dashboard` 新增登录态 + `onNavigate` 回调，用于登录引导卡和空状态 CTA 的跳转。
- 自选行情列表的 sparkline 复用 `snapshot.dailyCandles` 尾段收盘价。

## 错误处理

- 网络/行情异常：`ErrorState`（友好文案 + 重试），不抛技术文本。
- 未登录访问需鉴权接口：提示「请先登录」，不报 401 技术信息。
- AI/知识库加载失败：已有 `MaterialBanner` 保留，文案统一。

## 测试策略

- 现有 180+ Flutter 测试保持全绿；导航重构涉及的 `product_surface_test.dart`、`watchlist_screen_test.dart` 等同步适配。
- 新增：登录引导卡显示/隐藏、自选股搜索调真实 API（用 fake adapter）、`MetricCard`/`EmptyState`/`ErrorState` 冒烟、K 线蜡烛颜色取主题。
- 改完跑 `flutter analyze` + `flutter test`，重建 Web 供验收。

## 涉及文件

- `lib/widgets/`（新增 3 组件）
- `lib/features/home/home_screen.dart`（导航 + 仪表盘 + 登录卡 + 错误/空状态）
- `lib/features/watchlist/watchlist_screen.dart`（真搜索）
- `lib/features/chart/professional_chart_screen.dart`（深色 + 配色）
- `lib/features/portfolio/portfolio_screen.dart`、`review_workspace.dart`、`stock_analysis_screen.dart`（换用 `MetricCard`）
- 相关测试文件
