package com.stockcal.knowledge;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

final class InMemoryKnowledgeRepository implements KnowledgeRepository {
    private final Map<String, SourceDocument> sources = new LinkedHashMap<>();
    private final Map<String, KnowledgeDraft> drafts = new LinkedHashMap<>();
    private final Map<String, PublishedRule> rules = new LinkedHashMap<>();

    public Optional<SourceDocument> sourceByPathAndHash(String path, String hash) {
        return sources.values().stream()
            .filter(source -> source.path().equals(path) && source.contentHash().equals(hash)).findFirst();
    }

    public Optional<SourceDocument> source(String id) { return Optional.ofNullable(sources.get(id)); }
    public void saveSource(SourceDocument source) { sources.put(source.id(), source); }
    public List<SourceDocument> sources() { return List.copyOf(sources.values()); }
    public void saveDraft(KnowledgeDraft draft) { drafts.put(draft.id(), draft); }
    public Optional<KnowledgeDraft> draft(String id) { return Optional.ofNullable(drafts.get(id)); }
    public List<KnowledgeDraft> draftsForSource(String sourceId) {
        return drafts.values().stream().filter(draft -> draft.sourceDocumentId().equals(sourceId)).toList();
    }
    public List<KnowledgeDraft> drafts(ApprovalStatus status) {
        return drafts.values().stream().filter(draft -> status == null || draft.status() == status).toList();
    }
    public void savePublishedRule(PublishedRule rule) { rules.put(rule.id(), rule); }
}
