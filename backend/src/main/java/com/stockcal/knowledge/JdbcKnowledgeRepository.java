package com.stockcal.knowledge;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Repository
public class JdbcKnowledgeRepository implements KnowledgeRepository {
    private final JdbcClient jdbc;
    private final JsonMapper json = JsonMapper.builder().build();

    JdbcKnowledgeRepository(JdbcClient jdbc) { this.jdbc = jdbc; }

    public Optional<SourceDocument> sourceByPathAndHash(String path, String hash) {
        return jdbc.sql("select * from knowledge_source where source_path=:path and content_hash=:hash")
            .param("path", path).param("hash", hash).query((rs, row) -> mapSource(rs)).optional();
    }

    public Optional<SourceDocument> source(String id) {
        return jdbc.sql("select * from knowledge_source where id=:id")
            .param("id", id).query((rs, row) -> mapSource(rs)).optional();
    }

    public void saveSource(SourceDocument value) {
        jdbc.sql("insert into knowledge_source(id,source_path,title,content_hash,original_content,imported_at) values(:id,:path,:title,:hash,:content,:at)")
            .param("id", value.id()).param("path", value.path()).param("title", value.title())
            .param("hash", value.contentHash()).param("content", value.originalContent())
            .param("at", toOffset(value.importedAt())).update();
    }

    public List<SourceDocument> sources() {
        return jdbc.sql("select * from knowledge_source order by imported_at desc")
            .query((rs, row) -> mapSource(rs)).list();
    }

    public void saveDraft(KnowledgeDraft value) {
        var updated = jdbc.sql("""
            update knowledge_draft
               set status=:status,
                   approved_by=:by,
                   reviewed_at=:at,
                   rule_conditions=:conditions,
                   rule_action=:action,
                   strategy_mode=:mode,
                   timeframe=:timeframe,
                   priority=:priority,
                   evidence_ids=:evidence,
                   invalidation_conditions=:invalidation,
                   strength=:strength
             where id=:id
            """)
            .param("id", value.id())
            .param("status", value.status().name())
            .param("by", value.approvedBy())
            .param("at", toOffset(value.reviewedAt()))
            .param("conditions", writeJson(value.conditions()))
            .param("action", value.action())
            .param("mode", value.mode())
            .param("timeframe", value.timeframe())
            .param("priority", value.priority())
            .param("evidence", writeJson(value.evidenceIds()))
            .param("invalidation", writeJson(value.invalidationConditions()))
            .param("strength", value.strength())
            .update();
        if (updated > 0) return;

        jdbc.sql("""
            insert into knowledge_draft(
                id,source_document_id,kind,title,summary,source_excerpt,
                source_line_start,source_line_end,extraction_method,status,
                approved_by,reviewed_at,rule_conditions,rule_action,strategy_mode,
                timeframe,priority,evidence_ids,invalidation_conditions,strength
            ) values(
                :id,:source,:kind,:title,:summary,:excerpt,
                :start,:end,:method,:status,:by,:at,:conditions,:action,:mode,
                :timeframe,:priority,:evidence,:invalidation,:strength
            )
            """)
            .param("id", value.id())
            .param("source", value.sourceDocumentId())
            .param("kind", value.kind().name())
            .param("title", value.title())
            .param("summary", value.summary())
            .param("excerpt", value.sourceExcerpt())
            .param("start", value.sourceLineStart())
            .param("end", value.sourceLineEnd())
            .param("method", value.extractionMethod().name())
            .param("status", value.status().name())
            .param("by", value.approvedBy())
            .param("at", toOffset(value.reviewedAt()))
            .param("conditions", writeJson(value.conditions()))
            .param("action", value.action())
            .param("mode", value.mode())
            .param("timeframe", value.timeframe())
            .param("priority", value.priority())
            .param("evidence", writeJson(value.evidenceIds()))
            .param("invalidation", writeJson(value.invalidationConditions()))
            .param("strength", value.strength())
            .update();
    }

    public Optional<KnowledgeDraft> draft(String id) {
        return jdbc.sql("select * from knowledge_draft where id=:id")
            .param("id", id).query((rs, row) -> mapDraft(rs)).optional();
    }

    public List<KnowledgeDraft> draftsForSource(String sourceId) {
        return jdbc.sql("select * from knowledge_draft where source_document_id=:id order by source_line_start,id")
            .param("id", sourceId).query((rs, row) -> mapDraft(rs)).list();
    }

    public List<KnowledgeDraft> drafts(ApprovalStatus status) {
        if (status == null) {
            return jdbc.sql("select * from knowledge_draft order by source_line_start,id")
                .query((rs, row) -> mapDraft(rs)).list();
        }
        return jdbc.sql("select * from knowledge_draft where status=:status order by source_line_start,id")
            .param("status", status.name()).query((rs, row) -> mapDraft(rs)).list();
    }

    public void savePublishedRule(PublishedRule value) {
        jdbc.sql("""
            insert into published_rule_source(
                id,source_document_id,name,description,source_excerpt,
                source_line_start,source_line_end,approved_by,published_at,enabled,
                rule_conditions,rule_action,strategy_mode,timeframe,priority,evidence_ids,
                invalidation_conditions,strength
            ) values(
                :id,:source,:name,:description,:excerpt,
                :start,:end,:by,:at,:enabled,
                :conditions,:action,:mode,:timeframe,:priority,:evidence,
                :invalidation,:strength
            )
            """)
            .param("id", value.id())
            .param("source", value.sourceDocumentId())
            .param("name", value.name())
            .param("description", value.description())
            .param("excerpt", value.sourceExcerpt())
            .param("start", value.sourceLineStart())
            .param("end", value.sourceLineEnd())
            .param("by", value.approvedBy())
            .param("at", toOffset(value.publishedAt()))
            .param("enabled", value.enabled())
            .param("conditions", writeJson(value.conditions()))
            .param("action", value.action())
            .param("mode", value.mode())
            .param("timeframe", value.timeframe())
            .param("priority", value.priority())
            .param("evidence", writeJson(value.evidenceIds()))
            .param("invalidation", writeJson(value.invalidationConditions()))
            .param("strength", value.strength())
            .update();
    }

