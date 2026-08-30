package com.stockcal.analysis;

import jakarta.validation.constraints.NotBlank;
import java.util.List;

public record StrategyExplanation(
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
