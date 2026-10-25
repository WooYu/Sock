package com.stockcal.scenario;

import com.stockcal.market.MarketProvider;
import java.net.*;
import java.net.http.HttpClient;
import java.time.*;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.web.client.RestClient;

@Configuration
@EnableScheduling
public class ScenarioResearchConfiguration {
    @Bean Clock scenarioClock(){return Clock.systemUTC();}
    @Bean DailyActualSource dailyActualSource(MarketProvider market,Clock clock,@Value("${stockcal.market-api-key:}") String token) {
        if(!token.isBlank())return symbol->{
            var snapshot=market.snapshot(symbol);
            ScenarioRecordValidator.require(snapshot.source().online() && symbol.equals(snapshot.quote().security().code()),"实际行情股票或来源状态错误");
            return new DailyActualSource.DailyActualSeries(symbol,snapshot.source().name(),snapshot.source().fetchedAt(),snapshot.dailyCandles(),
                ResearchJson.hash(ResearchJson.canonical(snapshot)),"canonical_adapter",Map.of());
        };
        var builder=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8));
        String proxy=System.getenv("HTTPS_PROXY");if(proxy==null || proxy.isBlank())proxy=System.getenv("HTTP_PROXY");
        if(proxy!=null && !proxy.isBlank()) {var uri=URI.create(proxy);builder.proxy(ProxySelector.of(new InetSocketAddress(uri.getHost(),uri.getPort()<0?80:uri.getPort())));}
        var factory=new JdkClientHttpRequestFactory(builder.build());factory.setReadTimeout(Duration.ofSeconds(8));
        return new TencentDailyActualSource(RestClient.builder().requestFactory(factory).build(),clock);
    }
}
