# StockCal Web

StockCal 的 Web-first 前端，使用 Next.js App Router 和 TypeScript，面向手机浏览器与桌面浏览器。

## 本地运行

```bash
npm ci
cp .env.example .env.local
npm run dev
```

默认访问 http://localhost:3000。模板通过`STOCKCAL_RECORDS_API_BASE_URL`连接本机研究记录后端，并使用腾讯公开行情。仅在后端行情供应商已配置时启用`STOCKCAL_API_BASE_URL`；行情和AI密钥只配置在后端。数据库、后端与Windows启动步骤见[本地运行指南](../docs/handoff/2026-10-17-stockcal-local-run.md)。已有`.env.local`应保留并合并设置。

## 验证

```bash
npm run lint
npm run test
npm run build
```

Playwright 使用 `npm run test:e2e`，默认自动启动本地开发服务；也可通过 `PLAYWRIGHT_BASE_URL` 指向已运行的服务。

## 部署

当前生产拓扑为 **Vercel 前端 + 阿里云 Spring Boot 后端**。Vercel 项目根目录设为 `frontend`，通过服务端环境变量 `STOCKCAL_API_BASE_URL` 连接后端；密钥不得写入 `NEXT_PUBLIC_*` 变量。Docker standalone 镜像用于可选自托管部署。

路由统一位于 `app/`，业务模块位于 `src/features/`，共享代码位于 `src/shared/`。不要同时新增 `src/app/`：根级 `app/` 存在时 Next.js 会忽略它。部署说明见 [Web-first 部署文档](../docs/deployment/web-first-deployment.md)。
