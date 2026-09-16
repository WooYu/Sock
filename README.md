# StockCal

部署拓扑（用户于2026-09-16确认）：**前端部署在Vercel，后端部署在阿里云**。生产前端项目为Vercel的`frontend`，关联`WooYu/Sock`，入口为`https://frontend-xi-nine-18.vercel.app`。排查线上问题应检查Vercel生产配置、实际部署提交和阿里云服务，不应以本机缺少环境变量或8080端口未启动推断线上后端不可用。

2026-09-16只读检查：Vercel生产版本为`f68c014`（9月9日部署）；线上行情和规则接口返回200，预测接口返回上游404，路径`/api/v1/market/stocks/300502/prediction`。仓库代码已有该路由，需核对阿里云运行版本及反向代理；这不是已经验证的“线上未配置后端地址”。本轮新工作台、经验研究库和多周期行情修改仍需独立发布才会出现在生产版本。

首页与 `/chart` 现在进入 **K 线研究工作台**：页内选股、自选与最近查看、绘图工具、未来三个交易日的价格和 MA/BOLL、笔记规则及历史相似走势集中在同一页面。交互设计见 [研究工作台设计](docs/superpowers/specs/2026-09-15-kline-research-studio-design.md)。

本地启动前端后访问 `http://localhost:3000`。行情服务暂不可用时，可以点击“用示例体验”，或访问 `/?example=1`；示例明确使用合成数据和独立的 DEMO 绘图空间，只保存在本机，不会作为真实行情或上传到账户。当前 `baseline-v1` 是近 20 日价格趋势推演，笔记规则用于独立校验，不代表已经提高预测准确率。

图表现支持MA5、10、20、30、60、90、120、250，以及分时、1/5/15/30分钟、1/2小时、日/周/月/季/年线。MA按当前周期根数计算，历史不足留空；分时为真实价格/VWAP线。未配置原后端时，股票搜索和行情使用腾讯公开延时数据，默认不复权；已配置的后端路径保留。预测服务独立配置，当前仍是日线未来3交易日。详见[周期与均线口径](docs/superpowers/specs/2026-09-16-market-chart-periods.md)及[下一阶段预测方案建议](docs/superpowers/specs/2026-09-16-forecast-recommendation.md)。

`/knowledge` 是经验与原则研究库：已纳入最新140篇股票笔记的语义解析、64个归并主题及10条手动经验，支持原文核对、解释修正、不可覆盖版本、手动记录与JSON导出。`/knowledge?view=backtest` 展示新易盛近三年真实行情回测证据；[完整报告和可复跑笔记本](research/2026-09-16-xinyisheng/README.md)保留来源、方法、逐日预测账本和边界。研究版“走势+经验”尚未证明收盘预测优势，没有据此自动替换生产预测或启用交易。

StockCal 是一个面向手机浏览器和桌面浏览器的 A 股决策与复盘工具。Next.js Web 前端负责交互，Spring Boot 服务负责认证、同步、行情、知识提取、AI 调用与管理能力。

> 当前仓库是一套可持续开发和演示的产品实现，不是已上线的证券交易系统。自动交易、券商直连、付费订阅以及港美股不在当前范围内。

## 当前能力

- 手机验证码登录、令牌刷新、设备管理、退出与账户注销
- 自选分组、搜索、排序、本地持久化与同步队列
- 组合持仓、交易流水、成本和盈亏、CSV 导入预览与撤销
- A 股搜索、行情状态、MA/EMA/BOLL、量能、关键位与目标位
- 日/周/月 K 线、复权、缩放、十字光标、指标图层和绘图标注
- 版本化规则、不可覆盖的预测快照和历史回测
- 单笔/每日/每周复盘，以及只读确定性输入的 AI 说明
- 笔记原文保留、知识草稿提取、审批、发布和业务页面引用
- GitHub 股票笔记 Markdown 批量导入、AI 候选识别、证据行号和人工审批
- K 线绘图、指标设置、图层和视图的本机保存；登录后通过阿里云同步到手机与网页
- 数据归档、恢复、备份、管理视图、审计和服务状态

完整设计与阶段状态见：

- [生产设计](docs/superpowers/specs/2026-08-14-stockcal-production-design.md)
- [实施路线图](docs/superpowers/plans/2026-08-14-stockcal-production-roadmap.md)
- [当前交接说明](docs/handoff/2026-08-14-stockcal-current-status.md)
- [Web-first 设计](docs/superpowers/specs/2026-08-26-stockcal-prototype-realignment-design.md)
- [Web-first 实施计划](docs/superpowers/plans/2026-08-27-stockcal-web-first-plan.md)
- [K 线与未来推演重设计](docs/superpowers/specs/2026-09-07-kline-drawing-prediction-redesign.md)

## 项目结构

```text
frontend/                    Next.js Web-first 前端
backend/                     Spring Boot 4 / Java 21 服务
backend/src/main/resources/  配置与 Flyway 数据库迁移
docs/                        产品设计、路线图与交接文档
compose.yaml                 PostgreSQL 17 与 Redis 8 本地服务
```

## 本地运行

Web 前端：

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

基础服务与后端：

```powershell
docker compose up -d
cd backend
.\gradlew.bat bootRun
```

后端从仓库根目录或 `backend/` 目录读取 `.env.local`。该文件已被 Git 忽略，至少可按需设置：

```dotenv
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
TUSHARE_TOKEN=
SMS_API_KEY=
STOCKCAL_NOTES_PATH=C:\Users\Administrator\Documents\Obsidian Vault\印象笔记\股票
```

缺少外部密钥时，确定性计算和本地功能仍可运行；实时行情、生产短信及 OpenAI 提取会明确返回不可用状态，不会伪装成成功。

阿里云部署时必须配置真实行情和同步身份：`TUSHARE_TOKEN`、`STOCKCAL_API_BASE_URL`、`STOCKCAL_AUTH_REQUIRED=true`，并把 GitHub 股票笔记目录挂载为 `/notes`（`STOCKCAL_NOTES_PATH=/notes`）。后端启动会幂等导入笔记，并识别核心高信号文件；网页端使用同一账号登录后可跨设备读取 K 线工作区。

## 验证

```bash
cd frontend
npm test
npm run build

cd ../backend
./gradlew test
```

请以交接说明中的最新验证记录为准。金融计算与预测仍应经过领域专家复核，应用不构成投资建议。
