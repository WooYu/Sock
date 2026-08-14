package com.stockcal.market;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class TushareMarketProviderTest {
    @Test
    void searchesStockBasicsAndBuildsChronologicalDailySnapshot() {
        var client = new FakeTushareClient();
        var provider = new TushareMarketProvider(client, () -> Instant.parse("2026-08-14T07:00:00Z"));

        var search = provider.search("gzmt");
        var snapshot = provider.snapshot("600519");

        assertThat(search).extracting(MarketProvider.Security::name).containsExactly("贵州茅台");
        assertThat(snapshot.quote().price()).isEqualTo(1742.0);
        assertThat(snapshot.quote().previousClose()).isEqualTo(1729.0);
        assertThat(snapshot.quote().volume()).isEqualTo(3_200_000L);
        assertThat(snapshot.dailyCandles()).extracting(MarketProvider.Candle::day)
            .isSorted().hasSize(2);
        assertThat(snapshot.source().name()).isEqualTo("Tushare Pro 日线");
        assertThat(snapshot.source().state()).isEqualTo("DELAYED");
    }

    private static final class FakeTushareClient implements TushareClient {
        public List<Map<String, Object>> query(String api, Map<String, String> params, List<String> fields) {
            if (api.equals("stock_basic")) {
                return List.of(Map.of(
                    "ts_code", "600519.SH", "symbol", "600519", "name", "贵州茅台",
                    "industry", "白酒", "exchange", "SSE", "cnspell", "gzmt"));
            }
            return List.of(
                Map.of("trade_date", "20260814", "open", 1730.0, "high", 1750.0, "low", 1720.0,
                    "close", 1742.0, "pre_close", 1729.0, "vol", 32000.0, "amount", 55744.0),
                Map.of("trade_date", "20260813", "open", 1718.0, "high", 1735.0, "low", 1710.0,
                    "close", 1729.0, "pre_close", 1720.0, "vol", 30000.0, "amount", 51870.0)
            );
        }
    }
}
