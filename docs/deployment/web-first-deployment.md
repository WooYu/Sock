# StockCal Web-first 部署说明

## 不依赖 Vercel 的国内部署

可在能访问腾讯行情的国内 Linux 服务器运行 Next.js，浏览器无需访问 Vercel。安装 Docker 和 Compose，在仓库根目录执行：

```bash
docker compose -f compose.domestic.yaml up -d --build
curl -fsS http://127.0.0.1:3000/api/health
```

容器只监听服务器回环地址。使用 Nginx 或负载均衡将已配置 HTTPS 的域名反向代理到 `127.0.0.1:3000`；公网入口需配置访问控制、请求大小限制和限流。域名、证书、国内服务器网络及适用的备案要求需要自行准备，部署代码本身不会生成公网地址或保证可访问性。更新代码后重新执行上述 Compose 命令。

默认使用腾讯公开延时行情，不需要 Tushare 密钥或后端。自选、绘图等本地数据仍保存在各浏览器；跨设备共享、账号及研究记录需要现有后端和数据库。需要时在服务器环境或根目录 `.env` 中设置 `STOCKCAL_RECORDS_API_BASE_URL` 指向可从容器访问的后端地址（容器内 `localhost` 不是宿主机），并确保后端启用认证、保护数据库及备份。只有后端行情供应商已配置时才设置 `STOCKCAL_API_BASE_URL`，否则留空。密钥只放服务端，不提交 `.env`。现有 Vercel 部署和生产数据不会自动迁移或关闭。

腾讯不可用时会尝试东方财富；配置后端后还可回退到 Tushare 短窗口不复权日线。实际可用性需从服务器内的 Node 进程验证，不能仅依据本地电脑或浏览器的访问结果。Tushare 不提供本项目的复权及分钟线回退，也不支持现有指数代码。

中证1000可搜索“中证1000”或 `sh000852`，指数行情不复权。指数分析记录目前仅保存在本机，现有后端研究记录接口尚不接受指数代码。

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
