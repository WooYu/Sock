package com.stockcal.review;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import java.time.Instant;

public record ReviewSnapshot(
    @NotBlank String reviewId,
    @NotBlank String stockCode,
    Instant tradedAt,
    @Positive double plannedPrice,
    @Positive double actualPrice,
    @Positive double actualClose,
    @PositiveOrZero int predictionVersion,
    @Positive double predictedTarget,
    @NotBlank String reason,
    String invalidationReason
) {}
