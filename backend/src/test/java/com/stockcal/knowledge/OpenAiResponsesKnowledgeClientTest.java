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

class OpenAiResponsesKnowledgeClientTest {
    @Test
    void requestsStrictStructuredOutputAndReturnsOutputText() {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        server.expect(once(), requestTo("https://api.openai.com/v1/responses"))
            .andExpect(header("Authorization", "Bearer test-key"))
            .andExpect(jsonPath("$.model").value("gpt-4o-mini"))
            .andExpect(jsonPath("$.text.format.type").value("json_schema"))
            .andExpect(jsonPath("$.text.format.strict").value(true))
            .andRespond(withSuccess("""
                {"output":[{"type":"message","content":[{"type":"output_text","text":"{\\"items\\":[]}"}]}]}
                """, MediaType.APPLICATION_JSON));
        var client = new OpenAiResponsesKnowledgeClient(builder.build(), "test-key", "gpt-4o-mini");

        var result = client.extract("1 | 海龟是筑底形态。");

        assertThat(result).isEqualTo("{\"items\":[]}");
        server.verify();
    }
}
