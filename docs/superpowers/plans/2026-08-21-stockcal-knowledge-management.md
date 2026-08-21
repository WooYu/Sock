# 笔记/规则源文件管理 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户能完整管理知识库的笔记与规则：修改原文/草稿、级联删除、规则开关。

**Architecture:** 后端加 `enabled` 字段 + 5 个接口（改原文/删源/改草稿/列规则/切开关）；前端加仓库方法 + 控制器状态 + 两 tab 管理界面（笔记/规则）。

**Tech Stack:** Spring Boot 4.1 (Java 21, JdbcClient, PostgreSQL) + Flutter 3.44。

**Spec:** `docs/superpowers/specs/2026-08-20-stockcal-knowledge-management.md`

## Global Constraints

- 数据模型：`published_rule_source` 加 `enabled boolean not null default true`。
- 删除源文件 = 级联删 `knowledge_draft` + `published_rule_source`（按 `source_document_id`），事务内完成。
- 改原文 = 更新 `original_content` + 重算 `content_hash`，旧草稿保留。
- 关闭规则 = `enabled=false`，保留显示但置灰、不参与回测。
- 前端两 tab：`笔记`（源文件列表+详情）/ `规则`（已发布规则+开关）。
- 现有 35 后端 + 188 Flutter 测试保持全绿；新增测试覆盖 CRUD + 开关。
- 提交信息结尾带 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。

---

### Task 1: 迁移 + 数据模型（enabled 字段）

**Files:**
- Create: `backend/src/main/resources/db/migration/V10__published_rule_enabled.sql`
- Modify: `backend/src/main/java/com/stockcal/knowledge/KnowledgeModels.java`
- Modify: `backend/src/main/java/com/stockcal/knowledge/KnowledgeWorkflow.java`（publish 传 enabled）

**Interfaces:**
- Produces: `PublishedRule` record 增加 `boolean enabled` 字段（在 `publishedAt` 之后）。

- [ ] **Step 1: 写迁移**

`V10__published_rule_enabled.sql`：
```sql
alter table published_rule_source add column enabled boolean not null default true;
```

- [ ] **Step 2: 更新 PublishedRule record**

`KnowledgeModels.java` 的 `PublishedRule` 改为：
```java
record PublishedRule(
    String id,
    String sourceDocumentId,
    String name,
    String description,
    String sourceExcerpt,
    int sourceLineStart,
    int sourceLineEnd,
    String approvedBy,
    Instant publishedAt,
    boolean enabled
) {}
```

- [ ] **Step 3: 适配 publishRule**

`KnowledgeWorkflow.publishRule` 中构造 `PublishedRule` 时末尾加 `true`（新规则默认启用）：
```java
var rule = new PublishedRule(UUID.randomUUID().toString(), draft.sourceDocumentId(), draft.title(),
    draft.summary(), draft.sourceExcerpt(), draft.sourceLineStart(), draft.sourceLineEnd(),
    draft.approvedBy(), clock.get(), true);
```

- [ ] **Step 4: 编译**

Run: `cd backend && ./gradlew compileJava`
Expected: 若有编译错误（如 savePublishedRule 引用），见 Task 2 一并处理；若仅 record 改动则 PASS。

- [ ] **Step 5: 提交**

```bash
git add backend/src/main/resources/db/migration/V10__published_rule_enabled.sql backend/src/main/java/com/stockcal/knowledge/KnowledgeModels.java backend/src/main/java/com/stockcal/knowledge/KnowledgeWorkflow.java
git commit -m "feat: add enabled flag to published rules (V10)"
```

---

### Task 2: 后端仓库层（update/delete/toggle/publishedRules）

**Files:**
- Modify: `backend/src/main/java/com/stockcal/knowledge/KnowledgeRepository.java`（接口）
- Modify: `backend/src/main/java/com/stockcal/knowledge/JdbcKnowledgeRepository.java`
- Modify: `backend/src/test/java/com/stockcal/knowledge/InMemoryKnowledgeRepository.java`（若存在）

