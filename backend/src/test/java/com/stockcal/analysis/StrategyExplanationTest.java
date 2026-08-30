package com.stockcal.analysis;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class StrategyExplanationTest {
    @Test
    void rejectsAnExplanationThatChangesTheDeterministicDecision() {
        var request = new StrategyExplanationRequest(
            "WAIT",
            null,
            "规则冲突",
            List.of("趋势进入", "破位退出"),
            List.of(),
            List.of("趋势进入", "破位退出"),
            List.of(),
            Map.of(),
            List.of(new StrategyEvidence("rule-1", "趋势进入", "原文证据")),
            null
        );
        var response = new StrategyExplanation(
            "ENTER",
            "现在可以买入",
            List.of("rule-1"),
            List.of(),
            List.of()
        );

        assertThatThrownBy(() -> StrategyExplanationValidator.validate(request, response))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("decision");
    }

    @Test
    void rejectsEvidenceIdsNotPresentInTheInput() {
        var request = new StrategyExplanationRequest(
            "WAIT",
            null,
            "缺少条件",
            List.of(),
            List.of("板块强弱"),
            List.of(),
            List.of(),
            Map.of(),
            List.of(new StrategyEvidence("known", "已知", "事实")),
            null
        );
        var response = new StrategyExplanation(
            "WAIT",
            "等待补齐条件",
            List.of("invented"),
            List.of(),
            List.of("板块强弱")
        );

        assertThatThrownBy(() -> StrategyExplanationValidator.validate(request, response))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("evidence");
    }

    @Test
    void preservesWaitAsAnExplanationOnlyState() {
        var request = new StrategyExplanationRequest(
            "WAIT",
            null,
            "必要条件不完整",
            List.of(),
            List.of("行情新鲜度"),
            List.of(),
            List.of(),
            Map.of(),
            List.of(),
            null
        );
        var response = new StrategyExplanation(
            "WAIT",
            "当前只等待行情新鲜度确认",
            List.of(),
            List.of("行情可能过期"),
            List.of("行情新鲜度")
        );

        assertThat(StrategyExplanationValidator.validate(request, response))
            .isEqualTo(response);
    }
}
