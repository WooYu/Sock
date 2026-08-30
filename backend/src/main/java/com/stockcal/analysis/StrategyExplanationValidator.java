package com.stockcal.analysis;

import java.util.HashSet;
import java.util.Set;

final class StrategyExplanationValidator {
    private StrategyExplanationValidator() {}

    static StrategyExplanation validate(
        StrategyExplanationRequest request,
        StrategyExplanation response
    ) {
        if (response == null) {
            throw new IllegalArgumentException("AI explanation is empty");
        }
        if (!request.decision().equals(response.decision())) {
            throw new IllegalArgumentException(
                "AI explanation decision must match deterministic decision");
        }
        var allowed = new HashSet<String>();
        for (var evidence : request.evidence()) {
            allowed.add(evidence.id());
        }
        var unknownEvidence = response.evidenceIds().stream()
            .filter(id -> !allowed.contains(id))
            .toList();
        if (!unknownEvidence.isEmpty()) {
            throw new IllegalArgumentException(
                "AI explanation references unknown evidence: " + unknownEvidence);
        }
        if (response.summary().isBlank()) {
            throw new IllegalArgumentException("AI explanation summary is empty");
        }
        return response;
    }
}
