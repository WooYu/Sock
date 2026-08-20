package com.stockcal.knowledge;

import java.time.Instant;

enum KnowledgeKind { RULE, EXPERIENCE, CONCEPT }

enum ApprovalStatus { PENDING, APPROVED, REJECTED }

enum ExtractionMethod { AI, LOCAL }

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
    Instant reviewedAt
) {
    KnowledgeDraft approve(String userId, Instant at) {
        return new KnowledgeDraft(id, sourceDocumentId, kind, title, summary, sourceExcerpt,
            sourceLineStart, sourceLineEnd, extractionMethod, ApprovalStatus.APPROVED, userId, at);
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
    boolean enabled
) {}
