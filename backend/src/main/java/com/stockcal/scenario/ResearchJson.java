package com.stockcal.scenario;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.TreeMap;
import java.util.ArrayList;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

final class ResearchJson {
    static final JsonMapper JSON = JsonMapper.builder().build();
    private ResearchJson() {}
    static String hash(String text) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
    static String canonical(Object value) { return JSON.writeValueAsString(sorted(JSON.valueToTree(value))); }
    private static Object sorted(JsonNode node) {
        if (node.isObject()) {
            var result = new TreeMap<String,Object>();
            node.properties().forEach(e -> result.put(e.getKey(), sorted(e.getValue()))); return result;
        }
        if (node.isArray()) { var result = new ArrayList<Object>(); node.forEach(n -> result.add(sorted(n))); return result; }
        if (node.isNumber() && !Double.isFinite(node.asDouble())) throw new IllegalArgumentException("非有限数无效");
        return node;
    }
}
