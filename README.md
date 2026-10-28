# StockCal

本地开发统一使用 `E:/Code_Tool/StockCal`，日常开发与发布使用 `agent/local-first-watchlist` 分支。旧的 `StockCal-deploy-tags`、`StockCal-deploy-kline`、`StockCal-taxonomy` 为临时 Git worktree，已整合；对应分支提交历史保留。后续仅在确需并行隔离时临时创建 worktree，完成后用 `git worktree remove` 清理。环境配置、验证截图与规划记录只在本地保存，不纳入源码发布。

部署拓扑（用户于2026-09-16确认）：**前端部署在Vercel，后端部署在阿里云**。生产前端项目为Vercel的`frontend`，关联`WooYu/Sock`，入口为`https://frontend-xi-nine-18.vercel.app`。排查线上问题应检查Vercel生产配置、实际部署提交和阿里云服务，不应以本机缺少环境变量或8080端口未启动推断线上后端不可用。

无需 Vercel 的国内服务器自托管方案见[部署说明](docs/deployment/web-first-deployment.md)。该方案需要自行部署服务器和 HTTPS 入口，不会自动替换现有线上地址。行情支持上证指数及中证1000，搜索“中证1000”或 `sh000852` 可查看。

2026-09-16只读检查：Vercel生产版本为`f68c014`（9月9日部署）；线上行情和规则接口返回200，预测接口返回上游404，路径`/api/v1/market/stocks/300502/prediction`。仓库代码已有该路由，需核对阿里云运行版本及反向代理；这不是已经验证的“线上未配置后端地址”。本轮新工作台、经验研究库和多周期行情修改仍需独立发布才会出现在生产版本。

首页与 `/chart` 现在进入 **K 线研究工作台**：页内选股、自选与最近查看、绘图工具、未来三个交易日的价格和 MA/BOLL、笔记规则及历史相似走势集中在同一页面。交互设计见 [研究工作台设计](docs/superpowers/specs/2026-09-15-kline-research-studio-design.md)。

本地启动前端后访问 `http://localhost:3000`。行情服务暂不可用时，可以点击“用示例体验”，或访问 `/?example=1`；示例明确使用合成数据和独立的 DEMO 绘图空间，只保存在本机，不会作为真实行情或上传到账户。当前 `baseline-v1` 是近 20 日价格趋势推演，笔记规则用于独立校验，不代表已经提高预测准确率。

图表现支持MA5、10、20、30、60、90、120、250，以及分时、1/5/15/30分钟、1/2小时、日/周/月/季/年线。MA按当前周期根数计算，历史不足留空；股票分时展示价格与均价，指数不绘制均价。股票日线默认前复权，指数和分钟行情不复权。预测服务独立配置，当前仍是日线未来3交易日。详见[周期与均线口径](docs/superpowers/specs/2026-09-16-market-chart-periods.md)及[下一阶段预测方案建议](docs/superpowers/specs/2026-09-16-forecast-recommendation.md)。

行情搜索、报价及图表按腾讯、东方财富、已配置的后端顺序尝试，界面分别标注报价与图表的实际来源及价格口径。公开行情属于延时数据，服务可能因网络或供应商限制而不可用。现有 Tushare 后端仅提供短窗口不复权日线，不支持指数、分时、分钟线或复权回退；缺少兼容数据时明确报错，不拼接不同来源或伪造复权。后端地址由 `STOCKCAL_API_BASE_URL` 配置；不配置时跳过最后一级。研究记录服务仍可单独配置 `STOCKCAL_RECORDS_API_BASE_URL`。

搜索 `A50` 或 `CN00Y` 可选东方财富“A50期指当月连续”（104.CN00Y），与国证A50、富时现货指数及其他CFD产品分开；仅使用东方财富数据，成交量单位为手。现支持报价和日线（日线聚合周、月、季、年），不支持夜盘分时、分钟线及基于A股日历的推演；日K可能未完成，换月口径以数据源为准。

`/knowledge` 是经验与原则研究库：已纳入最新140篇股票笔记的语义解析、64个归并主题及14条手动经验，支持原文核对、解释修正、不可覆盖版本、手动记录与JSON导出。2026-10-17补充的13条[盈利模式](notes/用户补充/盈利模式.md)保留完整原话和分类修订历史，另单独收录[股市警示语](notes/用户补充/股市警示语.md)；在“记录来源：手工记录”下搜索“盈利模式”或“股市警示语”可查看。`/knowledge?view=backtest` 展示新易盛近三年真实行情回测证据；[完整报告和可复跑笔记本](research/2026-09-16-xinyisheng/README.md)保留来源、方法、逐日预测账本和边界。研究版“走势+经验”尚未证明收盘预测优势，没有据此自动替换生产预测或启用交易。

`/knowledge?view=notes` 是笔记标签目录，覆盖当前146篇 Markdown 和248个有原文依据的片段，并补入旧研究未覆盖的6篇笔记。支持按内容类型、主题、用途、周期、适用范围、数据依赖与可计算性组合筛选；标签可修订、确认、查看历史和导出。自动标签是候选分类，解释确认、计算定义和预测效果分别管理；两个仅有元数据的文件以及未读取的附件明确保留待补原因。

