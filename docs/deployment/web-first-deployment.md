# StockCal Web-first 部署说明

## 现有阿里云实例更新

2026-10-29 只读检查：现有后端位于 `/root/stockcal`，由 `stockcal-app-1`、`stockcal-postgres-1`、`stockcal-redis-1` 和独立标签工作器组成；前端位于 `/home/admin/stockcal-domestic`，由 `stockcal-web-web-1` 运行。实际后端运行时使用额外 Compose 文件，更新时须保留它们。部署前重新核对，不能假设这些状态永远不变。

**安全前提：**检查时后端 `STOCKCAL_AUTH_REQUIRED=false`，8080、5432、6379 监听所有网卡。监听公网不等于安全组实际开放，但必须在阿里云安全组和主机防火墙核对：数据库和 Redis 不对公网开放，后端只允许确需访问的受信来源；修改前确认不会切断现有生产访问。认证、短信与访问控制没有经过生产验证之前，不要把前端公开到互联网。以下先用 SSH 隧道访问；HTTPS 域名和适用备案需另行配置。

### 备份与检查

通过 SSH 登录服务器，以下命令以 root 身份运行。先确认当前路径无未提交源码改动，并保存现有镜像与 PostgreSQL 备份：

```bash
git -C /root/stockcal status --short
sudo -u admin git -C /home/admin/stockcal-domestic status --short
umask 077
BACKUP="/root/stockcal-backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP"
git -C /root/stockcal rev-parse HEAD > "$BACKUP/backend-revision.txt"
sudo -u admin git -C /home/admin/stockcal-domestic rev-parse HEAD > "$BACKUP/frontend-revision.txt"
docker exec stockcal-postgres-1 sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$BACKUP/postgres.dump"
test -s "$BACKUP/postgres.dump" && docker exec -i stockcal-postgres-1 pg_restore -l < "$BACKUP/postgres.dump" > /dev/null
cp -p /root/stockcal/.env "$BACKUP/backend.env"
docker tag "$(docker inspect --format '{{.Image}}' stockcal-app-1)" "stockcal-app:rollback-$(basename "$BACKUP")"
docker tag "$(docker inspect --format '{{.Image}}' stockcal-web-web-1)" "stockcal-web:rollback-$(basename "$BACKUP")"
```

如果 `git status` 有改动、备份命令失败或数据库备份校验失败，停止更新并先处理原因。备份包含敏感信息，保持 root 权限并另行做好异机备份；不要把备份或 `.env` 提交到 Git。

### 更新后端

后端目录当前为游离提交；以下先确认新提交是当前版本的后继，避免覆盖服务器独有历史。确认该命令输出 `fast-forward OK` 后再继续：

```bash
cd /root/stockcal
git fetch origin agent/local-first-watchlist
git merge-base --is-ancestor HEAD FETCH_HEAD && echo 'fast-forward OK'
```

```bash
git switch --detach FETCH_HEAD
REV=$(git rev-parse --short HEAD)
mkdir -p /root/stockcal-deploy
printf 'services:\n  app:\n    image: stockcal-app:deploy-%s\n' "$REV" > /root/stockcal-deploy/app-image.yaml
docker compose -f compose.yaml -f /root/stockcal-tag-release-20261020/compose.tags.yaml -f /root/stockcal-tag-worker/runtime.compose.yaml -f /root/stockcal-deploy/app-image.yaml up -d --no-deps --build app
docker ps --filter name=stockcal-app-1
curl -fsS http://127.0.0.1:8080/actuator/health
```

最后的镜像覆盖文件避免覆盖现有运行时文件中固定的旧镜像标签。后端重启时 Flyway 可能执行数据库迁移；不要删除数据库卷，镜像回退本身也不会回退数据库迁移。

### 更新前端

前端仓库归 `admin` 所有；若状态干净，使用快进更新，不覆盖已有配置：

```bash
sudo -u admin git -C /home/admin/stockcal-domestic fetch origin agent/local-first-watchlist
sudo -u admin git -C /home/admin/stockcal-domestic merge --ff-only FETCH_HEAD
cd /home/admin/stockcal-domestic
STOCKCAL_API_BASE_URL=http://host.docker.internal:8080 STOCKCAL_RECORDS_API_BASE_URL=http://host.docker.internal:8080 docker compose -f compose.domestic.yaml up -d --build web
docker ps --filter name=stockcal-web-web-1
curl -fsS http://127.0.0.1:3000/api/health
docker exec stockcal-web-web-1 wget -qO- http://host.docker.internal:8080/actuator/health
```

此命令仅供后端位于同一宿主机且 8080 容器端口可从宿主机网关访问的情况。两个变量不会自动写入环境文件；每次重建或重新创建前端容器时需重新提供，或安全地加入已有 `.env`。不同网络拓扑应使用后端实际可达地址，不要用容器内 `localhost`。上述步骤不会改变 Vercel 现有生产入口。

从自己的 Windows 电脑保持 SSH 会话：

```powershell
ssh -L 13000:127.0.0.1:3000 服务器用户名@服务器公网IP
```

浏览器访问 `http://127.0.0.1:13000`，核对登录、现有记录和 A50。若网页健康但东方财富请求失败，应检查容器内到东方财富的网络；数据源曾间歇性关闭连接，不能以本机浏览器访问成功代替服务器验证。

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
