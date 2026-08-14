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
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;

@SpringBootTest
@AutoConfigureMockMvc
class AuthApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcClient jdbc;

    @org.junit.jupiter.api.BeforeEach
    void reset() {
        jdbc.sql("delete from device_session").update();
        jdbc.sql("delete from app_user").update();
    }

    @Test
    void verificationIssuesAccessAndRefreshTokens() throws Exception {
        mvc.perform(post("/api/v1/auth/verify")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"phone\":\"13800138000\",\"code\":\"123456\",\"deviceName\":\"Pixel\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.accessToken").isNotEmpty())
            .andExpect(jsonPath("$.refreshToken").isNotEmpty())
            .andExpect(jsonPath("$.profile.phone").value("13800138000"))
            .andExpect(jsonPath("$.device.name").value("Pixel"));
    }

    @Test
    void refreshRotatesAccessToken() throws Exception {
        var response = mvc.perform(post("/api/v1/auth/verify")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"phone\":\"13800138000\",\"code\":\"123456\",\"deviceName\":\"Web\"}"))
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
        mvc.perform(post("/api/v1/auth/verify")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"phone\":\"13800138000\",\"code\":\"000000\",\"deviceName\":\"Web\"}"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void listsAndRevokesOtherDevices() throws Exception {
        var response = mvc.perform(post("/api/v1/auth/verify")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"phone\":\"13800138000\",\"code\":\"123456\",\"deviceName\":\"Web\"}"))
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
}