工作台选中掌阅科技（603533）后，点击图表下“开始多周期分析”，先用日线核对方向、攀升／飙升、葛起点与盈利模式；规律不明确时再逐级查看1小时、30分钟，规律明确后最多额外核对一个下级周期，比较前三后三增量外推及收盘情景滚动MA/BOLL。未收盘柱单列暂估；风险底线保留所属周期。保存快照时先保留本地原版本，再向记录服务入库；历史只读并可导出。交易日历未核实时保留相对根数，不推算节假日。真实行情冻结输入、单例事后指标误差及使用步骤见 [掌阅科技首版证据](research/zhangyue-scenario-v1/README.md)，尚无策略胜率或盈利证明。

“跨周期综合结果”仅汇总本次实际采用周期的未来参考位，默认只有日线；组内最高与最低价的相对差不超过1%时，合为算术平均价，较远的价位保留为多组。启动只读取日线，随后用“看1小时”“继续看30分钟”按需逐级加载；确认趋势和盈利模式后停止，最多再核对下一级，不会自动加载所有周期。每组保留原价、周期、指标和未来根数来源。当前方法及各周期条件路径随新快照冻结，旧快照保留原值。

综合结果以最近完整日K收盘价为基准，按所选单日涨跌幅筛选，上下分别展示全部实际计算的MA/BOLL合并价，每个价格标注涨跌百分比。数量由计算结果决定，没有有效价位的一侧显示为空。越界原值可展开核对。普通板块规则按代码推定，特殊状态或交易日需核实并手动调整；新快照冻结基准、规则和全部计算价位，旧版本按原值保留。

标签目录单独存放于 `frontend/src/features/knowledge/note-tag-catalog.json`，原始笔记保持不变。在 `frontend/` 运行 `npm run notes:tags` 可重新生成目录与摘要；命令使用当前本地提交和内容哈希，并核对旧解析的引文。标签修订保存在当前浏览器的独立存储中，原有经验记录继续保留；建议使用“导出标签与历史”备份。

“笔记标签 → 逐篇学习建议”可逐篇查看146篇笔记的文字依据、271条计算主张、适用／失效条件和定义缺口；53篇带有未核对附件。点击“保存研究建议”保存独立研究版本，再“选为后续分析依据”，下一次保存分析会绑定该版本及原文哈希。人工标签v2/v3继续保留；选用解释不会自动启用候选公式，效果均为未测试。

在“分析历史”中查看已入库版本，点击“立即核对实际四价”；后台也会独立定时采集后续首根完整日K。每个计算价对实际开高低收分别计算 `abs(计算价−实际价)/实际价`，严格小于1%才接近，精确到分另计；全部未接近价格也保留。“接近价位/全部价位”和“四价覆盖/4”分别展示。`/knowledge?view=samples` 的“学习样本”可筛选、分页、查看冻结输入和导出评价、行情来源及笔记版本。历史回放或目标日09:15后才入库的记录只作事后对照；缺日未核实和采集失败明确保留状态。

当前阶段已实现持久化、自动核对和研究样本积累。掌阅科技14日回放的5个价格中，2个接近15日实际四价，覆盖3/4，最高价未覆盖；这是单次事后对照。盘中反复支撑／压力尚需分钟行情验证，AI持续归纳和新公式的自动晋级仍待后续独立验证。[实现与验收记录](research/zhangyue-scenario-v1/price-evaluation-implementation-validation.md)保留完整检查范围。

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

- [当前交付与本地运行（2026-10-17）](docs/handoff/2026-10-17-stockcal-local-run.md)
- [生产设计](docs/superpowers/specs/2026-08-14-stockcal-production-design.md)
- [实施路线图](docs/superpowers/plans/2026-08-14-stockcal-production-roadmap.md)
- [早期交接说明](docs/handoff/2026-08-14-stockcal-current-status.md)
- [Web-first 设计](docs/superpowers/specs/2026-08-26-stockcal-prototype-realignment-design.md)
- [Web-first 实施计划](docs/superpowers/plans/2026-08-27-stockcal-web-first-plan.md)
- [K 线与未来推演重设计](docs/superpowers/specs/2026-09-07-kline-drawing-prediction-redesign.md)

## 项目结构

```text
frontend/                    Next.js Web-first 前端
backend/                     Spring Boot 4 / Java 21 服务
backend/src/main/resources/  配置与 Flyway 数据库迁移
docs/                        产品设计、路线图与交接文档
docs/archive/flutter/        历史 Flutter 工作记录
notes/                       股票笔记原文，供知识导入使用
research/                    回测脚本、数据来源及研究证据
compose.yaml                 PostgreSQL 17 与 Redis 8 本地服务
```

## 本地运行

准备Node.js22、JDK21和已启动的Docker。先拉取`agent/local-first-watchlist`分支，按照[当前状态与本地运行指南](docs/handoff/2026-10-17-stockcal-local-run.md)启动；指南包含Windows PowerShell和macOS／Linux命令。

仓库根目录先启动本地数据库服务：

