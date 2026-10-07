# StockCal Web-first 部署说明

## 运行边界

- 当前生产前端部署在 Vercel，项目根目录为 `frontend`，连接 `WooYu/Sock`；生产入口为 `https://frontend-xi-nine-18.vercel.app`。此拓扑于 2026-09-16 确认。
- 阿里云服务器运行 PostgreSQL、Redis、Spring Boot API，以及需要自托管时的 Next.js standalone 容器。
- Vercel 不替代阿里云数据库或后端；当前不需要购买 Vercel Pro。只有在团队协作、并发构建、企业治理或用量超过免费额度时再评估升级。

## Vercel 项目变量

在 Vercel Project Settings → Environment Variables 配置：

```text
STOCKCAL_API_BASE_URL=https://api.example.com
```

生产环境必须使用 HTTPS，并在后端配置允许的前端域名、认证回调和 CORS。不要把 `AI_API_KEY`、`TUSHARE_TOKEN` 或数据库密码暴露为 `NEXT_PUBLIC_*` 变量。

## 阿里云后端部署

在仓库根目录准备 `.env` 后运行：

```bash
docker compose up -d --build postgres redis app
```

通过 Nginx 或阿里云负载均衡将 `api.example.com` 转发到 `app:8080`。发布前检查：

```bash
curl -fsS http://127.0.0.1:8080/actuator/health
```

首次上线仍需补充域名、TLS、备份、日志和密钥轮换；这些不是 Vercel 自动提供的能力。

如选择自托管前端，再启动 `docker compose up -d --build web`，将前端域名转发到 `web:3000`，并检查 `http://127.0.0.1:3000/api/health`。Spring Boot 不再捆绑旧 Flutter 网页，浏览器应访问 Next.js 前端。
