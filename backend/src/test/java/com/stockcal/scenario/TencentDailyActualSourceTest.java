package com.stockcal.scenario;
import static org.assertj.core.api.Assertions.*;
import java.time.*;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;
import org.springframework.test.web.client.MockRestServiceServer;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;
import org.springframework.http.MediaType;
class TencentDailyActualSourceTest {
    @Test void preservesUnadjustedResponseAndCandleHashIgnoresCaptureTime() {
        var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();
        String body="{\"code\":0,\"data\":{\"sh603533\":{\"day\":[[\"2026-10-15\",\"29.51\",\"29.01\",\"32.91\",\"28.95\",\"100\"]]}}}";
        for(int i=0;i<2;i++)server.expect(requestTo("https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh603533,day,,,640,")).andRespond(withSuccess(body,MediaType.APPLICATION_JSON));
        var one=new TencentDailyActualSource(builder.build(),Clock.fixed(Instant.parse("2026-10-16T00:00:00Z"),ZoneOffset.UTC)).fetch("603533");
        var two=new TencentDailyActualSource(builder.build(),Clock.fixed(Instant.parse("2026-10-16T01:00:00Z"),ZoneOffset.UTC)).fetch("603533");
        assertThat(one.candles()).hasSize(1);assertThat(one.candles().getFirst().close()).isEqualTo(29.01);
        assertThat(one.provenance(one.candles().getFirst()).candleHash()).isEqualTo(two.provenance(two.candles().getFirst()).candleHash());
        assertThat(one.fetchedAt()).isNotEqualTo(two.fetchedAt());assertThat(one.responseHash()).isEqualTo(ResearchJson.hash(body));server.verify();
    }
    @Test void preservesForwardAdjustedPricesAndProvenance() {
        var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();
        String body="{\"code\":0,\"data\":{\"sh600519\":{\"qfqday\":[[\"2026-10-16\",\"1311.57\",\"1329\",\"1332\",\"1300\",\"100\"]]}}}";
        server.expect(requestTo("https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh600519,day,,,640,qfq")).andRespond(withSuccess(body,MediaType.APPLICATION_JSON));
        var series=new TencentDailyActualSource(builder.build(),Clock.systemUTC()).fetch("600519","qfq");
        assertThat(series.adjustment()).isEqualTo("qfq");
        assertThat(series.provenance(series.candles().getFirst()).adjustment()).isEqualTo("qfq");
        server.verify();
    }
    @Test void rejectsAdjustedMissingOrMalformedDataAndForeignSymbol() {
        var builder=RestClient.builder();var server=MockRestServiceServer.bindTo(builder).build();
        server.expect(anything()).andRespond(withSuccess("{\"data\":{\"sh603533\":{\"qfqday\":[]}}}",MediaType.APPLICATION_JSON));
        var source=new TencentDailyActualSource(builder.build(),Clock.systemUTC());
        assertThatThrownBy(()->source.fetch("603533")).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(()->source.fetch("../../invalid")).isInstanceOf(IllegalArgumentException.class);
        server.verify();
    }
}
