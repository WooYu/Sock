package com.stockcal.knowledge;

import java.util.List;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

final class OpenAiResponsesKnowledgeClient implements KnowledgeAiClient {
    private final RestClient rest;
    private final String apiKey;
    private final String model;

    OpenAiResponsesKnowledgeClient(RestClient rest, String apiKey, String model) {
        this.rest = rest;
        this.apiKey = apiKey;
        this.model = model;
    }

    public String extract(String lineNumberedContent) {
        var response = rest.post().uri("https://api.openai.com/v1/responses")
            .contentType(MediaType.APPLICATION_JSON)
            .header("Authorization", "Bearer " + apiKey)
            .body(Map.of(
                "model", model,
                "input", List.of(
                    Map.of("role", "developer", "content", "你是股票学习笔记结构化提炼器。只提取原文明确表达的规则、经验和概念，不推测，不提供新的投资建议。每条必须引用连续原文并给出准确行号。"),
                    Map.of("role", "user", "content", lineNumberedContent)
                ),
                "text", Map.of("format", Map.of(
                    "type", "json_schema",
                    "name", "stockcal_knowledge",
                    "strict", true,
                    "schema", schema()
                ))
            ))
            .retrieve().body(JsonNode.class);
        if (response == null) throw new IllegalStateException("AI 服务没有返回内容");
        for (var output : response.path("output")) {
            for (var content : output.path("content")) {
                if (content.path("type").asText().equals("output_text")) {
                    return content.path("text").asText();
                }
            }
        }
        throw new IllegalStateException("AI 服务未返回结构化文本");
    }

    private Map<String, Object> schema() {
        var itemProperties = Map.<String, Object>of(
            "kind", Map.of("type", "string", "enum", List.of("RULE", "EXPERIENCE", "CONCEPT")),
            "title", Map.of("type", "string"),
            "summary", Map.of("type", "string"),
            "sourceExcerpt", Map.of("type", "string"),
            "sourceLineStart", Map.of("type", "integer", "minimum", 1),
            "sourceLineEnd", Map.of("type", "integer", "minimum", 1)
        );
        return Map.of(
            "type", "object",
            "additionalProperties", false,
            "properties", Map.of("items", Map.of(
                "type", "array",
                "items", Map.of(
                    "type", "object",
                    "additionalProperties", false,
                    "properties", itemProperties,
                    "required", List.of("kind", "title", "summary", "sourceExcerpt", "sourceLineStart", "sourceLineEnd")
                )
            )),
            "required", List.of("items")
        );
    }
}
