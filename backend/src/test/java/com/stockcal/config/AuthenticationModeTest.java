package com.stockcal.config;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = "stockcal.auth.required=false")
@AutoConfigureMockMvc
class AuthenticationModeTest {
    @Autowired MockMvc mvc;

    @Test
    void permitsUnauthenticatedApiRequestsWhenAuthenticationIsDisabled() throws Exception {
        mvc.perform(get("/api/v1/market/search?q=600519"))
            .andExpect(status().isOk());
    }
}
