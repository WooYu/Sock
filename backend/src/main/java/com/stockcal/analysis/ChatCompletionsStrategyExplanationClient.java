package com.stockcal.analysis;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

final class ChatCompletionsStrategyExplanationClient implements StrategyExplanationClient {
    private final RestClient rest;
    private final String baseUrl;
    private final String apiKey;
    private final String model;
    private final JsonMapper mapper = JsonMapper.builder().build();

    ChatCompletionsStrategyExplanationClient(
        RestClient rest,
        String baseUrl,
        String apiKey,
        String model
    ) {
        this.rest = rest;
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
        this.model = model;
    }

    @Override
    public StrategyExplanation explain(StrategyExplanationRequest request) {
        final String requestJson;
        try {
            requestJson = mapper.writeValueAsString(request);
        } catch (Exception error) {
            throw new IllegalStateException("无法序列化策略解释输入", error);
        }
        var responseText = rest.post().uri(endpoint())
            .contentType(MediaType.APPLICATION_JSON)
            .header("Authorization", "Bearer " + apiKey)
            .body(Map.of(
                "model", model,
                "messages", List.of(
                    Map.of("role", "system", "content", systemPrompt()),
                    Map.of("role", "user", "content", requestJson)
                ),
                "response_format", Map.of("type", "json_object")
            ))
            .retrieve().body(String.class);
        if (responseText == null || responseText.isBlank()) {
            throw new IllegalStateException("AI 服务没有返回内容");
        }
        final JsonNode response;
        try {
            response = mapper.readTree(responseText);
        } catch (Exception error) {
            throw new IllegalStateException("AI 服务返回内容不是有效 JSON", error);
        }
        var text = response.path("choices").path(0).path("message").path("content").asText();
        if (text.isBlank()) throw new IllegalStateException("AI 服务未返回结构化解释");
        try {
            var payload = mapper.readTree(text);
            var explanation = new StrategyExplanation(
                payload.path("decision").asText(),
                payload.path("summary").asText(),
                textArray(payload.path("evidenceIds")),
                textArray(payload.path("risks")),
                textArray(payload.path("unknowns"))
            );
            return StrategyExplanationValidator.validate(request, explanation);
        } catch (IllegalArgumentException error) {
            throw error;
        } catch (Exception error) {
            throw new IllegalStateException("AI 策略解释不是有效 JSON", error);
        }
    }

    private static List<String> textArray(JsonNode node) {
        var values = new ArrayList<String>();
        if (node != null && node.isArray()) {
            for (var item : node) {
                var value = item.asText();
                if (!value.isBlank()) values.add(value);
            }
        }
        return List.copyOf(values);
    }

    private static String systemPrompt() {
        return """
            你是 StockCal 的策略解释器。规则引擎已经确定 decision，你必须原样保留 decision。
            只能解释输入中的 reason、matchedRules、missingFacts、conflicts、invalidationConditions、
            snapshot、evidence 和 calibration；不得新增事实、规则、价格、目标或买卖建议。
            如果 decision 是 WAIT 或 AVOID，只能解释为什么等待或回避，不得把它改成 ENTER、HOLD、REDUCE 或 EXIT。
            输出且只输出一个 JSON 对象：
            {"decision":"原值","summary":"简洁中文解释","evidenceIds":["只能填输入 evidence 的 id"],
             "risks":["输入中可支持的风险"],"unknowns":["输入中明确缺失或未知的条件"]}。
            """;
    }

    private String endpoint() {
        return baseUrl.replaceFirst("/+$", "") + "/chat/completions";
    }
}
