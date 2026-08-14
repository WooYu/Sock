package com.stockcal.auth;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Import;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;

@SpringBootTest
@AutoConfigureMockMvc
@Import(AuthApiTest.SmsTestConfiguration.class)
class AuthApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcClient jdbc;
    @Autowired RecordingSmsGateway sms;

    @org.junit.jupiter.api.BeforeEach
    void reset() {
        jdbc.sql("delete from sms_challenge").update();
        jdbc.sql("delete from access_token").update();
        jdbc.sql("delete from device_session").update();
        jdbc.sql("delete from app_user").update();
    }

    @Test
    void verificationIssuesAccessAndRefreshTokens() throws Exception {
        var code = requestCode("13800138000");
        mvc.perform(post("/api/v1/auth/verify")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"phone\":\"13800138000\",\"code\":\"" + code + "\",\"deviceName\":\"Pixel\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.accessToken").isNotEmpty())
            .andExpect(jsonPath("$.refreshToken").isNotEmpty())
            .andExpect(jsonPath("$.profile.phone").value("13800138000"))
            .andExpect(jsonPath("$.device.name").value("Pixel"));
    }

    @Test
    void refreshRotatesAccessToken() throws Exception {
        var code = requestCode("13800138000");
        var response = mvc.perform(post("/api/v1/auth/verify")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"phone\":\"13800138000\",\"code\":\"" + code + "\",\"deviceName\":\"Web\"}"))
            .andReturn().getResponse().getContentAsString();
        var refresh = objectMapper.readTree(response).get("refreshToken").asText();

        mvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"" + refresh + "\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.accessToken").isNotEmpty());
    }

    @Test
    void invalidCodeIsRejected() throws Exception {
        requestCode("13800138000");
        mvc.perform(post("/api/v1/auth/verify")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"phone\":\"13800138000\",\"code\":\"000000\",\"deviceName\":\"Web\"}"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void listsAndRevokesOtherDevices() throws Exception {
        var code = requestCode("13800138000");
        var response = mvc.perform(post("/api/v1/auth/verify")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"phone\":\"13800138000\",\"code\":\"" + code + "\",\"deviceName\":\"Web\"}"))
            .andReturn().getResponse().getContentAsString();
        var deviceId = objectMapper.readTree(response).get("device").get("id").asText();

        mvc.perform(get("/api/v1/auth/devices").with(user("13800138000")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].name").value("Web"));

        mvc.perform(delete("/api/v1/auth/devices/{id}", deviceId).with(user("13800138000")))
            .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/auth/devices").with(user("13800138000")))
            .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void issuedBearerTokenAuthenticatesProtectedRequests() throws Exception {
        var code = requestCode("13800138000");
        var response = mvc.perform(post("/api/v1/auth/verify")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"phone\":\"13800138000\",\"code\":\"" + code + "\",\"deviceName\":\"Android\"}"))
            .andReturn().getResponse().getContentAsString();
        var token = objectMapper.readTree(response).get("accessToken").asText();

        mvc.perform(get("/api/v1/auth/devices").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].name").value("Android"));
    }

    @Test
    void verificationCodeCanOnlyBeUsedOnce() throws Exception {
        var code = requestCode("13800138000");
        var body = "{\"phone\":\"13800138000\",\"code\":\"" + code + "\",\"deviceName\":\"Web\"}";
        mvc.perform(post("/api/v1/auth/verify").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isOk());
        mvc.perform(post("/api/v1/auth/verify").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isUnauthorized());
    }

    private String requestCode(String phone) throws Exception {
        mvc.perform(post("/api/v1/auth/request-code")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"phone\":\"" + phone + "\"}"))
            .andExpect(status().isAccepted());
        return sms.lastCode;
    }

    @TestConfiguration
    static class SmsTestConfiguration {
        @Bean @Primary RecordingSmsGateway recordingSmsGateway() { return new RecordingSmsGateway(); }
    }

    static final class RecordingSmsGateway implements SmsGateway {
        String lastCode;
        public void sendCode(String phone, String code) { lastCode = code; }
    }
}
