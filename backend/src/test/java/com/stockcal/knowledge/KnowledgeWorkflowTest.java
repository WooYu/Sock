package com.stockcal.knowledge;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class KnowledgeWorkflowTest {
    private final KnowledgeWorkflow workflow = new KnowledgeWorkflow(
        new InMemoryKnowledgeRepository(), new NoteExtractor(), () -> Instant.parse("2026-08-14T10:00:00Z"));

    @Test
    void importsMarkdownWithOriginalContentAndStableHashWithoutDuplicates() {
        var path = Path.of("股票", "不做原则.md");
        var markdown = "---\ntags: [股票]\n---\n\n大盘暴跌时，只做五日线起步第一天。\n";

        var first = workflow.importNote(path, markdown);
        var second = workflow.importNote(path, markdown);

        assertThat(second.id()).isEqualTo(first.id());
        assertThat(first.title()).isEqualTo("不做原则");
        assertThat(first.originalContent()).isEqualTo(markdown);
        assertThat(first.contentHash()).hasSize(64);
        assertThat(workflow.sources()).hasSize(1);
    }

    @Test
    void extractedKnowledgeRequiresApprovalBeforeRulePublication() {
        var source = workflow.importNote(Path.of("关键点.md"),
            "关键点规则：股价触达目标位时减仓。经验：不要因为涨停改变纪律。");

        List<KnowledgeDraft> drafts = workflow.extract(source.id());

        assertThat(drafts).extracting(KnowledgeDraft::kind)
            .contains(KnowledgeKind.RULE, KnowledgeKind.EXPERIENCE);
        assertThat(drafts).allMatch(draft -> draft.status() == ApprovalStatus.PENDING);
        assertThat(drafts).allMatch(draft -> draft.extractionMethod() == ExtractionMethod.LOCAL);
        var rule = drafts.stream().filter(draft -> draft.kind() == KnowledgeKind.RULE).findFirst().orElseThrow();
        assertThatThrownBy(() -> workflow.publishRule(rule.id()))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("批准");

        workflow.approve(rule.id(), "user-1");
        var published = workflow.publishRule(rule.id());

        assertThat(published.sourceDocumentId()).isEqualTo(source.id());
        assertThat(published.sourceExcerpt()).contains("触达目标位");
        assertThat(published.approvedBy()).isEqualTo("user-1");
    }

    @Test
    void conceptsAndExperiencesRemainLinkedToTheirSourceLines() {
        var source = workflow.importNote(Path.of("海龟.md"),
            "海龟是筑底形态。\n经验：海龟通常只做两天或者两天半。\n");

        var drafts = workflow.extract(source.id());

        assertThat(drafts).anySatisfy(draft -> {
            assertThat(draft.kind()).isEqualTo(KnowledgeKind.CONCEPT);
            assertThat(draft.sourceLineStart()).isEqualTo(1);
            assertThat(draft.sourceExcerpt()).contains("筑底形态");
        });
        assertThat(drafts).anySatisfy(draft -> {
            assertThat(draft.kind()).isEqualTo(KnowledgeKind.EXPERIENCE);
            assertThat(draft.sourceLineStart()).isEqualTo(2);
        });
    }

    @Test
    void riskDisciplineNeverBecomesAnExecutableEntrySignal() {
        var source = workflow.importNote(Path.of("纪律.md"), "不借钱、不杠杆、不满仓，盘前先写计划。\n");

        var drafts = workflow.extract(source.id());

        assertThat(drafts).anySatisfy(draft -> {
            assertThat(draft.kind()).isEqualTo(KnowledgeKind.RISK_DISCIPLINE);
            assertThat(draft.action()).isEqualTo("WAIT");
        });
    }
}