```bash
docker compose -f compose.local.yaml up -d --wait
```

后端终端（Linux／macOS；Windows用`.\gradlew.bat bootRun`）：

```bash
cd backend
cp .env.example .env.local
bash gradlew bootRun
```

前端另开终端：

```bash
cd frontend
cp .env.example .env.local
npm ci
npm run dev
```

模板只在首次运行时复制；已有环境文件应保留并合并设置。默认前端用腾讯公开行情，独立连接本机研究记录服务；后端关闭AI自动提取，运行这条路径无需填写AI或行情密钥。访问`http://localhost:3000`。原`compose.yaml`保留用于完整容器部署，包含供应商密钥要求。

后端从仓库根目录或 `backend/` 目录读取 `.env.local`。该文件已被 Git 忽略，至少可按需设置：

```dotenv
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
TUSHARE_TOKEN=
SMS_API_KEY=
STOCKCAL_NOTES_PATH=C:\Users\Administrator\Documents\Obsidian Vault\印象笔记\股票
```

缺少外部密钥时，确定性计算和本地功能仍可运行；实时行情、生产短信及 OpenAI 提取会明确返回不可用状态，不会伪装成成功。

公开行情模式可以单独连接研究记录服务。在 `frontend/.env.local` 设置以下非公开变量并重启Next；保留原有环境文件的其他配置：

```dotenv
STOCKCAL_RECORDS_API_BASE_URL=http://127.0.0.1:8080
```

它优先于原 `STOCKCAL_API_BASE_URL`，仅代理研究记录接口；未设置时回退原地址。使用腾讯公开行情且本地后端没有行情密钥时，让 `STOCKCAL_API_BASE_URL` 保持未设置。前端会通过同源BFF附带当前账户或开发设备身份。后端需先执行Flyway V15／V16，新增三张研究表和稳定分页的可见性字段而不改原业务表；开发实例使用原项目开发身份模式，生产继续使用账户认证。

后端 `STOCKCAL_SCENARIO_JOBS_ENABLED` 默认 `true`，每15分钟扫描到期记录；失败按15／30／60分钟递增重试，最长6小时；首次成功后自动复查7个自然日，之后仍可手动核对。可通过 `STOCKCAL_SCENARIO_SCAN_MS`、`STOCKCAL_SCENARIO_RETRY_BASE_SECONDS`、`STOCKCAL_SCENARIO_RETRY_MAX_SECONDS` 调整。定时核对依赖后端与数据库运行，无需浏览器保持打开。检查健康接口、对应记录的评价历史和采集状态排错；未入库时使用“重试入库原版本”，不要重新生成来替换旧证据。

当前云实例的Java命令需要系统CA信任参数 `-Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts`。Linux中Gradle脚本若无执行位，使用 `JAVA_HOME=/workspace/toolchains/java21 GRADLE_USER_HOME=/workspace/.cache/gradle bash gradlew --max-workers=4 test bootJar`。保留平台代理设置；不要通过关闭TLS验证解决行情连接问题。

阿里云部署时必须配置真实行情和同步身份：`TUSHARE_TOKEN`、`STOCKCAL_API_BASE_URL`、`STOCKCAL_AUTH_REQUIRED=true`，并把 GitHub 股票笔记目录挂载为 `/notes`（`STOCKCAL_NOTES_PATH=/notes`）。后端启动会幂等导入笔记，并识别核心高信号文件；网页端使用同一账号登录后可跨设备读取 K 线工作区。

## 验证

```bash
cd frontend
npm test
npm run lint
npm run build

cd ../backend
./gradlew test
```

研究数据库专项验证在 `backend/` 运行 `bash scripts/test-scenario-postgres.sh`，复用开发PostgreSQL并创建／清理独立测试schema。浏览器验证在 `frontend/` 运行 `npm run test:e2e -- e2e/scenario-research.spec.ts e2e/scenario-analysis.spec.ts e2e/note-tags.spec.ts`。可用 `PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium` 复用系统浏览器；`SCENARIO_REAL_RESEARCH=true` 仅在已准备独立测试后端／数据库的集成环境中设置，详见验收记录。逐篇学习原文核验使用 `npm run notes:study -- --check`，只检查而不重建历史研究结论。

请以交接说明中的最新验证记录为准。金融计算与预测仍应经过领域专家复核，应用不构成投资建议。

### 全账号共享与多端同步

业务数据由所有账号共享：自选、研究日志、图表标注、推演记录、笔记研究与标签、交易及复盘。身份验证和设备凭证仍独立管理。已有后端历史数据直接共享读取，注销账号不会删除共享业务记录。

网页每3秒同步本机业务修改，图表每5秒同步；学习样本首页、笔记研究版本和规则每10秒刷新。断网修改保存在本机，联网后重试。历史冻结记录合并保留；同一可修改字段的并发编辑以最后成功保存的内容为准。已有本机数据需在原设备打开新版页面，连接后才能上传供其他设备查看。

前后端需同时更新，后端自动执行Flyway V17，新增共享写入锁和交易ID唯一索引；历史重名交易重新分配确定性ID并保留每条记录。
