# StockCal 阿里云上线手册

从"本地能跑"到"手机随时连上"的完整步骤。分成两条主线：

- **A 线：后端上线**（阿里云 + Docker），让手机能访问到服务。
- **B 线：App 打包**（debug APK），装上手机即可用。

> 验证码固定 `000000`（后端日志会打印），无需短信供应商。AI 默认 DeepSeek，可切 OpenAI。行情用 Tushare（可选）。

---

## 0. 前置条件（你手头应具备）

- 一个域名（你已有）。
- DeepSeek API key（已提供，**建议之后在 DeepSeek 后台轮换一次**，因为该 key 曾出现在对话里）。
- 一个手机号可用的阿里云账号（用于买服务器 + ICP 备案实名）。

---

## A 线：后端上线

### A1. 购买阿里云服务器

1. 登录阿里云，进入「**轻量应用服务器**」（Simple Application Server，比 ECS 便宜、适合个人）。
2. 地域选**大陆**（如华东 1/华北 2）——你要备案就必须是大陆节点。
3. 镜像选 **Ubuntu 22.04 或 24.04**（LTS）。
4. 规格：2 核 2G 起步即可（Spring Boot + Postgres + Redis 个人用足够）。
5. 购买后记下 **公网 IP**。

> 备案提示：购买时留意该规格是否支持 ICP 备案（轻量应用服务器大陆节点目前支持，购买页会标注）。

### A2. 放行端口（防火墙/安全组）

在轻量服务器的「防火墙」页添加规则，放行：

| 端口 | 用途 | 阶段 |
|---|---|---|
| 22 | SSH 登录 | 立即 |
| 8080 | 后端 API（备案前先用 IP:8080） | 立即 |
| 80 / 443 | HTTP / HTTPS（备案后绑域名用） | 备案后 |

### A3. 安装 Docker 并拉代码

SSH 登录服务器（Windows 可用 PowerShell 的 `ssh root@<公网IP>`），执行：

```bash
# 安装 Docker（官方脚本，Ubuntu）
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

# 拉取代码
git clone https://github.com/WooYu/Sock.git stockcal
cd stockcal
```

### A4. 配置环境变量

```bash
cp .env.example .env
vi .env          # 或 nano .env
```

至少填这几个：

```dotenv
POSTGRES_PASSWORD=改成强密码
AI_API_KEY=sk-你的DeepSeek密钥
STOCKCAL_AI_BASE_URL=https://api.deepseek.com
STOCKCAL_AI_MODEL=deepseek-chat
# 可选：TUSHARE_TOKEN=你的Tushare令牌
```

> `.env` 已被 `.gitignore` 忽略，**不会提交到仓库**。

### A5. 启动

```bash
docker compose up -d --build
docker compose ps          # 三个服务 postgres / redis / app 都应为 running
curl http://localhost:8080/actuator/health   # 应返回 {"status":"UP"}
```

首次 `--build` 会下载依赖并编译，需几分钟；之后更新代码用 `docker compose up -d --build` 即可。

### A6. 冒烟测试（在服务器上或本机均可）

```bash
# 1. 请求验证码（返回 202，且后端日志打印 code=000000）
curl -i -X POST http://<公网IP>:8080/api/v1/auth/request-code \
  -H 'Content-Type: application/json' -d '{"phone":"13800138000"}'

# 2. 用 000000 验证，拿到 accessToken
curl -i -X POST http://<公网IP>:8080/api/v1/auth/verify \
  -H 'Content-Type: application/json' \
  -d '{"phone":"13800138000","code":"000000","deviceName":"test"}'
```

---

## B 线：App 打包（debug APK）

在**本地**（装了 Flutter 和 Android SDK 的机器）执行：

```powershell
# 备案前：指向服务器 IP（明文 HTTP，manifest 已放开明文流量）
flutter build apk --debug --dart-define=STOCKCAL_API_URL=http://<公网IP>:8080

# 备案并配好 HTTPS 后：指向域名
flutter build apk --debug --dart-define=STOCKCAL_API_URL=https://<你的域名>
```

产物在 `build/app/outputs/flutter-apk/app-debug.apk`，传到手机安装即可（debug 包用默认 debug 签名，可直接装）。

---

## C 线：域名 + ICP 备案 + HTTPS（备案后做）

### C1. DNS 解析

阿里云「云解析 DNS」里给你的域名加一条 **A 记录**：

- 主机记录：`@`（或 `app` 之类子域名）
- 记录值：服务器公网 IP

### C2. ICP 备案（必须，1–4 周）

在阿里云「ICP 备案」系统提交：

1. 域名已完成实名认证。
2. 用大陆服务器 + 域名提交备案，填写主体信息（个人/企业）与网站信息。
3. 上传证件、人脸核验、接阿里云电话核验。
4. 等待管局审核（通常 1–4 周）。**备案通过前，域名 80/443 端口不能对外提供 Web 服务**（这就是为什么先用 IP:8080）。

> 提示：备案期间手机先连 `http://IP:8080` 使用，功能完全正常，只是地址是 IP。

### C3. HTTPS（备案通过后）

推荐用 Caddy 自动签发并续期 Let's Encrypt 证书。在服务器上新增 `Caddyfile`：

```caddyfile
<你的域名> {
    reverse_proxy localhost:8080
}
```

并加一个 Caddy 服务（或独立 `docker run -d -p 80:80 -p 443:443 -v $PWD/Caddyfile:/etc/caddy/Caddyfile caddy`）。之后 App 重新用 `https://<域名>` 打包即可，并可移除 manifest 里的明文流量开关。

---

## AI 供应商切换（重启生效）

改 `.env` 里这三项，然后 `docker compose up -d`（不重建也行，环境变量变化后需 `docker compose up -d` 重载）：

| 供应商 | STOCKCAL_AI_BASE_URL | STOCKCAL_AI_MODEL |
|---|---|---|
| DeepSeek（默认） | `https://api.deepseek.com` | `deepseek-chat` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |

`AI_API_KEY` 换成对应供应商的 key。

---

## Tushare 行情令牌（可选）

1. 打开 https://tushare.pro 注册并登录。
2. 「个人主页 → 接口 TOKEN」复制你的 token，填入 `.env` 的 `TUSHARE_TOKEN=`。
3. 新账号积分低，基础日线接口可用；更高权限接口需攒积分（签到/任务/充值）。
4. 未配置时行情接口按设计返回"不可用"，其余本地与 AI 功能不受影响。

---

## 常见问题

- **`docker compose ps` 里 app 一直 restarting**：看 `docker compose logs app`，多为数据库未就绪或 `.env` 未填。
- **手机连不上 `http://IP:8080`**：检查 A2 防火墙是否放行 8080。
- **验证码收不到**：设计如此——验证码固定 `000000`，看后端日志 `docker compose logs app | grep code=`.
- **AI 报"服务尚未配置"**：`.env` 里 `AI_API_KEY` 为空。