**Interfaces:**
- Produces（接口新增方法，签名）：
  - `Optional<SourceDocument> updateSource(String id, String content)`
  - `void deleteSource(String id)`
  - `Optional<KnowledgeDraft> updateDraft(String id, String title, String summary)`
  - `List<PublishedRule> publishedRules()`
  - `Optional<PublishedRule> setRuleEnabled(String id, boolean enabled)`

- [ ] **Step 1: 接口加方法**

在 `KnowledgeRepository` 接口添加上述 5 个方法声明。

- [ ] **Step 2: 实现 JdbcKnowledgeRepository 方法**

```java
@Override
public Optional<SourceDocument> updateSource(String id, String content) {
    var hash = sha256(content);
    jdbc.sql("update knowledge_source set original_content=:content, content_hash=:hash where id=:id")
        .param("content", content).param("hash", hash).param("id", id).update();
    return source(id);
}

@Override
public void deleteSource(String id) {
    jdbc.sql("delete from knowledge_draft where source_document_id=:id").param("id", id).update();
    jdbc.sql("delete from published_rule_source where source_document_id=:id").param("id", id).update();
    jdbc.sql("delete from knowledge_source where id=:id").param("id", id).update();
}

@Override
public Optional<KnowledgeDraft> updateDraft(String id, String title, String summary) {
    jdbc.sql("update knowledge_draft set title=:title, summary=:summary where id=:id")
        .param("title", title).param("summary", summary).param("id", id).update();
    return draft(id);
}

@Override
public List<PublishedRule> publishedRules() {
    return jdbc.sql("select * from published_rule_source order by published_at desc")
        .query((rs, row) -> mapPublishedRule(rs)).list();
}

@Override
public Optional<PublishedRule> setRuleEnabled(String id, boolean enabled) {
    jdbc.sql("update published_rule_source set enabled=:enabled where id=:id")
        .param("enabled", enabled).param("id", id).update();
    return publishedRules().stream().filter(r -> r.id().equals(id)).findFirst();
}

private PublishedRule mapPublishedRule(ResultSet rs) throws SQLException {
    return new PublishedRule(rs.getString("id"), rs.getString("source_document_id"),
        rs.getString("name"), rs.getString("description"), rs.getString("source_excerpt"),
        rs.getInt("source_line_start"), rs.getInt("source_line_end"), rs.getString("approved_by"),
        rs.getObject("published_at", OffsetDateTime.class).toInstant(), rs.getBoolean("enabled"));
}
```

（`savePublishedRule` 的 insert 语句需在列清单加 `enabled`，值传 `:enabled`，`param("enabled", value.enabled())`。）

- [ ] **Step 3: 实现 InMemoryKnowledgeRepository 对应方法**

在测试用的内存仓库里同步加这 5 个方法（简单内存 List 增删改）。

- [ ] **Step 4: 跑后端测试**

Run: `cd backend && ./gradlew test`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add backend/src/main/java/com/stockcal/knowledge/KnowledgeRepository.java backend/src/main/java/com/stockcal/knowledge/JdbcKnowledgeRepository.java backend/src/test/java/com/stockcal/knowledge/InMemoryKnowledgeRepository.java
git commit -m "feat: add update/delete/toggle repository methods"
```

---

### Task 3: 后端业务层 + 接口（KnowledgeWorkflow + KnowledgeController）

**Files:**
- Modify: `backend/src/main/java/com/stockcal/knowledge/KnowledgeWorkflow.java`
- Modify: `backend/src/main/java/com/stockcal/knowledge/KnowledgeController.java`
- Test: `backend/src/test/java/com/stockcal/knowledge/KnowledgeApiTest.java`

**Interfaces:**
- Consumes: Task 2 的仓库方法。
- Produces：`KnowledgeWorkflow` 的 `updateSource/deleteSource/updateDraft/rules/toggleRule`；Controller 的 5 个 endpoint。

- [ ] **Step 1: 写失败测试（接口）**

在 `KnowledgeApiTest` 新增：改原文后 `GET /sources` 返回新 content、`DELETE /sources/{id}` 后 sources 为空、`PATCH /drafts/{id}` 后 title 变化、`GET /rules` 返回列表、`PATCH /rules/{id}/enabled` 后 enabled 翻转。用 MockMvc（参考现有 `KnowledgeApiTest` 的写法）。

- [ ] **Step 2: 跑测试确认失败**

Run: `cd backend && ./gradlew test --tests KnowledgeApiTest`
Expected: FAIL（endpoint 不存在）

- [ ] **Step 3: 实现 KnowledgeWorkflow 方法**

```java
SourceDocument updateSource(String id, String content) {
    return repository.updateSource(id, content)
        .orElseThrow(() -> new IllegalArgumentException("来源不存在"));
}
void deleteSource(String id) { repository.deleteSource(id); }
KnowledgeDraft updateDraft(String id, String title, String summary) {
    return repository.updateDraft(id, title, summary)
        .orElseThrow(() -> new IllegalArgumentException("知识条目不存在"));
}
List<PublishedRule> rules() { return repository.publishedRules(); }
PublishedRule toggleRule(String id, boolean enabled) {
    return repository.setRuleEnabled(id, enabled)
        .orElseThrow(() -> new IllegalArgumentException("规则不存在"));
}
```

- [ ] **Step 4: 实现 KnowledgeController 端点**

```java
record UpdateSourceRequest(String content) {}
record UpdateDraftRequest(String title, String summary) {}
record ToggleRuleRequest(boolean enabled) {}

