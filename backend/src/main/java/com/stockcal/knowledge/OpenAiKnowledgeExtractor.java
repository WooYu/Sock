package com.stockcal.knowledge;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

final class OpenAiKnowledgeExtractor implements KnowledgeExtractor {
    private final KnowledgeAiClient client;
    private final JsonMapper json = JsonMapper.builder().build();

    OpenAiKnowledgeExtractor(KnowledgeAiClient client) { this.client = client; }

    public List<KnowledgeDraft> extract(SourceDocument source) {
        var lines = source.originalContent().split("\\R", -1);
        var numbered = new StringBuilder();
        for (var index = 0; index < lines.length; index++) {
            numbered.append(index + 1).append(" | ").append(lines[index]).append('\n');
        }
        try {
            JsonNode root = json.readTree(client.extract(numbered.toString()));
            var drafts = new ArrayList<KnowledgeDraft>();
            for (var item : root.path("items")) {
                var start = item.path("sourceLineStart").asInt();
                var end = item.path("sourceLineEnd").asInt();
                var excerpt = item.path("sourceExcerpt").asText();
                validateEvidence(lines, start, end, excerpt);
                var idSeed = source.id() + ":ai:" + start + ":" + end + ":" + excerpt;
                drafts.add(new KnowledgeDraft(
                    UUID.nameUUIDFromBytes(idSeed.getBytes(StandardCharsets.UTF_8)).toString(),
                    source.id(), KnowledgeKind.valueOf(item.path("kind").asText()),
                    item.path("title").asText(), item.path("summary").asText(), excerpt,
                    start, end, ExtractionMethod.AI, ApprovalStatus.PENDING, null, null));
            }
            return List.copyOf(drafts);
        } catch (IllegalArgumentException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IllegalStateException("AI 提炼结果无法解析", exception);
        }
    }

    private void validateEvidence(String[] lines, int start, int end, String excerpt) {
        if (start < 1 || end < start || end > lines.length || excerpt.isBlank()) {
            throw new IllegalArgumentException("AI 返回的原文证据行号无效");
        }
        var selected = String.join("\n", java.util.Arrays.copyOfRange(lines, start - 1, end));
        if (!selected.contains(excerpt)) {
            throw new IllegalArgumentException("AI 返回的原文证据与来源不一致");
        }
    }
}
