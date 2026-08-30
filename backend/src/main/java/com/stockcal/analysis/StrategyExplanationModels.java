package com.stockcal.analysis;

import jakarta.validation.constraints.NotBlank;
import java.util.List;
import java.util.Map;

public record StrategyExplanationRequest(
    @NotBlank String decision,
    String primaryMode,
    @NotBlank String reason,
    List<String> matchedRules,
    List<String> missingFacts,
    List<String> conflicts,
    List<String> invalidationConditions,
    Map<String, Object> snapshot,
    List<StrategyEvidence> evidence,
    CalibrationPayload calibration
) {
    public StrategyExplanationRequest {
        matchedRules = matchedRules == null ? List.of() : List.copyOf(matchedRules);
        missingFacts = missingFacts == null ? List.of() : List.copyOf(missingFacts);
        conflicts = conflicts == null ? List.of() : List.copyOf(conflicts);
        invalidationConditions = invalidationConditions == null
            ? List.of() : List.copyOf(invalidationConditions);
        snapshot = snapshot == null ? Map.of() : Map.copyOf(snapshot);
        evidence = evidence == null ? List.of() : List.copyOf(evidence);
    }
}

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

record StrategyExplanation(
    @NotBlank String decision,
    @NotBlank String summary,
    List<String> evidenceIds,
    List<String> risks,
    List<String> unknowns
) {
    public StrategyExplanation {
        evidenceIds = evidenceIds == null ? List.of() : List.copyOf(evidenceIds);
        risks = risks == null ? List.of() : List.copyOf(risks);
        unknowns = unknowns == null ? List.of() : List.copyOf(unknowns);
    }
}
