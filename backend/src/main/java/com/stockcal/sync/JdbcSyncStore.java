package com.stockcal.sync;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

@Repository
public class JdbcSyncStore {
    private final JdbcClient jdbc;
    private final ObjectMapper json;

    JdbcSyncStore(JdbcClient jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public ApplyResponse apply(String userId, SyncMutation mutation) {
        var existing = cursorFor(userId, mutation.idempotencyKey());
        if (existing != null) return new ApplyResponse(false, existing);
        var current = jdbc.sql("""
                select coalesce(max(revision), 0) from sync_change
                where user_id = :userId and entity_type = :type and entity_id = :entityId
                """)
            .param("userId", userId).param("type", mutation.entityType())
            .param("entityId", mutation.entityId()).query(Long.class).single();
        if (mutation.revision() <= current) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "revision conflict");
        }
        try {
            jdbc.sql("""
                    insert into sync_change
                    (user_id, idempotency_key, entity_type, entity_id, operation, revision, payload)
                    values (:userId, :key, :type, :entityId, :operation, :revision, :payload)
                    """)
                .param("userId", userId).param("key", mutation.idempotencyKey())
                .param("type", mutation.entityType()).param("entityId", mutation.entityId())
                .param("operation", mutation.operation()).param("revision", mutation.revision())
                .param("payload", json.writeValueAsString(mutation.payload())).update();
        } catch (DuplicateKeyException ignored) {
            return new ApplyResponse(false, cursorFor(userId, mutation.idempotencyKey()));
        }
        return new ApplyResponse(true, cursorFor(userId, mutation.idempotencyKey()));
    }

    public PullResponse pull(String userId, long cursor) {
        List<SyncChange> changes = jdbc.sql("""
                select cursor, entity_type, entity_id, operation, revision, payload, changed_at
                from sync_change where user_id = :userId and cursor > :cursor order by cursor
                """)
            .param("userId", userId).param("cursor", cursor)
            .query(this::map).list();
        var next = changes.isEmpty() ? cursor : changes.getLast().cursor();
        return new PullResponse(next, changes);
    }

    private Long cursorFor(String userId, String key) {
        return jdbc.sql("select cursor from sync_change where user_id = :userId and idempotency_key = :key")
            .param("userId", userId).param("key", key).query(Long.class).optional().orElse(null);
    }

    private SyncChange map(ResultSet row, int ignored) throws SQLException {
        Map<String, Object> payload = json.readValue(
            row.getString("payload"), new TypeReference<Map<String, Object>>() {});
        return new SyncChange(row.getLong("cursor"), row.getString("entity_type"),
            row.getString("entity_id"), row.getString("operation"), row.getLong("revision"),
            payload, row.getTimestamp("changed_at").toInstant());
    }
}
