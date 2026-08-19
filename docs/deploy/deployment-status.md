# StockCal 部署状态记录

> 最后更新：2026-08-20（本次自动部署）

## 已完成 ✅

| 项 | 状态 | 说明 |
|---|---|---|
| 服务器 | 阿里云轻量 2核4G（实际 3.4G 内存），Ubuntu 24.04，公网 IP `8.148.15.76` | |
| Docker | 29.7.2 + Compose v5.5.0，已配置镜像加速（daocloud / 1ms.run / xuanyuan / dockerproxy） | 官方源 `download.docker.com` 被墙，已改用阿里云 Docker CE 镜像 |
| Swap | 2G（编译保险，原为 0） | |
| 代码 | `git clone` 到 `/root/stockcal`，commit `62a8e83` | |
| `.env` | 已生成，数据库强密码已写入（`/root/stockcal/.env`，600 权限） | |
| 后端 | 三容器 healthy，Flyway 迁移 8 个版本，健康检查 `{"status":"UP"}` | |
| 测试 | 后端 35 用例 ✅ / Flutter 180 用例 ✅（本地） | |

## 功能审计与修复（2026-08-20）✅

全接口审计发现并修复两类 PostgreSQL JDBC 类型绑定 bug（H2 测试库测不出，生产 PG 才暴露）：

1. **`Instant` 无法绑定 `timestamptz`** → 知识库导入/抽取、AI 复盘、后台接口 500。改为 `OffsetDateTime`。
2. **`String` 无法绑定 `jsonb`** → 同步接口 500。`sync_change.payload` 迁到 `text`（V9，它本就是整体读写的 JSON 字符串）。

修复后全链路实测通过：行情搜索/快照（Tushare）、同步提交/拉取、知识库导入→AI 抽取规则→草稿、AI 复盘（DeepSeek 真实生成）。

## 待办 / 配置问题（仅剩后续项）⚠️

> ✅ 已解决并验证：防火墙放行 8080、DeepSeek key、Tushare token、公网访问 + 登录冒烟测试（`/auth/request-code` → 202，`/auth/verify` → 200 返回 token）。

1. **【后续】域名 + ICP 备案 + HTTPS** — 备案前先用 `IP:8080` 访问。流程见 `aliyun-production-runbook.md` C 线。

## 备注

- **Spring Security 生成默认密码警告**：启动日志出现 `Using generated security password`，这是 `spring-boot-starter-security` 未定义 `UserDetailsService` 时的默认行为。应用走的是自研 token 认证（access_tokens 表），该默认密码未被实际使用，属无害提示；如需彻底消除可在安全配置里关闭 `UserDetailsServiceAutoConfiguration`。暂记待后续处理。

- **数据库密码位置**：`/root/stockcal/.env` 的 `POSTGRES_PASSWORD`（强随机，未在对话中明文暴露）。查看：`ssh root@8.148.15.76 "grep POSTGRES_PASSWORD /root/stockcal/.env"`。

- **常用运维命令**（在服务器 `/root/stockcal` 下）：
  - 看状态：`docker compose ps`
  - 看日志：`docker compose logs -f app`
  - 重启后端：`docker compose up -d --build`
