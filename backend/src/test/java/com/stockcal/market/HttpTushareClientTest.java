package com.stockcal.market;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class HttpTushareClientTest {
    @Test
    void mapsFieldAndItemArraysWithoutExposingTokenInResponses() {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("https://api.tushare.pro"))
            .andExpect(jsonPath("$.api_name").value("daily"))
            .andExpect(jsonPath("$.token").value("market-token"))
            .andExpect(jsonPath("$.params.ts_code").value("600519.SH"))
            .andRespond(withSuccess("""
                {"code":0,"msg":null,"data":{"fields":["trade_date","close"],"items":[["20260814",1742.0]]}}
                """, MediaType.APPLICATION_JSON));
        var client = new HttpTushareClient(builder.build(), "market-token");

        var rows = client.query("daily", Map.of("ts_code", "600519.SH"), List.of("trade_date", "close"));

        assertThat(rows).containsExactly(Map.of("trade_date", "20260814", "close", 1742.0));
        server.verify();
    }
}
