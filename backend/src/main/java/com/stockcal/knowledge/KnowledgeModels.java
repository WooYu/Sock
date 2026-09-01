package com.stockcal.knowledge;

import java.time.Instant;
import java.util.List;

enum KnowledgeKind { RULE, EXPERIENCE, CONCEPT, RISK_DISCIPLINE, CASE }

enum ApprovalStatus { PENDING, APPROVED, REJECTED }

enum ExtractionMethod { AI, LOCAL }

record RuleConditionSpec(
    String field,
    String operator,
    double value
) {}

record SourceDocument(
    String id,
    String path,
    String title,
    String contentHash,
    String originalContent,
    Instant importedAt
) {}

record KnowledgeDraft(
    String id,
    String sourceDocumentId,
    KnowledgeKind kind,
    String title,
    String summary,
    String sourceExcerpt,
    int sourceLineStart,
    int sourceLineEnd,
    ExtractionMethod extractionMethod,
    ApprovalStatus status,
    String approvedBy,
    Instant reviewedAt,
    List<RuleConditionSpec> conditions,
    String action,
    String mode,
    String timeframe,
    int priority,
    List<String> evidenceIds,
    List<String> invalidationConditions,
    String strength
) {
    KnowledgeDraft {
        conditions = conditions == null ? List.of() : List.copyOf(conditions);
        evidenceIds = evidenceIds == null ? List.of() : List.copyOf(evidenceIds);
        invalidationConditions = invalidationConditions == null
            ? List.of() : List.copyOf(invalidationConditions);
        strength = strength == null || strength.isBlank() ? "UNSPECIFIED" : strength;
    }

    KnowledgeDraft(
        String id,
        String sourceDocumentId,
        KnowledgeKind kind,
        String title,
        String summary,
        String sourceExcerpt,
        int sourceLineStart,
        int sourceLineEnd,
        ExtractionMethod extractionMethod,
        ApprovalStatus status,
        String approvedBy,
        Instant reviewedAt
    ) {
        this(id, sourceDocumentId, kind, title, summary, sourceExcerpt, sourceLineStart,
            sourceLineEnd, extractionMethod, status, approvedBy, reviewedAt, List.of(),
            "WAIT", "BASE_GRANVILLE", "日线", 50, List.of(), List.of(), "UNSPECIFIED");
    }

    KnowledgeDraft(
        String id,
        String sourceDocumentId,
        KnowledgeKind kind,
        String title,
        String summary,
        String sourceExcerpt,
        int sourceLineStart,
        int sourceLineEnd,
        ExtractionMethod extractionMethod,
        ApprovalStatus status,
        String approvedBy,
        Instant reviewedAt,
        List<RuleConditionSpec> conditions,
        String action,
        String mode,
        String timeframe,
        int priority,
        List<String> evidenceIds
    ) {
        this(id, sourceDocumentId, kind, title, summary, sourceExcerpt, sourceLineStart,
            sourceLineEnd, extractionMethod, status, approvedBy, reviewedAt, conditions,
            action, mode, timeframe, priority, evidenceIds, List.of(), "UNSPECIFIED");
    }

    KnowledgeDraft approve(String userId, Instant at) {
        return new KnowledgeDraft(id, sourceDocumentId, kind, title, summary, sourceExcerpt,
            sourceLineStart, sourceLineEnd, extractionMethod, ApprovalStatus.APPROVED, userId, at,
            conditions, action, mode, timeframe, priority, evidenceIds, invalidationConditions,
            strength);
    }
}

record PublishedRule(
    String id,
    String sourceDocumentId,
    String name,
    String description,
    String sourceExcerpt,
    int sourceLineStart,
    int sourceLineEnd,
    String approvedBy,
    Instant publishedAt,
    boolean enabled,
    List<RuleConditionSpec> conditions,
    String action,
    String mode,
    String timeframe,
    int priority,
    List<String> evidenceIds,
    List<String> invalidationConditions,
    String strength
) {
    PublishedRule {
        conditions = conditions == null ? List.of() : List.copyOf(conditions);
        evidenceIds = evidenceIds == null ? List.of() : List.copyOf(evidenceIds);
        invalidationConditions = invalidationConditions == null
            ? List.of() : List.copyOf(invalidationConditions);
        strength = strength == null || strength.isBlank() ? "UNSPECIFIED" : strength;
    }

    PublishedRule(
        String id,
        String sourceDocumentId,
        String name,
        String description,
        String sourceExcerpt,
        int sourceLineStart,
        int sourceLineEnd,
        String approvedBy,
        Instant publishedAt,
        boolean enabled
    ) {
        this(id, sourceDocumentId, name, description, sourceExcerpt, sourceLineStart, sourceLineEnd,
            approvedBy, publishedAt, enabled, List.of(), "WAIT", "BASE_GRANVILLE", "日线", 50,
            List.of(), List.of(), "UNSPECIFIED");
    }

    PublishedRule(
        String id,
        String sourceDocumentId,
        String name,
        String description,
        String sourceExcerpt,
        int sourceLineStart,
        int sourceLineEnd,
        String approvedBy,
        Instant publishedAt,
        boolean enabled,
        List<RuleConditionSpec> conditions,
        String action,
        String mode,
        String timeframe,
        int priority,
        List<String> evidenceIds
    ) {
        this(id, sourceDocumentId, name, description, sourceExcerpt, sourceLineStart, sourceLineEnd,
            approvedBy, publishedAt, enabled, conditions, action, mode, timeframe, priority,
            evidenceIds, List.of(), "UNSPECIFIED");
    }
}
