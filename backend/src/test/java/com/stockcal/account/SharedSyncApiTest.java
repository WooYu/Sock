package com.stockcal.account;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = "stockcal.auth.required=false")
@AutoConfigureMockMvc
class SharedSyncApiTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcClient jdbc;
    @Test void otherAccountReadsAndEditsSharedEntityAndStaleRevisionConflicts() throws Exception {
        jdbc.sql("delete from sync_change").update();
        var body = """
            {"idempotencyKey":"shared-a","entityType":"SHARED_DATA","entityId":"stockcal:research-list:v1",
             "operation":"UPSERT","revision":1,"payload":{"raw":"{}"}}
            """;
        mvc.perform(post("/api/v1/sync/mutations").with(user("account-a")).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk());
        mvc.perform(get("/api/v1/sync/changes").with(user("account-b")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.changes.length()").value(1));
        mvc.perform(post("/api/v1/sync/mutations").with(user("account-b")).contentType(MediaType.APPLICATION_JSON)
            .content(body.replace("shared-a", "shared-b"))).andExpect(status().isConflict());
        mvc.perform(post("/api/v1/sync/mutations").with(user("account-b")).contentType(MediaType.APPLICATION_JSON)
            .content(body.replace("shared-a", "shared-b").replace("\"revision\":1", "\"revision\":2"))).andExpect(status().isOk());
    }
}
