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

@SpringBootTest
@AutoConfigureMockMvc
class MarketApiTest {
    @Autowired MockMvc mvc;

    @Test
    void searchesAshareByCodeNameAndPinyin() throws Exception {
        mvc.perform(get("/api/v1/market/search?q=gzmt").with(user("user-1")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].code").value("600519"))
            .andExpect(jsonPath("$[0].name").value("贵州茅台"));
    }

    @Test
    void quoteSnapshotIncludesCandlesLimitsAndSourceFreshness() throws Exception {
        mvc.perform(get("/api/v1/market/stocks/600519/snapshot").with(user("user-1")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.quote.price").isNumber())
            .andExpect(jsonPath("$.quote.limitRatio").value(0.10))
            .andExpect(jsonPath("$.dailyCandles.length()").value(40))
            .andExpect(jsonPath("$.source.name").isNotEmpty())
            .andExpect(jsonPath("$.source.fetchedAt").isNotEmpty())
            .andExpect(jsonPath("$.source.state").value("DELAYED"));
    }
}
