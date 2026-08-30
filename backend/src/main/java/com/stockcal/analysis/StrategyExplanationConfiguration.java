package com.stockcal.analysis;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

@Configuration
class StrategyExplanationConfiguration {
    @Bean
    StrategyExplanationClient strategyExplanationClient(
        @Value("${stockcal.ai.enabled:true}") boolean enabled,
        @Value("${stockcal.ai-api-key:}") String apiKey,
        @Value("${stockcal.ai.base-url:https://api.deepseek.com}") String baseUrl,
        @Value("${stockcal.ai.model:deepseek-chat}") String model
    ) {
        if (!enabled || apiKey.isBlank()) {
            return request -> {
                throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE, "AI 服务尚未配置");
            };
        }
        return new ChatCompletionsStrategyExplanationClient(
            RestClient.builder().build(), baseUrl, apiKey, model);
    }
}
