package com.stockcal.review;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@Import(ReviewAiApiTest.FakeConfiguration.class)
class ReviewAiApiTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcClient jdbc;
    @Autowired RecordingReviewExplanationClient client;

    @BeforeEach
    void reset() {
        jdbc.sql("delete from ai_call_log").update();
    }

    @Test
    void explainsDeterministicSnapshotAndAuditsCall() throws Exception {
        mvc.perform(post("/api/v1/reviews/explain")
                .with(user("13800138000"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"reviewId":"r1","stockCode":"600519","tradedAt":"2026-08-14T00:00:00Z",
                    "plannedPrice":1700,"actualPrice":1715,"actualClose":1730,
                    "predictionVersion":2,"predictedTarget":1750,
                    "reason":"突破回踩","invalidationReason":"量能不足"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.text").value("只基于快照生成的复盘说明"));

        org.junit.jupiter.api.Assertions.assertEquals("r1", client.last.reviewId());
        org.junit.jupiter.api.Assertions.assertEquals(1700, client.last.plannedPrice());
        var status = jdbc.sql("select status from ai_call_log").query(String.class).single();
        org.junit.jupiter.api.Assertions.assertEquals("SUCCEEDED", status);
    }

    @TestConfiguration
    static class FakeConfiguration {
        @Bean @Primary
        RecordingReviewExplanationClient recordingReviewExplanationClient() {
            return new RecordingReviewExplanationClient();
        }
    }

    static final class RecordingReviewExplanationClient implements ReviewExplanationClient {
        ReviewSnapshot last;
        public String explain(ReviewSnapshot snapshot) {
            last = snapshot;
            return "只基于快照生成的复盘说明";
        }
    }
}
