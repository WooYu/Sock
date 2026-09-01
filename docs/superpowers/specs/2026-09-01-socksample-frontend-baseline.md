# socksample 前端基线迁移设计

## 目标

以 `WooYu/socksample`（Sites 导出代码）作为 `WooYu/Sock` 的前端视觉与交互基线，替换当前不一致的页面表现，同时保留 Sock 的 API、数据模型、规则优先级、记录同步和路由边界。

## 已确认基线

- 来源仓库：`https://github.com/WooYu/sockSample`（实际仓库名为 `socksample`）
- 来源分支：`main`
- 主要页面：`app/page.tsx`
- 全局样式：`app/globals.css`
- 领域逻辑：`lib/analysis.mjs`、`lib/trading.mjs`、`lib/review.mjs`、`lib/market-actions.mjs`、`lib/backtest.mjs`、`lib/prediction-evaluation.mjs`、`lib/portfolio.mjs`、`lib/annotation-*.mjs`、`lib/candle-aggregation.mjs`、`lib/indicator-config.mjs`
- Sock 当前为 Next App Router 模块化工程，已经有分析、图表、规则、交易、复盘页面和后端 API。

## 方案

采用“样式和页面骨架迁移、业务边界保留”：

1. 将 sample 的设计 token、字体、容器、导航、演示提示条、面板、表格、按钮和移动端导航迁移到 Sock 共享 Shell。
2. 按 sample 的首页信息架构重组 overview，但所有股票、持仓、分析值仍来自 Sock 的 `StockWorkspaceProvider` 和 API。
3. 将 sample 的 K 线周期、绘图工具、指标、图层、缩放、平移和标注交互映射到 Sock 的 `ChartWorkspace` 与 annotation store。
4. 将 sample 的分析、预测、交易、复盘、规则内容拆入 Sock 现有路由，不复制静态业务数据。
5. 每个新增交互先补 Vitest/Testing Library 行为测试；完成后补 Playwright 桌面和手机 viewport 用例。

## 不变约束

- 不删除 Sock 的 `/api` 路由、记录同步、规则存储和默认规则。
- 演示数据不得冒充实时行情；条件不完整或规则冲突时继续输出等待/不可判断。
- 预测、实盘交易和复盘记录保持独立。
- 字体允许比 sample 略大，但颜色、层级、留白和控件形态以 sample 为准。

## 验收标准

- 主要页面采用 sample 的信息层级和视觉语言。
- 导航、搜索、K 线绘图、规则启停、交易录入、预测查看和复盘切换可操作。
- `npm run lint`、`npm test`、`npm run build` 通过。
- Playwright 在 1440×900 和 390×844 下验证无水平溢出、无空白页、无控制台错误。
