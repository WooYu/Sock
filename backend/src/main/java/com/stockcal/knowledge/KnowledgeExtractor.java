package com.stockcal.knowledge;

import java.util.List;

interface KnowledgeExtractor {
    List<KnowledgeDraft> extract(SourceDocument source);
}
