package com.stockcal.account;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = "stockcal.auth.required=false")
@AutoConfigureMockMvc
class AccountPortfolioApiTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcClient jdbc;

    @BeforeEach
    void reset() {
        jdbc.sql("delete from account_trade").update();
    }

    @Test
    void anonymousClientCanPersistTradesAndReadCalculatedHoldings() throws Exception {
        mvc.perform(post("/api/v1/account/trades")
                .header("X-Client-Id", "browser-1")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"id":"trade-1","symbol":"600519","side":"buy","quantity":100,
                     "price":1700,"fee":5,"tradedAt":"2026-08-28T07:00:00Z",
                     "note":"首次建仓","revision":1}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value("trade-1"));

        mvc.perform(get("/api/v1/account/portfolio").header("X-Client-Id", "browser-1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.trades.length()").value(1))
            .andExpect(jsonPath("$.holdings[0].symbol").value("600519"))
            .andExpect(jsonPath("$.holdings[0].quantity").value(100));
    }

    @Test
    void rejectsAStaleTradeRevision() throws Exception {
        var body = """
            {"id":"trade-2","symbol":"600519","side":"buy","quantity":100,
             "price":1700,"fee":0,"tradedAt":"2026-08-28T07:00:00Z","revision":2}
            """;
        mvc.perform(post("/api/v1/account/trades").header("X-Client-Id", "browser-1")
                .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isOk());
        mvc.perform(post("/api/v1/account/trades").header("X-Client-Id", "browser-1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body.replace(""revision":2", ""revision":1")))
            .andExpect(status().isConflict());
    }
}
