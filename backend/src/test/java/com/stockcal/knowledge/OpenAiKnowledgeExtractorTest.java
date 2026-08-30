package com.stockcal.knowledge;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import org.junit.jupiter.api.Test;

class OpenAiKnowledgeExtractorTest {
    private final SourceDocument source = new SourceDocument(
        "s1", "股票/关键点.md", "关键点", "hash",
        "关键点规则：触达目标位时减仓。\n经验：不要因为涨停改变纪律。", Instant.parse("2026-08-14T00:00:00Z"));

    @Test
    void mapsStructuredAiOutputAndKeepsVerifiableSourceEvidence() {
        var client = new RecordingKnowledgeAiClient("""
            {"items":[
              {"kind":"RULE","title":"目标位减仓","summary":"价格触达目标位时执行减仓", "sourceExcerpt":"关键点规则：触达目标位时减仓。","sourceLineStart":1,"sourceLineEnd":1,"conditions":[{"field":"supportDistance","operator":"lessThanOrEqual","value":0.05}],"action":"REDUCE","mode":"REBOUND","timeframe":"日线","priority":12,"invalidationConditions":["收盘跌破 MA5"],"strength":"EXPERIENCE"},
              {"kind":"EXPERIENCE","title":"遵守纪律","summary":"不因短期涨停改变计划", "sourceExcerpt":"经验：不要因为涨停改变纪律。","sourceLineStart":2,"sourceLineEnd":2}
            ]}
            """);

        var drafts = new OpenAiKnowledgeExtractor(client).extract(source);

        assertThat(client.lastInput).contains("1 | 关键点规则").contains("2 | 经验");
        assertThat(drafts).hasSize(2);
        assertThat(drafts.getFirst().kind()).isEqualTo(KnowledgeKind.RULE);
        assertThat(drafts.getFirst().status()).isEqualTo(ApprovalStatus.PENDING);
        assertThat(drafts.getFirst().extractionMethod()).isEqualTo(ExtractionMethod.AI);
        assertThat(drafts.getFirst().sourceExcerpt()).isEqualTo("关键点规则：触达目标位时减仓。");
        assertThat(drafts.getFirst().conditions()).containsExactly(
            new RuleConditionSpec("supportDistance", "lessThanOrEqual", 0.05)
        );
        assertThat(drafts.getFirst().action()).isEqualTo("REDUCE");
        assertThat(drafts.getFirst().mode()).isEqualTo("REBOUND");
        assertThat(drafts.getFirst().priority()).isEqualTo(12);
        assertThat(drafts.getFirst().invalidationConditions()).containsExactly("收盘跌破 MA5");
        assertThat(drafts.getFirst().strength()).isEqualTo("EXPERIENCE");
    }

    @Test
    void rejectsAiEvidenceThatDoesNotExistAtReportedLines() {
        var client = new RecordingKnowledgeAiClient("""
            {"items":[{"kind":"RULE","title":"虚构规则","summary":"虚构", "sourceExcerpt":"原文没有这句话","sourceLineStart":1,"sourceLineEnd":1}]}
            """);

        assertThatThrownBy(() -> new OpenAiKnowledgeExtractor(client).extract(source))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("原文证据");
    }

    private static final class RecordingKnowledgeAiClient implements KnowledgeAiClient {
        private final String output;
        private String lastInput;
        private RecordingKnowledgeAiClient(String output) { this.output = output; }
        public String extract(String lineNumberedContent) {
            lastInput = lineNumberedContent;
            return output;
        }
    }
}
