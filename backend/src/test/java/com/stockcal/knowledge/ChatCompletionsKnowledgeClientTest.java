package com.stockcal.knowledge;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class ChatCompletionsKnowledgeClientTest {
    @Test
    void postsChatCompletionAndReturnsMessageContent() {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        server.expect(once(), requestTo("https://api.deepseek.com/chat/completions"))
            .andExpect(header("Authorization", "Bearer test-key"))
            .andExpect(jsonPath("$.model").value("deepseek-chat"))
            .andExpect(jsonPath("$.response_format.type").value("json_object"))
            .andRespond(withSuccess("""
                {"choices":[{"message":{"content":"{\\"items\\":[]}"}}]}
                """, MediaType.APPLICATION_JSON));
        var client = new ChatCompletionsKnowledgeClient(
            builder.build(), "https://api.deepseek.com", "test-key", "deepseek-chat");

        var result = client.extract("1 | 海龟是筑底形态。");

        assertThat(result).isEqualTo("{\"items\":[]}");
        server.verify();
    }
}
