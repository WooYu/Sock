package com.stockcal.review;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class ChatCompletionsReviewClientTest {
    @Test
    void postsChatCompletionAndReturnsAssistantText() {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        server.expect(once(), requestTo("https://api.deepseek.com/chat/completions"))
            .andExpect(header("Authorization", "Bearer test-key"))
            .andExpect(jsonPath("$.model").value("deepseek-chat"))
            .andExpect(jsonPath("$.messages[0].role").value("system"))
            .andRespond(withSuccess("""
                {"choices":[{"message":{"content":"复盘说明"}}]}
                """, MediaType.APPLICATION_JSON));
        var client = new ChatCompletionsReviewClient(
            builder.build(), "https://api.deepseek.com", "test-key", "deepseek-chat");

        var snapshot = new ReviewSnapshot("r1", "600519", Instant.parse("2026-08-14T00:00:00Z"),
            1700, 1715, 1730, 2, 1750, "突破回踩", "量能不足");
        var result = client.explain(snapshot);

        assertThat(result).isEqualTo("复盘说明");
        server.verify();
    }
}
