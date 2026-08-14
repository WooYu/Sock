package com.stockcal.market;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Component
public class ConfiguredMarketProvider implements MarketProvider {
    private static final List<Security> SECURITIES = List.of(
        new Security("600519", "贵州茅台", "guizhoumaotai", "gzmt", "SH", "白酒"),
        new Security("000001", "平安银行", "pinganyinhang", "payh", "SZ", "银行"),
        new Security("300750", "宁德时代", "ningdeshidai", "ndsd", "SZ", "电池"),
        new Security("688981", "中芯国际", "zhongxinguoji", "zxgj", "SH", "半导体")
    );

    @Override
    public List<Security> search(String query) {
        var value = query == null ? "" : query.trim().toLowerCase();
        return SECURITIES.stream().filter(item -> value.isEmpty()
            || item.code().contains(value) || item.name().contains(value)
            || item.pinyin().contains(value) || item.initials().contains(value)).limit(20).toList();
    }

    @Override
    public MarketSnapshot snapshot(String code) {
        var security = SECURITIES.stream().filter(item -> item.code().equals(code)).findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "股票不存在"));
        var base = code.equals("600519") ? 1680.0 : code.equals("300750") ? 198.0 : 12.0;
        var scale = code.equals("600519") ? 1.0 : 0.08;
        var candles = java.util.stream.IntStream.range(0, 40).mapToObj(index -> {
            var wave = switch (index % 5) { case 0 -> -4.0; case 1 -> 2.0; case 2 -> 6.0; case 3 -> -1.0; default -> 3.0; };
            var close = base + index * (code.equals("600519") ? 1.55 : 0.08) + wave * scale;
            var open = close - (index % 2 == 0 ? 2.0 : -1.5) * scale;
            return new Candle(LocalDate.of(2026, 6, 22).plusDays(index), open,
                Math.max(open, close) + 8 * scale, Math.min(open, close) - 7 * scale,
                close, 18000L + index * 420L + (index % 4) * 1500L);
        }).toList();
        var last = candles.getLast();
        var previous = candles.get(candles.size() - 2).close();
        var price = code.equals("600519") ? 1742.0 : last.close();
        var limit = code.startsWith("300") || code.startsWith("688") ? 0.20 : 0.10;
        var fetchedAt = Instant.now().minus(15, ChronoUnit.MINUTES);
        return new MarketSnapshot(
            new Quote(security, price, previous, last.open(), last.high(), last.low(),
                last.volume(), price * last.volume(), limit),
            candles, new Source("StockCal A股行情适配器", fetchedAt, "DELAYED", true));
    }
}
