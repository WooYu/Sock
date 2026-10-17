# StockCal 当前状态与本地运行

更新时间：2026-10-17（北京时间）。交付仓库：`WooYu/Sock`，分支：`agent/local-first-watchlist`。

## 已完成

| 入口 | 当前功能 |
| --- | --- |
| 首页／K线工作台 | 股票搜索、图表、MA/BOLL、绘图及本地保存 |
| 开始多周期分析 | 日线优先，规律不明确才逐级读取1小时／30分钟；确认后最多多看一级，保留未来三根参考位及计算依据 |
| 跨周期综合结果 | 完整链接1%分组、算术平均；按收盘价与适用涨跌幅保留全部实际计算价，每价标注涨跌百分比 |
| 分析历史／价格核对 | 本地原版本保存、服务器入库回执、失败重试；逐价比较实际开高低收，偏差以实际价为分母、严格小于1% |
| 笔记标签／逐篇学习建议 | 146篇历史笔记、248个原文片段；271条学习主张及原文行号、条件和缺口，研究版本独立保存及选用 |
| 经验库 | 14条手工记录：13条归类为盈利模式，1条股市警示语；分类修订保留旧版本 |
| 学习样本 | 股票、日期、算法／评价版本、候选／确认趋势、笔记及资格筛选；冻结分页、详情与完整证据导出 |
| 后台核对 | PostgreSQL不可覆盖记录、目标日解析、行情修订历史、定时重试与七个自然日复查；Flyway迁移到V16 |

关键口径：接近价位／全部价位与实际四价覆盖／4分别展示；未接近价位也保存。历史回放及盘前截止后才入库的记录保留事后标识，前瞻截止为目标日北京时间09:15。缺日原因未核实则保留待核实状态。

掌阅科技14日收盘回放曾给出30.75、29.75、29.04、28.65、27.69五价，对照15日实际四价为2/5接近、3/4覆盖，最高价未覆盖；它是历史对照，不能当成事前成功。详见[实施验收记录](../../research/zhangyue-scenario-v1/price-evaluation-implementation-validation.md)。

## 本地准备

安装Git、Docker Desktop（或Docker Engine加Compose v2）、JDK21、Node.js22及npm。`java -version`、`node --version`、`docker compose version`应可运行；Docker需要处于启动状态。Python3只用于额外的研究原文核验，不是应用启动条件。

```bash
git clone --branch agent/local-first-watchlist --single-branch https://github.com/WooYu/Sock.git
cd Sock
docker compose -f compose.local.yaml up -d --wait
```

`compose.local.yaml`仅启动PostgreSQL和Redis，默认绑定本机5432和6379端口，数据保存在独立Docker卷中。它使用与后端本地模板一致的开发数据库配置，不需要行情或AI密钥。原`compose.yaml`是完整容器部署入口，包含行情密钥要求，与本地开发入口分开使用。

以下模板只在首次运行时复制。已有`.env.local`应保留并合并需要的设置。

## Windows PowerShell

第一个终端，在仓库根目录启动后端，保持运行：

```powershell
cd backend
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
.\gradlew.bat bootRun
```

另开一个终端，进入该仓库的`frontend`目录：

```powershell
cd frontend
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm ci
npm run dev
```

## macOS／Linux

第一个终端，在仓库根目录启动后端，保持运行：

```bash
cd backend
test -f .env.local || cp .env.example .env.local
bash gradlew bootRun
```

另开一个终端，进入该仓库的`frontend`目录：

```bash
cd frontend
test -f .env.local || cp .env.example .env.local
npm ci
npm run dev
```

首次启动Gradle会下载所需依赖；后端启动时自动执行数据库迁移。JDK必须是21，`JAVA_HOME`需指向自己的JDK目录。仓库中的`/workspace/...`路径和系统CA参数是云环境说明，本地正常安装的JDK不需要照抄。

## 地址和配置

- 应用：`http://localhost:3000`；直接打开掌阅科技：`http://localhost:3000/?symbol=603533`。
- 后端健康：`http://localhost:8080/actuator/health`，应包含`"status":"UP"`。
- 前端健康：`http://localhost:3000/api/health`，应包含`"ok":true`。
- 经验库：`http://localhost:3000/knowledge`；学习样本：`http://localhost:3000/knowledge?view=samples`。

前端模板默认启用`STOCKCAL_RECORDS_API_BASE_URL=http://localhost:8080`，并将`STOCKCAL_API_BASE_URL`留为注释。这样行情使用腾讯公开延时数据，记录保存、逐篇研究和评价通过本机后端。AI和行情供应商密钥都不是这条运行路径的启动条件。公开行情需要本机网络可以访问腾讯行情域名。

