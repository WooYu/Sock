# StockCal Web-first 当前进度与交接说明

更新日期：2026-08-27

代码分支：`agent/local-first-watchlist`

远程仓库：`https://github.com/WooYu/Sock.git`

## 1. 产品定位与当前路线

StockCal 当前改为以手机浏览器和桌面浏览器为主的 Web-first A 股分析、记录与复盘工具。Android/iOS 原生包不再是当前前置条件；Next.js/React 负责 Web 前端，现有 Spring Boot、PostgreSQL、Redis 和外部服务继续作为后端基础。系统将行情和交易等确定性数据与 AI 文字说明严格分离：AI 只能读取已经计算并固化的快照，不能修改价格、交易、指标或预测结果。

阿里云服务器是首选生产环境；Vercel 作为可选 Preview/CI 平台，不要求购买 Pro，也不替代后端。正式前端计划位于 `docs/superpowers/plans/2026-08-27-stockcal-web-first-plan.md`，权威产品与技术设计位于 `docs/superpowers/specs/2026-08-26-stockcal-prototype-realignment-design.md`。

Flutter 工程和已实现能力保留为迁移参考；旧的 Flutter 导航计划已被 Web-first 计划替代。

## 2. 已实现范围（现有 Flutter/后端基础）

| 模块 | 当前实现 |
|---|---|
| 账户与同步 | 验证码登录契约、访问/刷新令牌、设备列表与撤销、受保护 API、本地会话、幂等同步队列、账户注销及本地清理 |
| 总览与自选 | 自选分组、代码/名称搜索、排序、去重、删除、同步状态；资产、持仓、盈亏、市场与待办总览 |
| 组合与交易 | 多组合与多资金账户的创建、切换、重命名、删除与跨组合汇总；买卖、分红、送转、费用；平均成本、已实现/浮动盈亏、现金；CSV 字段映射、预览校验、原子导入和撤销 |
| 个股分析 | 代码/名称/拼音搜索，行情新鲜度，涨跌停，MA/EMA/BOLL、量价、支撑压力、目标、置信度、风险和未来三日延伸 |
| 专业 K 线 | 日/周/月、前后复权、缩放平移、十字光标、量能及指标图层；趋势线、水平线、矩形、点位的创建、选择、编辑、隐藏、删除和同步 |
| 规则与预测 | 系统/用户规则、结构化条件、优先级、启停和不可变版本；输入快照、命中规则、计算证据、输出与新版本预测 |
| 回测与复盘 | 股票/规则/日期过滤，命中率、误差、最大回撤、样本量；单笔、每日、每周复盘和版本化 AI 文字 |
| 知识规则 | 扫描指定笔记目录、保留原文与来源行、启发式/OpenAI 提取、草稿审批、发布，并在规则及分析页面展示 |
| 设置与后台 | 主题/通知/指标默认参数持久化并全局应用；文件级数据导入导出与分享、本地备份、账户注销；行情/同步任务、用户角色、规则模板启停、审计日志、AI 调用日志和密钥状态视图 |
| 服务端 | PostgreSQL 迁移、Redis 配置、认证与授权、增量同步、Tushare 行情适配、知识工作流、AI 调用审计、管理 API |

## 3. 数据与安全边界

- `.env.local` 已加入 `.gitignore`，API 密钥不会提交到仓库。
- Flutter 客户端不保存短信、行情或 OpenAI 服务密钥。
- 预测记录和 AI 叙述均采用追加版本；重新生成不会覆盖旧记录。
- 行情失败会保留最后成功时间并显示延迟、过期或离线状态。
- 账户注销删除身份、令牌、设备和同步数据，并匿名化需保留的审计主体。
- 本项目只提供辅助分析，不构成投资建议，也没有自动下单能力。

## 4. 知识笔记状态

规则来源目录为：

```text
C:\Users\Administrator\Documents\Obsidian Vault\印象笔记\股票
```

此前扫描确认该目录包含 140 份笔记，约 534,683 字节。导入器会保留完整原文、文件路径、内容哈希和来源行号，再生成可审批的规则、经验或概念草稿。当前 OpenAI 账户返回 `credit_balance_exhausted`，因此在线 AI 提取没有完成；本地启发式提取路径和审批工作流可用，补充额度后可重新执行在线提取。

## 5. 尚未闭环的生产事项

- 需要有效的 `OPENAI_API_KEY` 额度，才能验证 140 份笔记的在线结构化提取和复盘生成。
- 需要 `TUSHARE_TOKEN` 才能验证真实 A 股行情；当前测试使用确定性夹具和模拟响应。
- 生产短信供应商尚未选定和配置；无密钥时验证码接口按设计返回服务不可用。
- PostgreSQL/Redis 的代码、迁移和 Compose 已具备，但仍需在有 Docker 的机器上执行真实迁移及长期运行验证。
- Android/iOS 的签名、真机回归、商店发布和完整无障碍检查尚未完成。

本次已闭环的代码项：多组合/多资金账户、主题/通知/指标默认参数持久化、文件级数据导入导出与分享、管理后台的审计日志、AI 调用日志与规则模板启停。

## 6. 继续开发顺序

