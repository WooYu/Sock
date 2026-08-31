# StockCal Web-first + Next.js/Vercel 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 使用 Next.js/React 构建以手机浏览器和桌面浏览器为主的 StockCal，并通过同源 BFF 复用阿里云上的 Spring Boot 行情、认证、知识和复盘服务。

**Architecture:** frontend/ 是独立 Next.js App Router 应用，服务端页面负责路由和初始数据，Client Components 负责搜索、页签、K 线和编辑交互。浏览器只调用 Next.js /api/* BFF，BFF 再调用现有 Spring Boot；阿里云是首选生产环境，Vercel 只承担可选 Preview/CI，不改变后端部署。

**Tech Stack:** Next.js App Router、TypeScript strict、React、Tailwind CSS、Vitest、Testing Library、Playwright、Docker、Nginx、现有 Spring Boot/PostgreSQL/Redis

**Spec:** docs/superpowers/specs/2026-08-26-stockcal-prototype-realignment-design.md

## Global Constraints

- 首期目标是手机浏览器和桌面浏览器，不以 Android/iOS 原生包为前置条件。
- 宽度不小于 900px 使用 68px 吸顶顶部导航；小于 900px 使用轻量顶部栏和固定底部五项导航。
- 桌面一级入口为：总览、个股分析、专业 K 线、交易、复盘、规则库；移动入口为：总览、分析、K线、交易、复盘。
- 当前股票通过 ?symbol=600519 表示，操作周期通过 ?cycle=short|swing|long 表示；页面切换不得丢失工作区。
- 快速切股必须以请求版本和股票代码双重校验，旧请求不得覆盖新股票。
- 刷新失败保留最后一次成功快照，并显示过期/离线状态、最后更新时间和重试入口。
- 浏览器不得接触 Tushare、OpenAI、短信等秘密；使用服务端环境变量 STOCKCAL_API_BASE_URL 和服务端 token。
- 不迁移 Spring Boot、PostgreSQL、Redis 为 Vercel Functions；不引入自动交易。
- 375px 页面不得产生页面级横向溢出，触控目标不小于 48px，文本放大 1.3 倍时导航仍可用。
- 生产首选阿里云 Docker/Nginx；Vercel Hobby 只用于个人非商业 Preview，商业化或团队协作再评估 Pro。

---

## 文件结构

| 文件 | 单一职责 |
|---|---|
| frontend/app/layout.tsx | 全局字体、主题变量和 Provider 入口 |
| frontend/app/(product)/overview/page.tsx | 总览路由和服务端页面壳 |
| frontend/app/(product)/analysis/[tab]/page.tsx | 个股分析四个页签路由 |
| frontend/app/(product)/chart/page.tsx | 专业 K 线路由 |
| frontend/app/(product)/trading/[tab]/page.tsx | 交易四个页签路由 |
| frontend/app/(product)/review/[tab]/page.tsx | 复盘四个页签路由 |
| frontend/app/(product)/rules/page.tsx | 规则库路由 |
| frontend/app/api/market/search/route.ts | 代理股票搜索 |
| frontend/app/api/market/stocks/[symbol]/snapshot/route.ts | 代理行情快照 |
| frontend/src/features/navigation/navigation-config.ts | 一级导航、二级页签和标签 |
| frontend/src/features/navigation/app-shell.tsx | 顶部导航、底部导航和账户菜单 |
| frontend/src/features/workspace/stock-workspace-provider.tsx | 当前股票、周期、行情和竞态状态 |
| frontend/src/features/workspace/stock-workspace-types.ts | API 与工作区 TypeScript 类型 |
| frontend/src/lib/api/backend-client.ts | 服务端 Spring Boot 请求封装 |
| frontend/src/lib/api/browser-client.ts | 浏览器调用同源 BFF 的封装 |
| frontend/src/features/analysis/* | 行情头、关键位、模式、未来指标、AI |
| frontend/src/features/chart/* | K 线画布、工具组、标注和视口 |
| frontend/src/features/trading/* | 持仓、交易、预测、统计 |
| frontend/src/features/review/* | 当日、单笔、历史复盘和回测 |
| frontend/src/features/rules/* | 规则、知识来源和审批 |
| frontend/tests/* | Vitest/Testing Library 测试工具和夹具 |
| frontend/e2e/* | Playwright 真实浏览器路径 |
| frontend/Dockerfile | 阿里云生产镜像 |
| frontend/next.config.ts | Next.js 构建和安全响应头配置 |
| frontend/.env.example | 非秘密环境变量名称说明 |
| compose.yaml | 将前端加入阿里云部署编排 |

---

### Task 1: 创建 Next.js 基础工程和测试门槛

**Files:**
- Create: frontend/ Next.js App Router 工程
- Create: frontend/src/lib/test/render.tsx
- Create: frontend/src/lib/test/fixtures.ts
- Create: frontend/src/app/page.tsx
- Create: frontend/.env.example
- Create: frontend/README.md
- Modify: README.md

**Interfaces:**
- Produces: npm run dev、npm run lint、npm run test、npm run test:e2e、npm run build
- Produces: frontend/src/lib/test/render.tsx 的 renderWithProviders(ui)
- Produces: 测试夹具 demoSecurity、demoMarketSnapshot，仅供测试，不得进入正式页面默认值

- [ ] Step 1：先写基础工程的失败测试

创建 frontend/src/app/page.test.tsx：

    import { render, screen } from '@testing-library/react'
    import Home from './page'

    test('root page directs the user to the overview workspace', () => {
      render(<Home />)
      expect(screen.getByRole('link', { name: '进入总览' })).toHaveAttribute('href', '/overview')
    })

- [ ] Step 2：运行测试确认工程尚不存在而失败

Run: cd frontend && npm run test -- src/app/page.test.tsx

Expected: FAIL，提示 frontend 或 Home 尚未创建。

- [ ] Step 3：创建 Next.js 工程并配置测试脚本

Run: npx create-next-app@latest frontend --typescript --eslint --tailwind --app --src-dir --import-alias '@/*' --use-npm

在 package.json 增加 test: vitest run、test:watch: vitest、test:e2e: playwright test；安装 vitest、jsdom、@testing-library/react、@testing-library/jest-dom、@testing-library/user-event、@playwright/test。配置 vitest.config.ts 使用 jsdom 和 src/**/*.test.{ts,tsx}，配置 tests/setup.ts 导入 jest-dom。

