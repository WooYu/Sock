package com.stockcal.sync;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/sync")
public class SyncController {
    private final AtomicLong cursor = new AtomicLong();
    private final Map<String, Change> byIdempotencyKey = new LinkedHashMap<>();
    private final Map<String, Long> latestRevision = new LinkedHashMap<>();
    private final List<Change> changes = new ArrayList<>();

    @PostMapping("/mutations")
    synchronized ApplyResponse apply(@Valid @RequestBody Mutation request) {
        var existing = byIdempotencyKey.get(request.idempotencyKey());
        if (existing != null) return new ApplyResponse(false, existing.cursor());
        var entityKey = request.entityType() + ":" + request.entityId();
        var current = latestRevision.getOrDefault(entityKey, 0L);
        if (request.revision() <= current) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "revision conflict");
        }
        var change = new Change(
            cursor.incrementAndGet(), request.entityType(), request.entityId(),
            request.operation(), request.revision(), Map.copyOf(request.payload()), Instant.now());
        byIdempotencyKey.put(request.idempotencyKey(), change);
        latestRevision.put(entityKey, request.revision());
        changes.add(change);
        return new ApplyResponse(true, change.cursor());
    }

    @GetMapping("/changes")
    synchronized PullResponse pull(@RequestParam(defaultValue = "0") long cursor) {
        var result = changes.stream().filter(change -> change.cursor() > cursor).toList();
        var next = result.isEmpty() ? cursor : result.getLast().cursor();
        return new PullResponse(next, result);
    }

    record Mutation(
        @NotBlank String idempotencyKey,
        @NotBlank String entityType,
        @NotBlank String entityId,
        @NotBlank String operation,
        @Min(1) long revision,
        Map<String, Object> payload) {}
    record ApplyResponse(boolean applied, long cursor) {}
    record PullResponse(long nextCursor, List<Change> changes) {}
    record Change(
        long cursor, String entityType, String entityId, String operation,
        long revision, Map<String, Object> payload, Instant changedAt) {}
}
