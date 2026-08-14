package com.stockcal.sync;

import java.time.Instant;
import java.util.List;
import java.util.Map;

record ApplyResponse(boolean applied, long cursor) {}
record PullResponse(long nextCursor, List<SyncChange> changes) {}
record SyncChange(
    long cursor, String entityType, String entityId, String operation,
    long revision, Map<String, Object> payload, Instant changedAt) {}