- [ ] Step 4：实现根页面和测试夹具

src/app/page.tsx 只渲染一个指向 /overview 的链接；src/lib/test/fixtures.ts 中的演示数据必须只被测试导入。env.example 只列出：

    STOCKCAL_API_BASE_URL=http://localhost:8080
    NEXT_PUBLIC_APP_NAME=StockCal

- [ ] Step 5：运行基础测试、Lint 和构建

Run: cd frontend && npm run test && npm run lint && npm run build

Expected: 测试通过、Lint 无错误、Next.js production build 成功。

- [ ] Step 6：提交基础工程

    git add frontend README.md
    git commit -m "feat(web): scaffold Next.js StockCal frontend"

---

### Task 2：实现 Web-first 设计令牌与响应式导航

**Files:**
- Create: frontend/src/features/navigation/navigation-config.ts
- Create: frontend/src/features/navigation/navigation-controller.ts
- Create: frontend/src/features/navigation/app-shell.tsx
- Modify: frontend/src/app/layout.tsx
- Create: frontend/src/features/navigation/navigation-config.test.ts
- Create: frontend/src/features/navigation/app-shell.test.tsx

**Interfaces:**
- Produces: PrimarySection = overview | analysis | chart | trading | review | rules
- Produces: AnalysisTab = key-levels | patterns | future | ai
- Produces: NavigationController with selectPrimary、selectAnalysisTab、selectTradingTab、selectReviewTab
- Produces: AppShell section/onSectionChange

