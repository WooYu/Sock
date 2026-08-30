package com.stockcal.knowledge;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import tools.jackson.databind.JsonNode;

final class StructuredRuleSpec {
    private static final Set<String> FIELDS = Set.of(
        "closeAboveMa20", "volumeRatio", "supportDistance", "closeAboveMa5",
        "closeAboveBollMiddle", "ma5SlopePositive", "bollMiddleSlopePositive",
        "granvilleDay", "phase", "marketPanic", "relativeStrength",
        "phase3Opening", "mirrorRetest"
    );
    private static final Set<String> OPERATORS = Set.of(
        "equals", "greaterThan", "greaterThanOrEqual", "lessThan",
        "lessThanOrEqual"
    );
    private static final Set<String> ACTIONS = Set.of(
        "ENTER", "HOLD", "REDUCE", "EXIT", "AVOID", "WAIT"
    );
    private static final Set<String> MODES = Set.of(
        "BASE_GRANVILLE", "PHASE3_OPENING", "SEA_TURTLE", "REBOUND",
        "MIRROR_RETEST", "SIDEWAYS_PHASE3", "MONTHLY_WAIT", "DEMON_STOCK",
        "EXCLUSION"
    );
    private static final Set<String> TIMEFRAMES = Set.of("日线", "分钟线", "周线", "月线");
    private static final Set<String> STRENGTHS = Set.of(
        "PRINCIPLE", "EXPERIENCE", "PREFERENCE", "OBSERVATION", "UNSPECIFIED"
    );

    private StructuredRuleSpec() {}

    static List<RuleConditionSpec> conditions(JsonNode item) {
        var node = item.path("conditions");
        if (!node.isArray()) return List.of();
        var result = new java.util.ArrayList<RuleConditionSpec>();
        for (var condition : node) {
            var field = condition.path("field").asText();
            var operator = condition.path("operator").asText();
            if (!FIELDS.contains(field) || !OPERATORS.contains(operator)
                || !condition.path("value").isNumber()) {
                throw new IllegalArgumentException("AI 返回的规则条件无法识别");
            }
            result.add(new RuleConditionSpec(
                field, operator, condition.path("value").asDouble()));
        }
        return List.copyOf(result);
    }

    static String action(JsonNode item) {
        var value = item.path("action").asText("WAIT").toUpperCase(Locale.ROOT);
        if (!ACTIONS.contains(value)) {
            throw new IllegalArgumentException("AI 返回的规则动作无法识别");
        }
        return value;
    }

    static String mode(JsonNode item) {
        var value = item.path("mode").asText("BASE_GRANVILLE").toUpperCase(Locale.ROOT);
        if (!MODES.contains(value)) {
            throw new IllegalArgumentException("AI 返回的策略模式无法识别");
        }
        return value;
    }

    static String timeframe(JsonNode item) {
        var value = item.path("timeframe").asText("日线");
        if (!TIMEFRAMES.contains(value)) {
            throw new IllegalArgumentException("AI 返回的周期无效");
        }
        return value;
    }

    static int priority(JsonNode item) {
        var value = item.path("priority").asInt(50);
        if (value < 1 || value > 1000) {
            throw new IllegalArgumentException("AI 返回的优先级无效");
        }
        return value;
    }

    static List<String> invalidationConditions(JsonNode item) {
        var node = item.path("invalidationConditions");
        if (!node.isArray()) return List.of();
        var result = new java.util.ArrayList<String>();
        for (var value : node) {
            var text = value.asText();
            if (text.isBlank() || text.length() > 500) {
                throw new IllegalArgumentException("AI 返回的失效条件无效");
            }
            result.add(text);
        }
        return List.copyOf(result);
    }

    static String strength(JsonNode item) {
        var value = item.path("strength").asText("UNSPECIFIED").toUpperCase(Locale.ROOT);
        if (!STRENGTHS.contains(value)) {
            throw new IllegalArgumentException("AI 返回的规则强度无法识别");
        }
        return value;
    }
}
