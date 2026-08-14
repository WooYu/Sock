package com.stockcal.sync;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import java.util.Map;

public record SyncMutation(
    @NotBlank String idempotencyKey,
    @NotBlank String entityType,
    @NotBlank String entityId,
    @NotBlank String operation,
    @Min(1) long revision,
    Map<String, Object> payload) {}
