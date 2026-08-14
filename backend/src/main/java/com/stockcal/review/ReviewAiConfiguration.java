package com.stockcal.review;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

@Configuration
class ReviewAiConfiguration {
    @Bean
    ReviewExplanationClient reviewExplanationClient(
        @Value("${stockcal.ai.enabled:true}") boolean enabled,
        @Value("${stockcal.ai-api-key:}") String apiKey,
        @Value("${stockcal.ai.model:gpt-4o-mini}") String model
    ) {
        if (!enabled || apiKey.isBlank()) {
            return snapshot -> { throw new ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE, "AI 服务尚未配置"); };
        }
        return new OpenAiReviewExplanationClient(RestClient.builder().build(), apiKey, model);
    }
}
