# StockCal 笔记/规则源文件管理

> 状态：待评审。范围：笔记/规则源文件的导入、识别、修改、删除、开启/关闭。

## 目标

让用户能完整管理知识库里的笔记与规则：导入（已有）、AI 识别（已有）、**修改原文/草稿**、**级联删除**、**规则开关**。

## 现状

- 后端 `KnowledgeController`：有 import / sources / extract / drafts / approve / publish；**缺** delete / edit / toggle。
- 数据：`published_rule_source` 无 `enabled` 字段。
- 前端 `KnowledgeController`：只加载 `sources` + `drafts`；**未加载已发布规则**，也无开关。

## 数据模型

- 迁移 V10：`alter table published_rule_source add column enabled boolean not null default true;`

## 后端接口（新增 5 个）

| 接口 | 请求 | 响应 | 说明 |
|---|---|---|---|
| `PATCH /api/v1/knowledge/sources/{id}` | `{ "content": "新原文" }` | SourceDocument | 更新 `original_content` + 重算 `content_hash`；草稿保留 |
| `DELETE /api/v1/knowledge/sources/{id}` | — | 204 | 级联删除 source + drafts + published_rules |
| `PATCH /api/v1/knowledge/drafts/{id}` | `{ "title": "...", "summary": "..." }` | KnowledgeDraft | 审核前改草稿标题/摘要 |
| `GET /api/v1/knowledge/rules` | — | `List<PublishedRule>` | 列出已发布规则（含 `enabled`） |
| `PATCH /api/v1/knowledge/rules/{id}/enabled` | `{ "enabled": true\|false }` | PublishedRule | 切换开关 |

## 业务逻辑

- **修改源文件**：更新原文 + hash；旧草稿保留，用户手动「重新识别」生成新草稿（复用已有 `extract` 接口）。
- **删除源文件**：事务内按 `source_document_id` 级联删除 `knowledge_draft` + `published_rule_source`，再删 `knowledge_source`。
- **开启/关闭**：`enabled=false` 的规则**保留显示但置灰**，不参与回测/分析；可重新开启。

## 前端

- `KnowledgeRepository` 接口新增：`updateSource` / `deleteSource` / `updateDraft` / `loadRules` / `toggleRule`；`RemoteKnowledgeRepository` 与 `MemoryKnowledgeRepository` 同步实现。
- `KnowledgeController` 新增：`rules` 列表、`updateSource` / `deleteSource` / `updateDraft` / `toggleRule`。
- `KnowledgeWorkspace` 重构为两个 tab（笔记 / 规则）：
  - **笔记**：源文件列表（标题 + 状态 Chip「未识别 / 已识别 N 条」+ 溢出菜单「编辑 / 删除」）。点笔记展开详情：原文（可编辑）+ 草稿列表（每条可「编辑 / 批准 / 删除」）+「重新识别」按钮。
  - **规则**：已发布规则列表 + `Switch` 开关，关闭的置灰 +「已停用」。

## 交互

- 删除（笔记/规则）：二次确认弹窗「删除后连同草稿和已发布规则一并移除，不可恢复」。
- 开关：`Switch` 切换；关闭的规则保留在列表但置灰、标记「已停用」。
- 渐进披露：笔记列表 → 详情（原文 + 草稿就近处理）。

## 测试

- 后端：新增 edit/delete/toggle 的接口测试（`KnowledgeApiTest` 扩展）。
- 前端：仓库 + `KnowledgeWorkspace` widget 测试（删除确认、开关切换、编辑草稿）。

## 涉及文件

- 后端：`V10__published_rule_enabled.sql`、`KnowledgeController.java`、`KnowledgeWorkflow.java`、`KnowledgeModels.java`、`JdbcKnowledgeRepository.java`、`KnowledgeRepository.java`（接口）、测试。
- 前端：`knowledge.dart`、`remote_knowledge_repository.dart`、`knowledge_workspace.dart`、测试。