- [ ] Step 1：写导航配置和 1440/375 响应式失败测试

    test('navigation exposes six desktop and five mobile entries', () => {
      expect(desktopNavigation.map((item) => item.label)).toEqual(
        ['总览', '个股分析', '专业 K 线', '交易', '复盘', '规则库'],
      )
      expect(mobileNavigation.map((item) => item.label)).toEqual(
        ['总览', '分析', 'K线', '交易', '复盘'],
      )
    })

    test('mobile shell has no page-level horizontal overflow at 375px', () => {
      render(<AppShell section="overview" onSectionChange={() => {}} />)
      expect(document.body.scrollWidth).toBeLessThanOrEqual(375)
    })

- [ ] Step 2：运行测试确认导航实现不存在而失败

Run: cd frontend && npm run test -- src/features/navigation

Expected: FAIL，提示导航配置和 AppShell 未定义。

- [ ] Step 3：实现配置、控制器和 CSS 变量

在 navigation-config.ts 中定义六项桌面导航及五项移动导航；NavigationController 使用纯状态类负责二级页签保持，React 页面通过 Provider 持有。layout.tsx 设置 --sc-primary、--sc-surface、--sc-border、--sc-gain、--sc-loss 等变量，浅色主题作为首轮基准。

- [ ] Step 4：实现 AppShell 的桌面和手机布局

使用 CSS media query min-width: 900px：桌面显示 68px 吸顶顶栏、六项导航和内容最大宽度 1392px；手机显示轻量顶部栏和 position: fixed 底部五项。每项使用 aria-current、最小 48px 高度和 button/a 语义，不使用 Drawer 承载主入口。账户菜单放规则库、账户、设置和后台。

- [ ] Step 5：运行组件测试和构建

Run: cd frontend && npm run test -- src/features/navigation && npm run lint && npm run build

Expected: PASS；在测试中设置 viewport 375px 和文本缩放 1.3 倍时无 overflow exception。

- [ ] Step 6：提交导航和设计基础

    git add frontend/src/app/layout.tsx frontend/src/features/navigation
    git commit -m "feat(web): add responsive StockCal navigation shell"

---

### Task 3：建立 Spring Boot BFF 与股票工作区

**Files:**
- Create: frontend/src/features/workspace/stock-workspace-types.ts
- Create: frontend/src/features/workspace/stock-workspace-provider.tsx
- Create: frontend/src/lib/api/backend-client.ts
- Create: frontend/src/lib/api/browser-client.ts
- Create: frontend/app/api/market/search/route.ts
- Create: frontend/app/api/market/stocks/[symbol]/snapshot/route.ts
- Create: frontend/src/features/workspace/stock-workspace-provider.test.tsx
- Create: frontend/app/api/market/market-route.test.ts

**Interfaces:**
- Produces: GET /api/market/search?q= 和 GET /api/market/stocks/:symbol/snapshot
- Produces: StockWorkspaceProvider、useStockWorkspace()、selectStock(symbol)、setCycle(cycle)、refresh()
- Produces: WorkspaceState 包含 selectedSymbol、cycle、current、lastSuccessful、status、errorMessage、requestVersion

- [ ] Step 1：写 BFF 和竞态失败测试

    test('a newer stock selection wins when requests resolve out of order', async () => {
      const market = createDeferredMarketClient()
      render(<StockWorkspaceProvider client={market}><Probe /></StockWorkspaceProvider>)
      await userEvent.click(screen.getByRole('button', { name: '选择 600519' }))
      await userEvent.click(screen.getByRole('button', { name: '选择 000001' }))
      market.resolve('000001', demoMarketSnapshot('000001'))
      market.resolve('600519', demoMarketSnapshot('600519'))
      expect(await screen.findByText('当前股票：000001')).toBeInTheDocument()
    })

    test('snapshot route forwards the symbol and does not expose backend secret', async () => {
      const response = await GET(new Request('http://localhost/api/market/stocks/600519/snapshot'), { params: { symbol: '600519' } })
      expect(response.status).toBe(200)
      expect(response.headers.get('set-cookie')).toBeNull()
    })

- [ ] Step 2：运行测试确认 BFF 和 Provider 不存在而失败

Run: cd frontend && npm run test -- src/features/workspace frontend/app/api/market

