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

    public Optional<SourceDocument> updateSource(String id, String content, String hash) {
        var source = sources.get(id);
        if (source == null) return Optional.empty();
        var updated = new SourceDocument(source.id(), source.path(), source.title(), hash, content, source.importedAt());
        sources.put(id, updated);
        return Optional.of(updated);
    }

    public void invalidateDerived(String sourceId) {
        drafts.values().removeIf(draft -> draft.sourceDocumentId().equals(sourceId));
        rules.values().removeIf(rule -> rule.sourceDocumentId().equals(sourceId));
    }

    public void deleteSource(String id) {
        invalidateDerived(id);
        sources.remove(id);
    }

    public Optional<KnowledgeDraft> updateDraft(String id, String title, String summary) {
        var draft = drafts.get(id);
        if (draft == null) return Optional.empty();
        var updated = new KnowledgeDraft(draft.id(), draft.sourceDocumentId(), draft.kind(), title, summary,
            draft.sourceExcerpt(), draft.sourceLineStart(), draft.sourceLineEnd(), draft.extractionMethod(),
            draft.status(), draft.approvedBy(), draft.reviewedAt(), draft.conditions(), draft.action(),
            draft.mode(), draft.timeframe(), draft.priority(), draft.evidenceIds(),
            draft.invalidationConditions(), draft.strength());
        drafts.put(id, updated);
        return Optional.of(updated);
    }

    public List<PublishedRule> publishedRules() { return List.copyOf(rules.values()); }

    public Optional<PublishedRule> setRuleEnabled(String id, boolean enabled) {
        var rule = rules.get(id);
        if (rule == null) return Optional.empty();
        var updated = new PublishedRule(rule.id(), rule.sourceDocumentId(), rule.name(), rule.description(),
            rule.sourceExcerpt(), rule.sourceLineStart(), rule.sourceLineEnd(), rule.approvedBy(),
            rule.publishedAt(), enabled, rule.conditions(), rule.action(), rule.mode(), rule.timeframe(),
            rule.priority(), rule.evidenceIds(), rule.invalidationConditions(), rule.strength());
        rules.put(id, updated);
        return Optional.of(updated);
    }
}
