package com.stockcal.sync;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@WithMockUser(username = "user-1")
class SyncApiTest {
    @Autowired MockMvc mvc;

    @Test
    void duplicateIdempotencyKeyIsAppliedOnce() throws Exception {
        var body = """
            {"idempotencyKey":"watch:add:1","entityType":"WATCHLIST","entityId":"g1",
             "operation":"UPSERT","revision":1,"payload":{"name":"重点关注"}}
            """;
        mvc.perform(post("/api/v1/sync/mutations").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isOk()).andExpect(jsonPath("$.applied").value(true));
        mvc.perform(post("/api/v1/sync/mutations").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isOk()).andExpect(jsonPath("$.applied").value(false));
    }

    @Test
    void pullReturnsChangesAfterCursorIncludingTombstones() throws Exception {
        mvc.perform(post("/api/v1/sync/mutations").contentType(MediaType.APPLICATION_JSON).content("""
            {"idempotencyKey":"annotation:delete:1","entityType":"ANNOTATION","entityId":"a1",
             "operation":"DELETE","revision":2,"payload":{}}
            """));

        mvc.perform(get("/api/v1/sync/changes?cursor=0"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.nextCursor").isNumber())
            .andExpect(jsonPath("$.changes[0].operation").value("DELETE"));
    }

    @Test
    void staleRevisionIsRejected() throws Exception {
        mvc.perform(post("/api/v1/sync/mutations").contentType(MediaType.APPLICATION_JSON).content("""
            {"idempotencyKey":"annotation:upsert:2","entityType":"ANNOTATION","entityId":"a2",
             "operation":"UPSERT","revision":3,"payload":{}}
            """));
        mvc.perform(post("/api/v1/sync/mutations").contentType(MediaType.APPLICATION_JSON).content("""
            {"idempotencyKey":"annotation:upsert:1","entityType":"ANNOTATION","entityId":"a2",
             "operation":"UPSERT","revision":1,"payload":{}}
            """))
            .andExpect(status().isConflict());
    }
}