Expected: FAIL，提示类型、Provider 或 route handler 未定义。

- [ ] Step 3：定义严格类型和后端客户端

类型至少包含：

    export type OperationCycle = 'short' | 'swing' | 'long'
    export type WorkspaceStatus = 'idle' | 'searching' | 'loading' | 'refreshing' | 'ready' | 'stale' | 'offline' | 'error'
    export type StockWorkspaceSnapshot = {
      symbol: string
      security: Security
      market: MarketSnapshot
      analysis: StockAnalysis
      cycle: OperationCycle
      generatedAt: string
    }

backend-client.ts 只从 process.env.STOCKCAL_API_BASE_URL 读取地址，使用 fetch 调用现有 /api/v1/market/search 和 /api/v1/market/stocks/{code}/snapshot；浏览器客户端只调用同源 /api/market/*。

- [ ] Step 4：实现两个 BFF Route Handler

搜索路由将 q 转发到 Spring Boot；快照路由先校验 symbol 为 1–12 位字母数字字符串，再转发并原样返回 JSON。任何后端 token 只在服务器请求头注入，响应中不得返回 token 或内部 URL。

- [ ] Step 5：实现 Provider 的版本校验和错误保留

每次 selectStock 增加 requestVersion、取消旧 AbortController、把 selectedSymbol 立即更新并将 current 置空。响应提交前校验版本和 symbol；刷新失败保留 lastSuccessful 并映射 stale/offline/error。search 不得覆盖当前快照。

- [ ] Step 6：运行工作区、BFF、Lint 和构建测试

Run: cd frontend && npm run test -- src/features/workspace frontend/app/api/market && npm run lint && npm run build

Expected: PASS；测试覆盖 out-of-order response、无快照错误、刷新失败保留和搜索不重置。

- [ ] Step 7：提交 BFF 与工作区

    git add frontend/src/features/workspace frontend/src/lib/api frontend/app/api/market
    git commit -m "feat(web): add typed market BFF and stock workspace"

---

### Task 4：实现总览与个股分析四个页签

**Files:**
- Create: frontend/src/features/overview/overview-page.tsx
- Create: frontend/src/features/analysis/stock-header.tsx
- Create: frontend/src/features/analysis/key-levels-panel.tsx
- Create: frontend/src/features/analysis/patterns-panel.tsx
- Create: frontend/src/features/analysis/future-indicators-panel.tsx
- Create: frontend/src/features/analysis/ai-strategy-panel.tsx
- Modify: frontend/app/(product)/overview/page.tsx
- Create: frontend/app/(product)/analysis/[tab]/page.tsx
- Create: frontend/src/features/overview/overview-page.test.tsx
- Create: frontend/src/features/analysis/analysis-panels.test.tsx

**Interfaces:**
- Consumes: useStockWorkspace()、AppShell、BFF market types
- Produces: StockHeader、KeyLevelsPanel、PatternsPanel、FutureIndicatorsPanel、AiStrategyPanel

- [ ] Step 1：写页面状态和跨页同步失败测试

    test('overview holding selection updates the shared analysis header', async () => {
      renderWithProviders(<OverviewPage />)
      await userEvent.click(screen.getByRole('button', { name: /贵州茅台 600519/ }))
      expect(await screen.findByRole('heading', { name: /贵州茅台/ })).toBeInTheDocument()
      expect(screen.getByText('当前股票：600519')).toBeInTheDocument()
    })

    test('key level evidence supports multiple expanded cards', async () => {
      renderWithProviders(<KeyLevelsPanel />)
      await userEvent.click(screen.getByRole('button', { name: '展开上涨关键区' }))
      await userEvent.click(screen.getByRole('button', { name: '展开下跌支撑区' }))
      expect(screen.getByText('计算依据')).toBeInTheDocument()
      expect(screen.getAllByText('触发条件')).toHaveLength(2)
    })

- [ ] Step 2：运行分析测试确认页面组件不存在而失败

Run: cd frontend && npm run test -- src/features/overview src/features/analysis

Expected: FAIL，提示页面和分析面板未定义。

- [ ] Step 3：实现总览布局

总览按组合指标条、持仓摘要、自选行情、提醒、最近预测顺序排列；每一行使用真实 workspace action 更新 symbol 后跳转 /analysis/key-levels?symbol=...。未登录显示登录入口；没有 API 数据时显示登录/配置/重试，不渲染演示行情。

- [ ] Step 4：实现共享行情头和分析页签

行情头读取 current，显示名称、代码、价格、涨跌、开高低、成交量、换手率、来源、时间、新鲜度和周期选择。分析页签使用路径 /analysis/key-levels、patterns、future、ai，切换只改变 tab，不清除当前股票。

- [ ] Step 5：实现四个分析面板

关键位支持多卡片同时展开；盈利模式显示主策略/备选/风控并持久化当前选择；未来指标显示 MA/BOLL 三日与基准/强势/弱势路径并区分外推线；AI 页签分为数值、规则、解释三层，失败只影响 AI 卡片。数值和规则来自 workspace，不在组件内重新计算。

- [ ] Step 6：运行页面测试、Playwright 首条路径和构建

Run: cd frontend && npm run test -- src/features/overview src/features/analysis && npm run test:e2e -- e2e/analysis.spec.ts && npm run lint && npm run build

Expected: 1440px 和 375px 均能完成搜索选股、切换四个分析页签、展开两个关键位卡片，无控制台错误。

- [ ] Step 7：提交总览与分析

    git add frontend/app/'(product)' frontend/src/features/overview frontend/src/features/analysis frontend/e2e
    git commit -m "feat(web): build overview and stock analysis workspace"

---

### Task 5：实现专业 K 线画布和五组工具

**Files:**
- Create: frontend/src/features/chart/chart-workspace.tsx
- Create: frontend/src/features/chart/chart-toolbar.tsx
- Create: frontend/src/features/chart/chart-layer-panel.tsx
- Create: frontend/src/features/chart/chart-annotation-store.ts
- Create: frontend/src/features/chart/chart-workspace.test.tsx
- Create: frontend/e2e/chart.spec.ts
- Modify: frontend/app/(product)/chart/page.tsx

**Interfaces:**
- Produces: ChartTool = pointer | trend-line | horizontal-line | rectangle | buy | sell | target | stop-loss | text
- Produces: ChartLayerState with keyLevels、predictionPaths、trades、annotations
- Produces: ChartAnnotationStore.create/update/delete/undo/redo

- [ ] Step 1：写工具互斥、图层显隐和撤销失败测试

    test('selecting a drawing tool clears the previous drawing tool', async () => {
      renderWithProviders(<ChartWorkspace />)
      await userEvent.click(screen.getByRole('button', { name: '趋势线' }))
      await userEvent.click(screen.getByRole('button', { name: '矩形' }))
      expect(screen.getByRole('button', { name: '矩形' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: '趋势线' })).toHaveAttribute('aria-pressed', 'false')
    })

    test('hiding key levels does not hide trade annotations', async () => {
      renderWithProviders(<ChartWorkspace />)
      await userEvent.click(screen.getByRole('switch', { name: '关键位' }))
      expect(screen.queryByTestId('key-level-layer')).not.toBeInTheDocument()
      expect(screen.getByTestId('trade-layer')).toBeInTheDocument()
    })

- [ ] Step 2：运行测试确认 K 线组件不存在而失败

Run: cd frontend && npm run test -- src/features/chart

Expected: FAIL，提示 ChartWorkspace 或标注存储未定义。

- [ ] Step 3：接入 K 线渲染器并统一坐标模型

使用适合 Web 的 K 线渲染器；输入只来自 workspace 的 candles、key levels 和 prediction paths。真实行情与未来外推使用不同线型和图例，画布在无快照时显示可执行空态。

- [ ] Step 4：实现五组工具布局

工具栏保持周期和常用工具可见；绘图和指标通过弹出面板打开；指标设置包含 MA、EMA、BOLL 及周期显隐；缩放支持放大、缩小、适配、复位、十字光标；图层支持全部显示/隐藏和分组显隐。所有按钮含 tooltip、aria-pressed 或 aria-expanded。

- [ ] Step 5：实现标注编辑和本地持久化

趋势线、水平线、矩形和交易点支持创建、选择、拖动、编辑、撤销、重做、隐藏和删除；ChartAnnotationStore 以 symbol 分区写入 localStorage，禁止不同股票共用标注。标注颜色与实时行情线区分。

- [ ] Step 6：运行图表测试、Playwright 和构建

Run: cd frontend && npm run test -- src/features/chart && npm run test:e2e -- e2e/chart.spec.ts && npm run lint && npm run build

Expected: 375px 工具面板不产生页面横向滚动；能够创建矩形、拖动一个控制点、隐藏关键位、撤销并恢复。

- [ ] Step 7：提交专业 K 线

    git add frontend/src/features/chart frontend/app/'(product)'/chart frontend/e2e/chart.spec.ts
    git commit -m "feat(web): add professional chart workspace"

---

### Task 6：实现交易、复盘和规则库工作区

**Files:**
- Create: frontend/src/features/trading/*
- Create: frontend/src/features/review/*
- Create: frontend/src/features/rules/*
- Modify: frontend/app/(product)/trading/[tab]/page.tsx
- Modify: frontend/app/(product)/review/[tab]/page.tsx
- Modify: frontend/app/(product)/rules/page.tsx
- Create: frontend/src/features/trading/trading-pages.test.tsx
- Create: frontend/src/features/review/review-pages.test.tsx
- Create: frontend/src/features/rules/rules-pages.test.tsx
- Create: frontend/e2e/trading-review-rules.spec.ts

**Interfaces:**
- Produces: TradingTab = positions | ledger | predictions | statistics
- Produces: ReviewTab = daily | trade | history | backtest
- Produces: PredictionVersion 不可变、RuleDraft、PublishedRule 带来源和审批状态

- [ ] Step 1：写交易、复盘和规则审批失败测试

    test('prediction detail keeps prediction and actual trade sections separate', () => {
      renderWithProviders(<PredictionDetail prediction={fixturePrediction} />)
      expect(screen.getByRole('heading', { name: '预测快照' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: '实盘对照' })).toBeInTheDocument()
    })

    test('unpublished rule is excluded from analysis inputs', () => {
      renderWithProviders(<RuleList rules={[draftRule, publishedRule]} />)
      expect(screen.getByText('待审批')).toBeInTheDocument()
      expect(screen.getByTestId('analysis-rule-count')).toHaveTextContent('1')
    })

- [ ] Step 2：运行测试确认业务工作区不存在而失败

Run: cd frontend && npm run test -- src/features/trading src/features/review src/features/rules

Expected: FAIL，提示页面和类型未定义。

- [ ] Step 3：实现交易四个页签

持仓页显示多组合汇总和当前股票入口；交易流水支持买卖、分红、送转、费用、导入和撤销；预测页显示不可变版本、筛选、详情和实盘对照；统计页显示累计盈亏、每日盈亏、分布、命中率和回撤。交易修改不能写入行情快照。

- [ ] Step 4：实现复盘四个页签

当日总结、单笔复盘、历史复盘和规则回测使用不同状态模型；AI 只生成草稿，用户确认前不能覆盖人工记录。预测回测与交易复盘必须使用不同标题、筛选和统计口径。

- [ ] Step 5：实现规则库与审批

规则列表显示原始来源、结构化条件、适用周期、版本和审批状态；草稿可审批/发布，已发布规则形成不可原地覆盖的版本；分析和回测只接收已发布规则。

- [ ] Step 6：运行业务测试、E2E 和构建

Run: cd frontend && npm run test -- src/features/trading src/features/review src/features/rules && npm run test:e2e -- e2e/trading-review-rules.spec.ts && npm run lint && npm run build

Expected: 能从总览持仓进入交易、从预测进入复盘、从规则库审批后看到发布状态变化；预测和实盘数据不互相覆盖。

- [ ] Step 7：提交交易、复盘和规则库

    git add frontend/src/features/trading frontend/src/features/review frontend/src/features/rules frontend/app/'(product)' frontend/e2e/trading-review-rules.spec.ts
    git commit -m "feat(web): add trading review and rules workspaces"

---

### Task 7：阿里云生产与 Vercel Preview 部署

**Files:**
- Create: frontend/Dockerfile
- Create: frontend/.dockerignore
- Create: frontend/next.config.ts
- Create: frontend/playwright.config.ts
- Modify: compose.yaml
- Create: docs/deploy/stockcal-web-deployment.md
- Create: .github/workflows/web-preview.yml

**Interfaces:**
- Produces: 阿里云同源生产地址、Vercel Preview 地址、健康检查 /api/health
- Produces: STOCKCAL_API_BASE_URL 服务端环境变量和 NEXT_PUBLIC_APP_NAME 公开变量

- [ ] Step 1：写部署配置失败验证

    test -f frontend/Dockerfile
    test -f frontend/next.config.ts
    test -f frontend/.env.example
    test -f .github/workflows/web-preview.yml

Expected: 至少一个文件不存在，命令失败。

- [ ] Step 2：实现 standalone Docker 构建和健康检查

next.config.ts 设置 output: 'standalone'；Docker 多阶段构建执行 npm ci、npm run lint、npm run test、npm run build，运行阶段只复制 standalone 输出和静态资源。增加 app/api/health/route.ts，只返回 {"status":"ok"}，不得返回环境变量。

- [ ] Step 3：将前端加入阿里云 Compose 和 Nginx 说明

在 compose.yaml 增加 stockcal-web 服务，监听内部 3000；Nginx 对外提供 HTTPS，同源 /api 由 Next.js BFF 处理；后端地址通过服务端环境变量注入。文档写出镜像构建、启动、日志、回滚和环境变量名称，禁止记录值。

- [ ] Step 4：配置 Vercel Preview CI

GitHub Actions 在 Pull Request 执行 npm ci、npm run lint、npm run test、npm run build；有 Vercel 项目和 token 时使用固定 CLI 版本执行 Preview，token 通过仓库 Secret 注入，不写入日志。Vercel 只配置 API 地址和公开变量，不配置后端秘密。

- [ ] Step 5：运行部署前验证

Run: cd frontend && npm run lint && npm run test && npm run build && docker build -t stockcal-web:local .

Expected: 全部成功；启动容器后 curl http://localhost:3000/api/health 返回 {"status":"ok"}。

- [ ] Step 6：完成 1440/375 浏览器验收和安全检查

使用 Playwright 对阿里云测试地址和 Vercel Preview 各跑一次：搜索选股、分析页签、K 线工具、交易/复盘跳转、规则审批、刷新失败。检查浏览器 Network 不出现 token、后端内网地址或演示行情；记录控制台错误和首屏性能。

- [ ] Step 7：提交部署文档和 CI

    git add frontend/Dockerfile frontend/.dockerignore frontend/next.config.ts frontend/playwright.config.ts frontend/app/api/health compose.yaml docs/deploy/stockcal-web-deployment.md .github/workflows/web-preview.yml
    git commit -m "ops(web): add Aliyun production and Vercel preview deployment"

---

## 自检结果

- **Spec coverage:** 覆盖 Web-first 路线、六项桌面/五项移动导航、URL 股票状态、BFF、行情竞态、错误保留、总览、分析、K 线、交易、复盘、规则库、响应式、阿里云生产和 Vercel Preview。
- **Completeness scan:** 每个任务均给出实际文件、失败测试、实现边界、运行命令和提交步骤；任务之间没有省略的接口或验证边界。
- **Type consistency:** PrimarySection、AnalysisTab、TradingTab、ReviewTab、OperationCycle、WorkspaceStatus、StockWorkspaceSnapshot 在任务之间保持同名和同值域。
- **Migration safety:** Flutter 工程和现有 Spring Boot 后端在 Web 首条链路稳定前不删除；Next.js 先通过 API 复用后端能力，再按页面增量补接口。