    public Optional<SourceDocument> updateSource(String id, String content, String hash) {
        jdbc.sql("update knowledge_source set original_content=:content, content_hash=:hash where id=:id")
            .param("content", content).param("hash", hash).param("id", id).update();
        return source(id);
    }

    public void invalidateDerived(String sourceId) {
        jdbc.sql("delete from published_rule_source where source_document_id=:id")
            .param("id", sourceId).update();
        jdbc.sql("delete from knowledge_draft where source_document_id=:id")
            .param("id", sourceId).update();
    }

    public void deleteSource(String id) {
        invalidateDerived(id);
        jdbc.sql("delete from knowledge_source where id=:id").param("id", id).update();
    }

    public Optional<KnowledgeDraft> updateDraft(String id, String title, String summary) {
        jdbc.sql("update knowledge_draft set title=:title, summary=:summary where id=:id")
            .param("title", title).param("summary", summary).param("id", id).update();
        return draft(id);
    }

    public List<PublishedRule> publishedRules() {
        return jdbc.sql("select * from published_rule_source order by published_at desc")
            .query((rs, row) -> mapPublishedRule(rs)).list();
    }

    public Optional<PublishedRule> setRuleEnabled(String id, boolean enabled) {
        jdbc.sql("update published_rule_source set enabled=:enabled where id=:id")
            .param("enabled", enabled).param("id", id).update();
        return publishedRules().stream().filter(r -> r.id().equals(id)).findFirst();
    }

    private PublishedRule mapPublishedRule(ResultSet rs) throws SQLException {
        return new PublishedRule(
            rs.getString("id"),
            rs.getString("source_document_id"),
            rs.getString("name"),
            rs.getString("description"),
            rs.getString("source_excerpt"),
            rs.getInt("source_line_start"),
            rs.getInt("source_line_end"),
            rs.getString("approved_by"),
            rs.getObject("published_at", OffsetDateTime.class).toInstant(),
            rs.getBoolean("enabled"),
            readConditions(rs.getString("rule_conditions")),
            rs.getString("rule_action"),
            rs.getString("strategy_mode"),
            rs.getString("timeframe"),
            rs.getInt("priority"),
            readStrings(rs.getString("evidence_ids")),
            readStrings(rs.getString("invalidation_conditions")),
            rs.getString("strength")
        );
    }

    private SourceDocument mapSource(ResultSet rs) throws SQLException {
        return new SourceDocument(
            rs.getString("id"),
            rs.getString("source_path"),
            rs.getString("title"),
            rs.getString("content_hash"),
            rs.getString("original_content"),
            rs.getObject("imported_at", OffsetDateTime.class).toInstant()
        );
    }

    private KnowledgeDraft mapDraft(ResultSet rs) throws SQLException {
        var reviewed = rs.getObject("reviewed_at");
        return new KnowledgeDraft(
            rs.getString("id"),
            rs.getString("source_document_id"),
            KnowledgeKind.valueOf(rs.getString("kind")),
            rs.getString("title"),
            rs.getString("summary"),
            rs.getString("source_excerpt"),
            rs.getInt("source_line_start"),
            rs.getInt("source_line_end"),
            ExtractionMethod.valueOf(rs.getString("extraction_method")),
            ApprovalStatus.valueOf(rs.getString("status")),
            rs.getString("approved_by"),
            reviewed == null ? null : rs.getObject("reviewed_at", OffsetDateTime.class).toInstant(),
            readConditions(rs.getString("rule_conditions")),
            rs.getString("rule_action"),
            rs.getString("strategy_mode"),
            rs.getString("timeframe"),
            rs.getInt("priority"),
            readStrings(rs.getString("evidence_ids")),
            readStrings(rs.getString("invalidation_conditions")),
            rs.getString("strength")
        );
    }

    private List<RuleConditionSpec> readConditions(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        try {
            var root = json.readTree(raw);
            if (!root.isArray()) return List.of();
            var result = new ArrayList<RuleConditionSpec>();
            for (JsonNode item : root) {
                result.add(new RuleConditionSpec(
                    item.path("field").asText(),
                    item.path("operator").asText(),
                    item.path("value").asDouble()
                ));
            }
            return List.copyOf(result);
        } catch (Exception exception) {
            throw new IllegalStateException("规则条件存储内容无法解析", exception);
        }
    }

    private List<String> readStrings(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        try {
            var root = json.readTree(raw);
            if (!root.isArray()) return List.of();
            var result = new ArrayList<String>();
            for (JsonNode item : root) result.add(item.asText());
            return List.copyOf(result);
        } catch (Exception exception) {
            throw new IllegalStateException("规则证据存储内容无法解析", exception);
        }
    }

    private String writeJson(Object value) {
        try {
            return json.writeValueAsString(value);
        } catch (Exception exception) {
            throw new IllegalStateException("规则结构化字段无法保存", exception);
        }
    }

    private static OffsetDateTime toOffset(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }
}
