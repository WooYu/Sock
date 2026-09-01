# 真实数据、规则知识库与 K 线同步交接

## 本次变更

- 首页和总览改用真实行情快照；默认代码为 `600519`。
- 无真实行情源时返回不可用状态，不再使用离线样例 Provider 作为生产回退。
- 删除页面级“公司行为调整”模块；K 线复权计算保留。
- 股票笔记目录启动时幂等导入，核心笔记可自动触发 AI/本地识别；网页支持多 Markdown 文件上传并进入草稿审批流程。
- K 线工作区保存完整绘图、指标、图层、周期、视图状态；登录后通过 `CHART_WORKSPACE` 同步。
- Flutter 标注上传改为携带完整点位、类型、隐藏状态、时间和 revision，并增加远端拉取合并。

## 阿里云配置

```dotenv
TUSHARE_TOKEN=...
STOCKCAL_AUTH_REQUIRED=true
STOCKCAL_NOTES_PATH=/notes
STOCKCAL_KNOWLEDGE_AUTO_EXTRACT=true
STOCKCAL_API_BASE_URL=https://<aliyun-api-host>
```

同时挂载 `WooYu/ObsidianNote/印象笔记/股票` 的 Markdown 文件到后端 `/notes`。AI key 未配置时仍可导入和本地提取，但不会产生伪造的统计可靠度。

## 验收

- Web：`cd frontend && npm test -- --run && npm run lint && npm run build`
- Backend：`cd backend && bash gradlew test`（需要 Gradle wrapper 可访问）
- Flutter：`flutter test && flutter analyze`（需要 Flutter SDK）
