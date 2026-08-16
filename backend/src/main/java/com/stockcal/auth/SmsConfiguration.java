package com.stockcal.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
class SmsConfiguration {
    private static final Logger log = LoggerFactory.getLogger(SmsConfiguration.class);

    @Bean
    SmsGateway smsGateway() {
        return (phone, code) ->
            log.info("开发模式短信验证码 phone={} code={}", phone, code);
    }
}
