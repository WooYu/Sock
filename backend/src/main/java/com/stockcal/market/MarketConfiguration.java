package com.stockcal.market;

import java.time.Instant;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
class MarketConfiguration {
    @Bean
    MarketProvider marketProvider(@Value("${stockcal.market-api-key:}") String token) {
        if (token.isBlank()) return new UnavailableMarketProvider();
        return new TushareMarketProvider(
            new HttpTushareClient(RestClient.builder().build(), token), Instant::now);
    }
}
