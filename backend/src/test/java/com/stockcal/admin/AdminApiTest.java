package com.stockcal.admin;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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

@SpringBootTest(properties = {
    "stockcal.sms-api-key=",
    "stockcal.market-api-key=market-token",
    "stockcal.ai-api-key=ai-token"
})
@AutoConfigureMockMvc
class AdminApiTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcClient jdbc;

    @BeforeEach
    void reset() {
        jdbc.sql("delete from audit_event").update();
        jdbc.sql("delete from ai_call_log").update();
        jdbc.sql("delete from admin_job").update();
        jdbc.sql("delete from access_token").update();
        jdbc.sql("delete from device_session").update();
        jdbc.sql("delete from app_user").update();
    }

    @Test
    void administrationRequiresAdminRole() throws Exception {
        mvc.perform(get("/api/v1/admin/overview").with(user("member").roles("USER")))
            .andExpect(status().isForbidden());
    }

    @Test
    void overviewReportsConfigurationWithoutSecretValues() throws Exception {
        mvc.perform(get("/api/v1/admin/overview").with(user("owner").roles("ADMIN")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.secrets[0].name").value("短信服务"))
            .andExpect(jsonPath("$.secrets[0].configured").value(false))
            .andExpect(jsonPath("$.secrets[1].configured").value(true))
            .andExpect(jsonPath("$.secrets[2].configured").value(true))
            .andExpect(jsonPath("$").value(org.hamcrest.Matchers.not(
                org.hamcrest.Matchers.containsString("market-token"))));
    }

    @Test
    void failedJobCanBeRetriedAndIsAudited() throws Exception {
        jdbc.sql("""
                insert into admin_job(id,type,target,status,attempts,error,created_at,updated_at)
                values('job-1','ANNOTATION_SYNC','annotation-1','FAILED',2,'timeout',current_timestamp,current_timestamp)
                """).update();

        mvc.perform(post("/api/v1/admin/jobs/job-1/retry").with(user("owner").roles("ADMIN")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("QUEUED"))
            .andExpect(jsonPath("$.attempts").value(3))
            .andExpect(jsonPath("$.error").doesNotExist());

        var action = jdbc.sql("select action from audit_event").query(String.class).single();
        org.junit.jupiter.api.Assertions.assertEquals("RETRY_ADMIN_JOB", action);
    }

    @Test
    void repairCreatesQueuedJobAndAuditEvidence() throws Exception {
        mvc.perform(post("/api/v1/admin/market-repairs")
                .with(user("owner").roles("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stockCode\":\"600519\"}"))
            .andExpect(status().isAccepted())
            .andExpect(jsonPath("$.type").value("MARKET_REPAIR"))
            .andExpect(jsonPath("$.target").value("600519"))
            .andExpect(jsonPath("$.status").value("QUEUED"));

        var target = jdbc.sql("select target from audit_event").query(String.class).single();
        org.junit.jupiter.api.Assertions.assertEquals("600519", target);
    }

    @Test
    void adminListsUsersAndUpdatesRoleWithAudit() throws Exception {
        jdbc.sql("""
                insert into app_user(id,phone,display_name,role,enabled)
                values('user-1','13800138000','用户一','USER',true)
                """).update();

        mvc.perform(get("/api/v1/admin/users").with(user("owner").roles("ADMIN")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].phoneMasked").value("138****8000"))
            .andExpect(jsonPath("$[0].role").value("USER"));

        mvc.perform(patch("/api/v1/admin/users/user-1/role")
                .with(user("owner").roles("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"role\":\"ANALYST\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.role").value("ANALYST"));

        var role = jdbc.sql("select role from app_user where id='user-1'").query(String.class).single();
        org.junit.jupiter.api.Assertions.assertEquals("ANALYST", role);
    }
}
