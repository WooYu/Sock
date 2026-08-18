package com.stockcal.review;

import java.util.List;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

final class ChatCompletionsReviewClient implements ReviewExplanationClient {
    private final RestClient rest;
    private final String baseUrl;
    private final String apiKey;
    private final String model;

    ChatCompletionsReviewClient(RestClient rest, String baseUrl, String apiKey, String model) {
        this.rest = rest;
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
        this.model = model;
    }

    @Override
    public String explain(ReviewSnapshot snapshot) {
        var facts = """
            股票代码: %s
            交易时间: %s
            计划价: %s
            实际成交价: %s
            实际收盘价: %s
            预测版本: %s
            预测目标: %s
            执行理由: %s
            失效原因: %s
            """.formatted(snapshot.stockCode(), snapshot.tradedAt(), snapshot.plannedPrice(),
                snapshot.actualPrice(), snapshot.actualClose(), snapshot.predictionVersion(),
                snapshot.predictedTarget(), snapshot.reason(), snapshot.invalidationReason());
        var response = rest.post().uri(endpoint())
            .contentType(MediaType.APPLICATION_JSON)
            .header("Authorization", "Bearer " + apiKey)
            .body(Map.of(
                "model", model,
                "messages", List.of(
                    Map.of("role", "system", "content",
                        "你是 StockCal 交易复盘助手。只能解释用户提供的确定性事实，不得修改、补充或预测任何价格。用简洁中文说明执行偏差、预测误差、风险和可复用经验，并注明不构成投资建议。"),
                    Map.of("role", "user", "content", facts)
                )
            )).retrieve().body(JsonNode.class);
        if (response == null) throw new IllegalStateException("AI 服务没有返回内容");
        var text = response.path("choices").path(0).path("message").path("content").asText();
        if (text.isBlank()) throw new IllegalStateException("AI 服务未返回复盘文本");
        return text;
    }

    private String endpoint() {
        return baseUrl.replaceFirst("/+$", "") + "/chat/completions";
    }
}
