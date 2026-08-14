package com.stockcal.knowledge;

import java.util.List;
import java.util.Optional;

interface KnowledgeRepository {
    Optional<SourceDocument> sourceByPathAndHash(String path, String hash);
    Optional<SourceDocument> source(String id);
    void saveSource(SourceDocument source);
    List<SourceDocument> sources();
    void saveDraft(KnowledgeDraft draft);
    Optional<KnowledgeDraft> draft(String id);
    List<KnowledgeDraft> draftsForSource(String sourceId);
    List<KnowledgeDraft> drafts(ApprovalStatus status);
    void savePublishedRule(PublishedRule rule);
}
