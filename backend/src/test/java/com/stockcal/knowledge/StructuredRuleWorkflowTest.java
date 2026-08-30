package com.stockcal.knowledge;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class StructuredRuleWorkflowTest {
    @Test
    void publishesOnlyApprovedStructuredRuleMetadata() {
        var extractor = (KnowledgeExtractor) source -> List.of(
            new KnowledgeDraft(
                "draft-1",
                source.id(),
                KnowledgeKind.RULE,
                "站上五日线",
                "收盘站上 MA5 才进入",
                "收盘站上 MA5 才进入",
                1,
                1,
                ExtractionMethod.AI,
                ApprovalStatus.PENDING,
                null,
                null,
                List.of(new RuleConditionSpec("closeAboveMa5", "equals", 1)),
                "ENTER",
                "BASE_GRANVILLE",
                "日线",
                10,
                List.of("source:1-1"),
                List.of("收盘跌破 MA5"),
                "PRINCIPLE"
            )
        );
        var workflow = new KnowledgeWorkflow(
            new InMemoryKnowledgeRepository(),
            extractor,
            () -> Instant.parse("2026-08-30T00:00:00Z")
        );
        var source = workflow.importNote(Path.of("股票", "规则.md"), "收盘站上 MA5 才进入");

        var draft = workflow.extract(source.id()).getFirst();
        workflow.approve(draft.id(), "user-1");
        var published = workflow.publishRule(draft.id());

        assertThat(published.conditions()).containsExactly(
            new RuleConditionSpec("closeAboveMa5", "equals", 1)
        );
        assertThat(published.action()).isEqualTo("ENTER");
        assertThat(published.mode()).isEqualTo("BASE_GRANVILLE");
        assertThat(published.priority()).isEqualTo(10);
        assertThat(published.evidenceIds()).containsExactly("source:1-1");
        assertThat(published.invalidationConditions()).containsExactly("收盘跌破 MA5");
        assertThat(published.strength()).isEqualTo("PRINCIPLE");
    }

    @Test
    void sourceChangesInvalidatePreviouslyExtractedDerivedRules() {
        var repository = new InMemoryKnowledgeRepository();
        var workflow = new KnowledgeWorkflow(
            repository,
            new NoteExtractor(),
            () -> Instant.parse("2026-08-30T00:00:00Z")
        );
        var source = workflow.importNote(Path.of("规则.md"), "规则：收盘站上 MA5。");
        workflow.extract(source.id());

        workflow.updateSource(source.id(), "规则：收盘站上 MA20。");

        assertThat(workflow.drafts(null)).isEmpty();
    }
}
