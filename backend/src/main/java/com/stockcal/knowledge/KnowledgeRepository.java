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
    Optional<SourceDocument> updateSource(String id, String content, String hash);
    void invalidateDerived(String sourceId);
    void deleteSource(String id);
    Optional<KnowledgeDraft> updateDraft(String id, String title, String summary);
    List<PublishedRule> publishedRules();
    Optional<PublishedRule> setRuleEnabled(String id, boolean enabled);
}
