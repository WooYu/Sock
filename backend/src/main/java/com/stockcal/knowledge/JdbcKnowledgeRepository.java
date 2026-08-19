package com.stockcal.knowledge;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcKnowledgeRepository implements KnowledgeRepository {
    private final JdbcClient jdbc;

    JdbcKnowledgeRepository(JdbcClient jdbc) { this.jdbc = jdbc; }

    public Optional<SourceDocument> sourceByPathAndHash(String path, String hash) {
        return jdbc.sql("select * from knowledge_source where source_path=:path and content_hash=:hash")
            .param("path", path).param("hash", hash).query((rs, row) -> mapSource(rs)).optional();
    }
    public Optional<SourceDocument> source(String id) {
        return jdbc.sql("select * from knowledge_source where id=:id").param("id", id).query((rs, row) -> mapSource(rs)).optional();
    }
    public void saveSource(SourceDocument value) {
        jdbc.sql("insert into knowledge_source(id,source_path,title,content_hash,original_content,imported_at) values(:id,:path,:title,:hash,:content,:at)")
            .param("id", value.id()).param("path", value.path()).param("title", value.title())
            .param("hash", value.contentHash()).param("content", value.originalContent()).param("at", toOffset(value.importedAt())).update();
    }
    public List<SourceDocument> sources() {
        return jdbc.sql("select * from knowledge_source order by imported_at desc").query((rs, row) -> mapSource(rs)).list();
    }
    public void saveDraft(KnowledgeDraft value) {
        var updated = jdbc.sql("update knowledge_draft set status=:status,approved_by=:by,reviewed_at=:at where id=:id")
            .param("id", value.id()).param("status", value.status().name()).param("by", value.approvedBy())
            .param("at", value.reviewedAt()).update();
        if (updated > 0) return;
        jdbc.sql("insert into knowledge_draft(id,source_document_id,kind,title,summary,source_excerpt,source_line_start,source_line_end,extraction_method,status,approved_by,reviewed_at) values(:id,:source,:kind,:title,:summary,:excerpt,:start,:end,:method,:status,:by,:at)")
            .param("id", value.id()).param("source", value.sourceDocumentId()).param("kind", value.kind().name())
            .param("title", value.title()).param("summary", value.summary()).param("excerpt", value.sourceExcerpt())
            .param("start", value.sourceLineStart()).param("end", value.sourceLineEnd())
            .param("method", value.extractionMethod().name()).param("status", value.status().name())
            .param("by", value.approvedBy()).param("at", toOffset(value.reviewedAt())).update();
    }
    public Optional<KnowledgeDraft> draft(String id) {
        return jdbc.sql("select * from knowledge_draft where id=:id").param("id", id).query((rs, row) -> mapDraft(rs)).optional();
    }
    public List<KnowledgeDraft> draftsForSource(String sourceId) {
        return jdbc.sql("select * from knowledge_draft where source_document_id=:id order by source_line_start,id")
            .param("id", sourceId).query((rs, row) -> mapDraft(rs)).list();
    }
    public List<KnowledgeDraft> drafts(ApprovalStatus status) {
        if (status == null) return jdbc.sql("select * from knowledge_draft order by source_line_start,id").query((rs, row) -> mapDraft(rs)).list();
        return jdbc.sql("select * from knowledge_draft where status=:status order by source_line_start,id")
            .param("status", status.name()).query((rs, row) -> mapDraft(rs)).list();
    }
    public void savePublishedRule(PublishedRule value) {
        jdbc.sql("insert into published_rule_source(id,source_document_id,name,description,source_excerpt,source_line_start,source_line_end,approved_by,published_at) values(:id,:source,:name,:description,:excerpt,:start,:end,:by,:at)")
            .param("id", value.id()).param("source", value.sourceDocumentId()).param("name", value.name())
            .param("description", value.description()).param("excerpt", value.sourceExcerpt())
            .param("start", value.sourceLineStart()).param("end", value.sourceLineEnd())
            .param("by", value.approvedBy()).param("at", toOffset(value.publishedAt())).update();
    }

    private SourceDocument mapSource(ResultSet rs) throws SQLException {
        return new SourceDocument(rs.getString("id"), rs.getString("source_path"), rs.getString("title"),
            rs.getString("content_hash"), rs.getString("original_content"), rs.getObject("imported_at", OffsetDateTime.class).toInstant());
    }
    private KnowledgeDraft mapDraft(ResultSet rs) throws SQLException {
        var reviewed = rs.getObject("reviewed_at");
        return new KnowledgeDraft(rs.getString("id"), rs.getString("source_document_id"),
            KnowledgeKind.valueOf(rs.getString("kind")), rs.getString("title"), rs.getString("summary"),
            rs.getString("source_excerpt"), rs.getInt("source_line_start"), rs.getInt("source_line_end"),
            ExtractionMethod.valueOf(rs.getString("extraction_method")),
            ApprovalStatus.valueOf(rs.getString("status")), rs.getString("approved_by"),
            reviewed == null ? null : rs.getObject("reviewed_at", OffsetDateTime.class).toInstant());
    }

    private static OffsetDateTime toOffset(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }
}
