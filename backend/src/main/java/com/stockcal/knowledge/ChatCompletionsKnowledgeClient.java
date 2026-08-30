package com.stockcal.knowledge;

import java.util.List;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

final class ChatCompletionsKnowledgeClient implements KnowledgeAiClient {
    private final RestClient rest;
    private final String baseUrl;
    private final String apiKey;
    private final String model;

    ChatCompletionsKnowledgeClient(RestClient rest, String baseUrl, String apiKey, String model) {
        this.rest = rest;
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
        this.model = model;
    }

    public String extract(String lineNumberedContent) {
        var response = rest.post().uri(endpoint())
            .contentType(MediaType.APPLICATION_JSON)
            .header("Authorization", "Bearer " + apiKey)
            .body(Map.of(
                "model", model,
                "messages", List.of(
                    Map.of("role", "system", "content", systemPrompt()),
                    Map.of("role", "user", "content", lineNumberedContent)
                ),
                "response_format", Map.of("type", "json_object")
            ))
            .retrieve().body(JsonNode.class);
        if (response == null) throw new IllegalStateException("AI 服务没有返回内容");
        var text = response.path("choices").path(0).path("message").path("content").asText();
        if (text.isBlank()) throw new IllegalStateException("AI 服务未返回结构化文本");
        return text;
    }

    private static String systemPrompt() {
        return """
            你是股票学习笔记结构化提炼器。只提取原文明确表达的规则、经验和概念，不推测，不提供新的投资建议。
            每条必须引用连续原文并给出准确行号。
            对 RULE 只在原文明确给出可验证条件时填写 conditions；无法转成结构化条件时必须返回空数组，并把 action 设为 WAIT。
            不要把 EXPERIENCE 或 CONCEPT 变成交易规则；不要为了凑出 ENTER 而补写阈值、均线或价格。
            仅输出一个 JSON 对象，格式为：
            {"items":[{"kind":"RULE|EXPERIENCE|CONCEPT","title":"...","summary":"...","sourceExcerpt":"...","sourceLineStart":1,"sourceLineEnd":1,"conditions":[{"field":"closeAboveMa5","operator":"equals","value":1}],"action":"ENTER|HOLD|REDUCE|EXIT|AVOID|WAIT","mode":"BASE_GRANVILLE|PHASE3_OPENING|SEA_TURTLE|REBOUND|MIRROR_RETEST|SIDEWAYS_PHASE3|MONTHLY_WAIT|DEMON_STOCK|EXCLUSION","timeframe":"日线","priority":50}]}。
            conditions 的 field 只能使用 closeAboveMa20、volumeRatio、supportDistance、closeAboveMa5、closeAboveBollMiddle、ma5SlopePositive、bollMiddleSlopePositive、granvilleDay、phase、marketPanic、relativeStrength、phase3Opening、mirrorRetest；operator 只能使用 equals、greaterThan、greaterThanOrEqual、lessThan、lessThanOrEqual。
            """;
    }

    private String endpoint() {
        return baseUrl.replaceFirst("/+$", "") + "/chat/completions";
    }
}
