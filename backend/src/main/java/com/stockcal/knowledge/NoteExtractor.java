package com.stockcal.knowledge;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

final class NoteExtractor implements KnowledgeExtractor {
    public List<KnowledgeDraft> extract(SourceDocument source) {
        var results = new ArrayList<KnowledgeDraft>();
        var lines = source.originalContent().split("\\R", -1);
        var inFrontMatter = false;
        for (var index = 0; index < lines.length; index++) {
            var line = lines[index].trim();
            if (line.equals("---")) {
                inFrontMatter = !inFrontMatter;
                continue;
            }
            if (inFrontMatter || line.isBlank() || line.startsWith("[") && line.contains("](")) continue;
            for (var sentence : line.split("(?<=[。！？；])")) {
                var text = sentence.trim();
                if (text.isBlank()) continue;
                var kind = classify(text);
                if (kind == null) continue;
                var id = UUID.nameUUIDFromBytes((source.id() + ":" + index + ":" + text).getBytes()).toString();
                results.add(new KnowledgeDraft(id, source.id(), kind, title(text), text, text,
                    index + 1, index + 1, ExtractionMethod.LOCAL, ApprovalStatus.PENDING, null, null));
            }
        }
        return results;
    }

    private KnowledgeKind classify(String text) {
        if (text.startsWith("经验：") || text.contains("心态") || text.contains("纪律")) return KnowledgeKind.EXPERIENCE;
        if (text.contains("规则：") || text.contains("关键点") || text.contains("目标位") || text.contains("只做")) {
            return KnowledgeKind.RULE;
        }
        if (text.contains("是") && (text.contains("形态") || text.contains("原理") || text.contains("概念"))) {
            return KnowledgeKind.CONCEPT;
        }
        return null;
    }

    private String title(String text) {
        var cleaned = text.replaceFirst("^(规则|经验|概念)[:：]", "").trim();
        return cleaned.length() <= 28 ? cleaned : cleaned.substring(0, 28);
    }
}
