package com.stockcal.market;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

final class HttpTushareClient implements TushareClient {
    private final RestClient rest;
    private final String token;

    HttpTushareClient(RestClient rest, String token) {
        this.rest = rest;
        this.token = token;
    }

    public List<Map<String, Object>> query(String api, Map<String, String> params, List<String> fields) {
        var response = rest.post().uri("https://api.tushare.pro")
            .contentType(MediaType.APPLICATION_JSON)
            .body(Map.of(
                "api_name", api,
                "token", token,
                "params", params,
                "fields", String.join(",", fields)
            )).retrieve().body(JsonNode.class);
        if (response == null) throw new IllegalStateException("Tushare 没有返回内容");
        if (response.path("code").asInt() != 0) {
            throw new IllegalStateException("Tushare 请求失败：" + response.path("msg").asText());
        }
        var names = new ArrayList<String>();
        response.path("data").path("fields").forEach(node -> names.add(node.asText()));
        var rows = new ArrayList<Map<String, Object>>();
        for (var item : response.path("data").path("items")) {
            var row = new LinkedHashMap<String, Object>();
            for (var index = 0; index < names.size(); index++) {
                row.put(names.get(index), value(item.get(index)));
            }
            rows.add(Map.copyOf(row));
        }
        return List.copyOf(rows);
    }

    private Object value(JsonNode node) {
        if (node == null || node.isNull()) return "";
        if (node.isIntegralNumber()) return node.asLong();
        if (node.isNumber()) return node.asDouble();
        if (node.isBoolean()) return node.asBoolean();
        return node.asText();
    }
}
