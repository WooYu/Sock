package com.stockcal.knowledge;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;

final class KnowledgeWorkflow {
    private final KnowledgeRepository repository;
    private final KnowledgeExtractor extractor;
    private final Supplier<Instant> clock;

    KnowledgeWorkflow(KnowledgeRepository repository, KnowledgeExtractor extractor, Supplier<Instant> clock) {
        this.repository = repository;
        this.extractor = extractor;
        this.clock = clock;
    }

    SourceDocument importNote(Path path, String originalContent) {
        var normalizedPath = path.toString().replace('\\', '/');
        var hash = sha256(originalContent);
        var existing = repository.sourceByPathAndHash(normalizedPath, hash);
        if (existing.isPresent()) return existing.get();
        var filename = path.getFileName().toString();
        var title = filename.endsWith(".md") ? filename.substring(0, filename.length() - 3) : filename;
        var source = new SourceDocument(UUID.randomUUID().toString(), normalizedPath, title, hash,
            originalContent, clock.get());
        repository.saveSource(source);
        return source;
    }

    List<SourceDocument> sources() { return repository.sources(); }
    List<KnowledgeDraft> drafts(ApprovalStatus status) { return repository.drafts(status); }

    List<KnowledgeDraft> extract(String sourceId) {
        var existing = repository.draftsForSource(sourceId);
        if (!existing.isEmpty()) return existing;
        var source = repository.source(sourceId).orElseThrow(() -> new IllegalArgumentException("来源不存在"));
        var drafts = extractor.extract(source);
        drafts.forEach(repository::saveDraft);
        return drafts;
    }

    KnowledgeDraft approve(String draftId, String userId) {
        var draft = repository.draft(draftId).orElseThrow(() -> new IllegalArgumentException("知识条目不存在"));
        var approved = draft.approve(userId, clock.get());
        repository.saveDraft(approved);
        return approved;
    }

    PublishedRule publishRule(String draftId) {
        var draft = repository.draft(draftId).orElseThrow(() -> new IllegalArgumentException("知识条目不存在"));
        if (draft.kind() != KnowledgeKind.RULE || draft.status() != ApprovalStatus.APPROVED) {
            throw new IllegalStateException("规则必须先由用户批准");
        }
        var rule = new PublishedRule(UUID.randomUUID().toString(), draft.sourceDocumentId(), draft.title(),
            draft.summary(), draft.sourceExcerpt(), draft.sourceLineStart(), draft.sourceLineEnd(),
            draft.approvedBy(), clock.get(), true, draft.conditions(), draft.action(), draft.mode(),
            draft.timeframe(), draft.priority(), draft.evidenceIds(), draft.invalidationConditions(),
            draft.strength());
        repository.savePublishedRule(rule);
        return rule;
    }

    SourceDocument updateSource(String id, String content) {
        var updated = repository.updateSource(id, content, sha256(content))
            .orElseThrow(() -> new IllegalArgumentException("来源不存在"));
        repository.invalidateDerived(id);
        return updated;
    }

    void deleteSource(String id) { repository.deleteSource(id); }

    KnowledgeDraft updateDraft(String id, String title, String summary) {
        return repository.updateDraft(id, title, summary)
            .orElseThrow(() -> new IllegalArgumentException("知识条目不存在"));
    }

    List<PublishedRule> rules() { return repository.publishedRules(); }

    PublishedRule toggleRule(String id, boolean enabled) {
        return repository.setRuleEnabled(id, enabled)
            .orElseThrow(() -> new IllegalArgumentException("规则不存在"));
    }

    private String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }
}
