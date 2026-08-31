# StockCal

StockCal 是一个面向手机浏览器和桌面浏览器的 A 股决策与复盘工具。Next.js Web 前端负责交互，Spring Boot 服务负责认证、同步、行情、知识提取、AI 调用与管理能力；现有 Flutter 工程保留作迁移参考。

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
- 数据归档、恢复、备份、管理视图、审计和服务状态

完整设计与阶段状态见：

- [生产设计](docs/superpowers/specs/2026-08-14-stockcal-production-design.md)
- [实施路线图](docs/superpowers/plans/2026-08-14-stockcal-production-roadmap.md)
- [当前交接说明](docs/handoff/2026-08-14-stockcal-current-status.md)
- [Web-first 设计](docs/superpowers/specs/2026-08-26-stockcal-prototype-realignment-design.md)
- [Web-first 实施计划](docs/superpowers/plans/2026-08-27-stockcal-web-first-plan.md)

## 项目结构

```text
lib/                         Flutter 客户端
test/                        Flutter 单元与组件测试
frontend/                    Next.js Web-first 前端
backend/                     Spring Boot 4 / Java 21 服务
backend/src/main/resources/  配置与 Flyway 数据库迁移
docs/                        产品设计、路线图与交接文档
compose.yaml                 PostgreSQL 17 与 Redis 8 本地服务
```

## 本地运行

客户端：

```powershell
flutter pub get
flutter run -d chrome --dart-define=STOCKCAL_API_BASE_URL=http://localhost:8080
```

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

## 验证

```powershell
flutter test
flutter analyze
flutter build web --release
cd backend
.\gradlew.bat test
```

请以交接说明中的最新验证记录为准。金融计算与预测仍应经过领域专家复核，应用不构成投资建议。
