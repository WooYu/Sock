package com.stockcal.analysis;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class ChatCompletionsStrategyExplanationClientTest {
    @Test
    void postsDeterministicDecisionAndParsesExplanation() {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        server.expect(once(), requestTo("https://api.deepseek.com/chat/completions"))
            .andExpect(header("Authorization", "Bearer test-key"))
            .andExpect(jsonPath("$.model").value("deepseek-chat"))
            .andExpect(jsonPath("$.messages[0].role").value("system"))
            .andExpect(jsonPath("$.messages[1].content").value(
                org.hamcrest.Matchers.containsString(""decision":"WAIT"")))
            .andRespond(withSuccess("""
                {"choices":[{"message":{"content":"{
                  "decision":"WAIT",
                  "summary":"等待条件补齐",
                  "evidenceIds":["freshness"],
                  "risks":["行情可能过期"],
                  "unknowns":["板块强弱"]
                }"}}]}
                """, MediaType.APPLICATION_JSON));
        var client = new ChatCompletionsStrategyExplanationClient(
            builder.build(), "https://api.deepseek.com", "test-key", "deepseek-chat");
        var request = new StrategyExplanationRequest(
            "WAIT",
            null,
            "必要条件不完整",
            List.of(),
            List.of("板块强弱"),
            List.of(),
            List.of(),
            Map.of("lastClose", 100),
            List.of(new StrategyEvidence("freshness", "行情新鲜度", "已知")),
            null
        );

        var result = client.explain(request);

        assertThat(result.decision()).isEqualTo("WAIT");
        assertThat(result.evidenceIds()).containsExactly("freshness");
        server.verify();
    }
}
