package com.stockcal.market;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = "stockcal.market-api-key=")
@AutoConfigureMockMvc
class MarketApiTest {
    @Autowired MockMvc mvc;

    @Test
    void unconfiguredMarketDoesNotReturnInventedSearchResults() throws Exception {
        mvc.perform(get("/api/v1/market/search?q=gzmt").with(user("user-1")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void unconfiguredMarketReportsUnavailableInsteadOfDemoCandles() throws Exception {
        mvc.perform(get("/api/v1/market/stocks/600519/snapshot").with(user("user-1")))
            .andExpect(status().isServiceUnavailable());
    }
}