@PatchMapping("/sources/{id}")
SourceDocument updateSource(@PathVariable String id, @RequestBody UpdateSourceRequest request) {
    return workflow.updateSource(id, request.content());
}
@DeleteMapping("/sources/{id}")
@ResponseStatus(HttpStatus.NO_CONTENT)
void deleteSource(@PathVariable String id) { workflow.deleteSource(id); }
@PatchMapping("/drafts/{id}")
KnowledgeDraft updateDraft(@PathVariable String id, @RequestBody UpdateDraftRequest request) {
    return workflow.updateDraft(id, request.title(), request.summary());
}
@GetMapping("/rules")
List<PublishedRule> rules() { return workflow.rules(); }
@PatchMapping("/rules/{id}/enabled")
PublishedRule toggleRule(@PathVariable String id, @RequestBody ToggleRuleRequest request) {
    return workflow.toggleRule(id, request.enabled());
}
```

（`@PatchMapping` 需 `import org.springframework.web.bind.annotation.PatchMapping;`）

- [ ] **Step 5: 跑测试确认通过**

Run: `cd backend && ./gradlew test`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add backend/src/main/java/com/stockcal/knowledge/KnowledgeWorkflow.java backend/src/main/java/com/stockcal/knowledge/KnowledgeController.java backend/src/test/java/com/stockcal/knowledge/KnowledgeApiTest.java
git commit -m "feat: add knowledge management endpoints (edit/delete/toggle)"
```

---

### Task 4: 前端仓库层（KnowledgeRepository + Remote/Memory）

**Files:**
- Modify: `lib/features/knowledge/knowledge.dart`（接口 + Memory 实现）
- Modify: `lib/features/knowledge/remote_knowledge_repository.dart`

**Interfaces:**
- Produces（接口新增）：
  - `Future<void> updateSource(String id, String content)`
  - `Future<void> deleteSource(String id)`
  - `Future<void> updateDraft(String id, String title, String summary)`
  - `Future<List<PublishedRule>> loadRules()`
  - `Future<void> toggleRule(String id, bool enabled)`
  - 新增 `class PublishedRule { String id; String name; String description; bool enabled; }`

- [ ] **Step 1: 定义 PublishedRule + 接口方法**

在 `knowledge.dart` 添加 `PublishedRule` 类和 `KnowledgeRepository` 的 5 个方法声明；`MemoryKnowledgeRepository` 实现（内存 List）。

- [ ] **Step 2: 实现 RemoteKnowledgeRepository**

在 `remote_knowledge_repository.dart` 实现 5 个方法，走 HTTP：`PATCH /sources/{id}`、`DELETE /sources/{id}`、`PATCH /drafts/{id}`、`GET /rules`、`PATCH /rules/{id}/enabled`（复用现有 `_uri` / `_authorization` 模式）。

