package com.stockcal.auth;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@Configuration
class SmsConfiguration {
    @Bean
    SmsGateway smsGateway() {
        return (phone, code) -> {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "短信服务尚未配置");
        };
    }
}
