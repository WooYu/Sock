package com.stockcal.knowledge;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import tools.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class KnowledgeApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcClient jdbc;

    @BeforeEach
    void reset() {
        jdbc.sql("delete from published_rule_source").update();
        jdbc.sql("delete from knowledge_draft").update();
        jdbc.sql("delete from knowledge_source").update();
    }

    @Test
    void importsExtractsApprovesAndPublishesTraceableRule() throws Exception {
        var body = json.writeValueAsString(Map.of("path", "股票/关键点.md", "content",
            "关键点规则：股价触达目标位时减仓。经验：不要因为涨停改变纪律。"));
        var sourceJson = mvc.perform(post("/api/v1/knowledge/sources").with(user("user-1"))
                .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.contentHash").isNotEmpty())
            .andExpect(jsonPath("$.originalContent").value("关键点规则：股价触达目标位时减仓。经验：不要因为涨停改变纪律。"))
            .andReturn().getResponse().getContentAsString();
        var sourceId = json.readTree(sourceJson).get("id").asText();

        var draftsJson = mvc.perform(post("/api/v1/knowledge/sources/{id}/extract", sourceId).with(user("user-1")))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].status").value("PENDING"))
            .andReturn().getResponse().getContentAsString();
        var ruleId = json.readTree(draftsJson).get(0).get("id").asText();

        mvc.perform(post("/api/v1/knowledge/drafts/{id}/publish", ruleId).with(user("user-1")))
            .andExpect(status().isConflict());
        mvc.perform(post("/api/v1/knowledge/drafts/{id}/approve", ruleId).with(user("user-1")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.approvedBy").value("user-1"));
        mvc.perform(post("/api/v1/knowledge/drafts/{id}/publish", ruleId).with(user("user-1")))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.sourceDocumentId").value(sourceId))
            .andExpect(jsonPath("$.sourceExcerpt").value("关键点规则：股价触达目标位时减仓。"));

        mvc.perform(get("/api/v1/knowledge/drafts?status=APPROVED").with(user("user-1")))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].sourceLineStart").value(1));
    }

    @Test
    void knowledgeEndpointsRequireAuthentication() throws Exception {
        mvc.perform(get("/api/v1/knowledge/sources")).andExpect(status().isUnauthorized());
    }

    @Test
    void managesSourcesDraftsAndRules() throws Exception {
        var body = json.writeValueAsString(Map.of("path", "股票/均线.md", "content",
            "均线金叉规则：5日线上穿20日线时买入。"));
        var sourceJson = mvc.perform(post("/api/v1/knowledge/sources").with(user("user-1"))
                .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        var sourceId = json.readTree(sourceJson).get("id").asText();

        var draftsJson = mvc.perform(post("/api/v1/knowledge/sources/{id}/extract", sourceId).with(user("user-1")))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        var draftId = json.readTree(draftsJson).get(0).get("id").asText();

        mvc.perform(post("/api/v1/knowledge/drafts/{id}/approve", draftId).with(user("user-1")))
            .andExpect(status().isOk());
        var ruleJson = mvc.perform(post("/api/v1/knowledge/drafts/{id}/publish", draftId).with(user("user-1")))
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        var ruleId = json.readTree(ruleJson).get("id").asText();

        mvc.perform(get("/api/v1/knowledge/rules").with(user("user-1")))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].enabled").value(true));

        var toggleBody = json.writeValueAsString(Map.of("enabled", false));
        mvc.perform(patch("/api/v1/knowledge/rules/{id}/enabled", ruleId).with(user("user-1"))
                .contentType(MediaType.APPLICATION_JSON).content(toggleBody))
            .andExpect(status().isOk()).andExpect(jsonPath("$.enabled").value(false));

        var srcBody = json.writeValueAsString(Map.of("content", "均线金叉买入，放量确认。"));
        mvc.perform(patch("/api/v1/knowledge/sources/{id}", sourceId).with(user("user-1"))
                .contentType(MediaType.APPLICATION_JSON).content(srcBody))
            .andExpect(status().isOk()).andExpect(jsonPath("$.originalContent").value("均线金叉买入，放量确认。"));

        var draftBody = json.writeValueAsString(Map.of("title", "新标题", "summary", "新摘要"));
        mvc.perform(patch("/api/v1/knowledge/drafts/{id}", draftId).with(user("user-1"))
                .contentType(MediaType.APPLICATION_JSON).content(draftBody))
            .andExpect(status().isNotFound());

        mvc.perform(delete("/api/v1/knowledge/sources/{id}", sourceId).with(user("user-1")))
            .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/knowledge/sources").with(user("user-1")))
            .andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
        mvc.perform(get("/api/v1/knowledge/rules").with(user("user-1")))
            .andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
    }
}
