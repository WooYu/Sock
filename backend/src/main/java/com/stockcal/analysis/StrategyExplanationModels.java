package com.stockcal.analysis;

import jakarta.validation.constraints.NotBlank;
import java.util.List;

record StrategyEvidence(
    @NotBlank String id,
    @NotBlank String label,
    String detail
) {}

record CalibrationPayload(
    Integer sampleCount,
    Double hitRate,
    Double meanAbsoluteError,
    Double meanSlippage,
    Double maximumDrawdown,
    Boolean calibrated,
    Double confidence
) {}