- [ ] **Step 3: 跑分析**

Run: `cd E:/Code_Tool/StockPrice && flutter analyze`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add lib/features/knowledge/knowledge.dart lib/features/knowledge/remote_knowledge_repository.dart
git commit -m "feat: add knowledge management repository methods"
```

---

### Task 5: 前端控制器（KnowledgeController）

**Files:**
- Modify: `lib/features/knowledge/knowledge.dart`

**Interfaces:**
- Consumes: Task 4 的仓库方法。
- Produces：`KnowledgeController.rules` 列表 + `updateSource/deleteSource/updateDraft/toggleRule`；`load()` 里一并加载 rules。

- [ ] **Step 1: 加状态 + 方法**

`KnowledgeController` 加 `List<PublishedRule> rules = const [];`；`load()` 里 `rules = await repository.loadRules();`；加方法：
```dart
Future<void> updateSource(String id, String content) async {
  await repository.updateSource(id, content); await load();
}
Future<void> deleteSource(String id) async {
  await repository.deleteSource(id); await load();
}
Future<void> updateDraft(String id, String title, String summary) async {
  await repository.updateDraft(id, title, summary); await load();
}
Future<void> toggleRule(String id, bool enabled) async {
  await repository.toggleRule(id, enabled); await load();
}
```

- [ ] **Step 2: 跑分析 + 测试**

Run: `flutter analyze && flutter test test/features/knowledge/`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add lib/features/knowledge/knowledge.dart
git commit -m "feat: add knowledge controller management methods"
```

---

### Task 6: 前端 UI（KnowledgeWorkspace 两 tab）

**Files:**
- Modify: `lib/features/knowledge/knowledge_workspace.dart`
- Test: `test/features/knowledge/knowledge_workspace_test.dart`（若存在，同步适配）

**Interfaces:**
- Consumes: Task 5 的 `KnowledgeController`。

- [ ] **Step 1: 写失败测试**

测试：`KnowledgeWorkspace` 显示「笔记」「规则」两个 tab；点笔记展开详情显示原文 + 草稿；规则 tab 显示 `Switch`；切开关调 `toggleRule`；删除弹确认框。

- [ ] **Step 2: 跑测试确认失败**

Run: `flutter test test/features/knowledge/knowledge_workspace_test.dart`
Expected: FAIL

- [ ] **Step 3: 实现两 tab UI**

`KnowledgeWorkspace.build` 改为 `DefaultTabController(length: 2)`，两个 tab：
- **笔记**：`ListView` 源文件（标题 + 状态 Chip「已识别 N 条」/「未识别」+ 溢出菜单「编辑/删除」）；`onTap` 展开 `ExpansionTile` 详情（原文 `SelectableText` + 草稿 `ListTile`（编辑/批准/删除）+「重新识别」`FilledButton`）。
- **规则**：`ListView` 已发布规则（标题 + 摘要 + `Switch`，关闭的 `Opacity(0.5)` +「已停用」标签 + 删除按钮）。
- 删除走 `showDialog` 二次确认，文案「删除后连同草稿和已发布规则一并移除，不可恢复」。
- 编辑原文/草稿用 `showDialog` + `TextField`，保存调 `controller.updateSource/updateDraft`。

- [ ] **Step 4: 跑测试确认通过**

Run: `flutter test`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add lib/features/knowledge/knowledge_workspace.dart test/features/knowledge/
git commit -m "feat: knowledge workspace two-tab management UI"
```

---

## Self-Review 备注

- Spec 覆盖：Task 1(迁移/enabled) 2(仓库) 3(业务+接口) 4(前端仓库) 5(控制器) 6(UI)，逐项对应 spec 的「数据模型 / 后端接口 / 前端 / 交互」。
- 类型一致性：`PublishedRule` 后端 `boolean enabled` ↔ 前端 `bool enabled`；接口路径 `/api/v1/knowledge/...` 前后端一致。
- 级联删除在 `JdbcKnowledgeRepository.deleteSource` 中显式三条 delete；`savePublishedRule` 需同步加 `enabled` 列（Task 2 注意）。