1. 创建 `frontend/` Next.js 工程、测试门槛和 Web-first 响应式导航。
2. 通过 Next.js BFF 接入现有行情接口，建立 URL 股票状态和跨页工作区。
3. 按 Web-first 计划完成总览、个股分析、专业 K 线、交易、复盘和规则库。
4. 配置 PostgreSQL、Redis、Tushare、短信和有余额的 OpenAI 项目，完成外部服务集成验证。
5. 将前端部署到阿里云生产环境，使用 Vercel Preview 做分支验收，再执行安全、性能和备份恢复演练。

## 7. 设计与记录索引

- `docs/superpowers/specs/2026-08-14-stockcal-production-design.md`：稳定的产品与架构原则。
- `docs/superpowers/plans/2026-08-14-stockcal-production-roadmap.md`：按垂直功能拆分的实施路线。
- `docs/superpowers/specs/2026-08-26-stockcal-prototype-realignment-design.md`：当前 Web-first + Next.js/Vercel 权威设计。
- `docs/superpowers/plans/2026-08-27-stockcal-web-first-plan.md`：当前 Next.js/Vercel 实施计划。
- `docs/superpowers/plans/2026-08-27-stockcal-navigation-workspace.md`：已替代的 Flutter 导航计划，仅作历史记录。
- `task_plan.md`：当前阶段状态和验收门槛。
- `progress.md`：按时间记录的 TDD 与验证历史。
- `findings.md`：环境限制、架构发现和关键决策。

## 8. 验证命令

```powershell
flutter test
flutter analyze
flutter build web --release
cd backend
.\gradlew.bat test
```

本文件的验证结果应在推送前根据新运行结果更新，不使用历史成功记录代替当前证据。

### 2026-08-14 当前提交验证结果

| 检查 | 结果 |
|---|---|
| `flutter test` | 179 项通过，0 项失败 |
| `flutter analyze` | 通过，0 个问题 |
| `flutter build web --release` | 通过，产物生成于 `build/web` |
| `./gradlew test`（backend） | 32 项通过，0 失败、0 错误、0 跳过 |

后端自动测试使用 H2 测试结构验证控制器和服务契约；这不能替代尚待执行的真实 PostgreSQL、Redis 和 Flyway 部署演练。Android/iOS 构建及真机验证也不包含在本次进度归档中。

### 2026-08-24 设计系统 Phase 0 验证结果

范围：`docs/superpowers/specs/2026-08-24-stockcal-design-system-design.md`（token 层 + 十个共享组件 + 组件画廊）。配色由深空青色切换为原型浅色蓝（`#f5f6f8` / `#4057e8`），深色为过渡取值待 X 配色确定。

| 检查 | 结果 |
|---|---|
| `flutter test` | 273 项通过，0 项失败 |
| `flutter analyze` | 通过，0 个问题 |
| `flutter build web --release` | 通过，产物生成于 `build/web` |
| 颜色字面量机检（`grep 0xFF lib/widgets/design/*.dart`） | 通过，0 处（颜色仅存于 `design_tokens.dart`） |
| `./gradlew test`（backend） | 本次未运行（无后端改动） |

组件画廊入口：设置 → 数据与账户 → 组件画廊。

### 2026-08-26 进度复核与业务屏迁移

本次重新从远端 `agent/local-first-watchlist` 分支拉取并核对了代码、提交历史、原型 DOM/CSS 快照和运行基线。功能主链路仍完整，当前工作的重点已经从「补功能」切换为「把九个业务屏逐步迁移到 Phase 0 设计系统」。

| 范围 | 当前状态 |
|---|---|
| 产品功能 | 账户、自选、组合、分析、K 线、规则预测、回测复盘、知识管理和后台主链路已实现；外部服务和发布项仍按第 5 节处理 |
| 原型资料 | `docs/stockcal-redesign-prototype.html` 与 `docs/stockcal-prototype.css` 已作为离线可复核基准，不再依赖线上站登录状态 |
| 设计系统 | token、十个共享组件和组件画廊已完成 |
| 业务屏迁移 | 「关键位分析」首个切片已接入 `MetricStrip`、`SegTabs`、`PanelCard`、`SectionHeading`、`StatusBadge`、`ScoreBar`；其余业务屏仍主要使用旧版 Material 组件 |
| 方向强度 | 已由旧半圆仪表修正为原型实际使用的线性三段强度条，并保留空头/中性/多头语义 |

本次新鲜验证：

| 检查 | 结果 |
|---|---|
| `flutter test` | 274 项通过，0 项失败 |
| `flutter analyze` | 通过，0 个问题 |
| `flutter build web --release` | 通过，产物生成于 `build/web` |
| 375×812 关键位页布局测试 | 通过，无横向溢出 |

容器内浏览器无法完成最终目视验收：云浏览器不允许访问容器本机地址，本地浏览器安装又被证书链拦截。因此本次只声明构建、组件与布局测试通过，不声明已完成像素级视觉验收。

后续业务屏迁移顺序：组合与交易 → 未来指标/预测记录/统计 → 专业 K 线工具栏 → 规则/复盘/知识 → 设置与后台 → 全站响应式、无障碍和视觉回归。