本地模板关闭生产账户认证和AI自动提取，使用现有开发设备身份；无需先配置手机短信。独立的旧预测接口可能显示未配置，但图表、多周期情景分析和新记录核对仍可独立使用。公开行情不可用时可先使用首页“用示例体验”；示例数据不入真实预测账本。

若自己已有可用的后端行情供应商，再按需启用`STOCKCAL_API_BASE_URL`及后端供应商密钥。生产配置应继续使用原有账户认证和部署文档。

## 本地使用顺序

1. 打开掌阅科技，点击“开始多周期分析”，先读取日线，人工核对趋势、葛起点和盈利模式后再决定是否下钻。
2. 保存分析快照，检查“分析历史”的服务器入库状态；失败可重试原版本。
3. 查看已入库历史版本，使用“立即核对实际四价”；尚无完整目标日时显示待核对。
4. 到“笔记标签 → 逐篇学习建议”阅读原文／缺口；保存研究建议、选为后续依据，再保存新分析以绑定精确版本。
5. 在经验库筛选“手工记录”，搜索“盈利模式”或“股市警示语”；在学习样本中查看冻结记录并导出。

仓库会带回源代码、内置笔记、盈利模式、警示语和研究证据。云实例数据库中的记录以及原浏览器的本地存储不会随Git复制；新本地数据库最初没有你此前保存的分析。旧浏览器里的标签／绘图／经验修订及分析历史，请先使用各页面导出功能另行备份。

## 常见问题

- **端口被占用**：先检查已有PostgreSQL、Redis、8080或3000服务。数据库端口可以用`STOCKCAL_LOCAL_POSTGRES_PORT`、`STOCKCAL_LOCAL_REDIS_PORT`调整Compose映射，同时修改`backend/.env.local`的`DATABASE_URL`／`REDIS_PORT`。后端或前端改端口时也相应修改记录服务地址。
- **行情502／预测未配置**：先检查前端是否意外启用了`STOCKCAL_API_BASE_URL`。无供应商密钥的本地流程仅设置独立记录服务地址；修改配置后重启Next。
- **记录服务不可用**：先打开后端健康地址，确认数据库、Redis和Flyway启动日志；本地先保存，待连接恢复后重试原版本。
- **数据库连接失败**：执行`docker compose -f compose.local.yaml ps`，核对后端模板与本地容器的地址、端口和数据库设置。
- **停止应用**：两个运行终端分别按Ctrl+C，数据库服务可用`docker compose -f compose.local.yaml stop`停止并保留数据卷。

## 验证与现阶段边界

提交前复验命令及结果记录在本页末尾的交付检查中。开发时常用：

```bash
# frontend/
npm test
npm run lint
npm run build

# backend/
bash gradlew test
```

Windows后端命令换为`.\gradlew.bat test`。真实PostgreSQL专项脚本`backend/scripts/test-scenario-postgres.sh`依赖Bash和Docker，通过随机schema隔离数据；需要对应容器名时设置`SCENARIO_TEST_POSTGRES_CONTAINER`。默认普通后端测试会跳过PG条件用例，不能将跳过项算为实际PG通过。

53篇相关附件仍未核对；新AI主张和警示语效果保持待验证。盘中反复支撑／压力还需要分钟数据证据；日线四价接近不能替代。当前已经建立候选研究和样本积累流程，自动学习、自动晋级新公式尚未启用。

### 交付检查

本次提交前在Linux云实例复验，使用系统Chromium；Windows／macOS命令未在对应操作系统实机执行。

| 检查 | 结果 |
| --- | --- |
| 前端 `npm test` | 78个文件、602项通过 |
| 前端lint／生产build | 均通过，包含TypeScript检查 |
| 后端完整test／bootJar | 85项通过；13项PG条件测试在正常profile中跳过，另行实际执行 |
| 真实PostgreSQL专项 | 13项全部执行并通过；使用新建本地Compose容器和随机schema |
| 桌面／手机浏览器回归 | 情景分析、标签、研究记录与经验库共24项通过；本轮使用固定行情响应，未把未运行的`@real`行情测试算作通过 |
| 空数据库首次启动 | 新建PostgreSQL／Redis卷、V1–V16迁移、Java／Next健康检查均通过 |
| 实际BFF与新数据库 | 预测保存／读取、重复保存返回原回执、原文引用解析、学习样本查询通过 |
| 原研究校验 | 146篇／271条主张、1863次引文核验和生成器`--check`通过 |
| 提交文件检查 | `git diff --check`及凭据模式检查通过；环境文件、依赖目录和临时测试产物排除 |

浏览器插件未提供，因此复用现有Playwright和已安装的Chromium，没有安装额外浏览器。最初PG专项默认指向已停止的旧容器；改用本轮创建的独立Compose实例后13项实际执行通过，旧容器和数据未改动。临时验证进程与数据卷在交付后清理，既有实例不受影响。
