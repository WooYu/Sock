package com.stockcal.market;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

final class TushareMarketProvider implements MarketProvider {
    private static final DateTimeFormatter DATE = DateTimeFormatter.BASIC_ISO_DATE;
    private final TushareClient client;
    private final Supplier<Instant> clock;
    private volatile List<Security> securities;

    TushareMarketProvider(TushareClient client, Supplier<Instant> clock) {
        this.client = client;
        this.clock = clock;
    }

    public List<Security> search(String query) {
        var normalized = query == null ? "" : query.trim().toLowerCase().replace(" ", "");
        return securities().stream().filter(item -> normalized.isEmpty()
            || item.code().contains(normalized) || item.name().contains(normalized)
            || item.pinyin().contains(normalized) || item.initials().contains(normalized))
            .limit(20).toList();
    }

    public MarketSnapshot snapshot(String code) {
        var security = securities().stream().filter(item -> item.code().equals(code)).findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "股票不存在"));
        var end = LocalDate.ofInstant(clock.get(), ZoneOffset.UTC);
        var rows = client.query("daily", Map.of(
            "ts_code", code + "." + security.exchange(),
            "start_date", end.minusDays(120).format(DATE),
            "end_date", end.format(DATE)
        ), List.of("trade_date", "open", "high", "low", "close", "pre_close", "vol", "amount"));
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "行情源暂无数据");
        var ordered = rows.stream().sorted(Comparator.comparing(row -> row.get("trade_date").toString())).toList();
        var candles = ordered.stream().map(row -> new Candle(
            LocalDate.parse(row.get("trade_date").toString(), DATE), number(row, "open"),
            number(row, "high"), number(row, "low"), number(row, "close"),
            Math.round(number(row, "vol") * 100)
        )).toList();
        var last = ordered.getLast();
        var candle = candles.getLast();
        var price = number(last, "close");
        var limit = code.startsWith("300") || code.startsWith("688") ? 0.20 : 0.10;
        return new MarketSnapshot(new Quote(
            security, price, number(last, "pre_close"), candle.open(), candle.high(), candle.low(),
            candle.volume(), number(last, "amount") * 1000, limit
        ), candles, new Source("Tushare Pro 日线", clock.get(), "DELAYED", true));
    }

    private List<Security> securities() {
        var loaded = securities;
        if (loaded != null) return loaded;
        synchronized (this) {
            if (securities == null) {
                securities = client.query("stock_basic", Map.of("list_status", "L"),
                    List.of("ts_code", "symbol", "name", "industry", "exchange", "cnspell"))
                    .stream().map(row -> {
                        var spell = text(row, "cnspell").toLowerCase();
                        return new Security(text(row, "symbol"), text(row, "name"), spell, spell,
                            exchange(text(row, "exchange")), text(row, "industry"));
                    }).toList();
            }
            return securities;
        }
    }

    private String exchange(String source) {
        return switch (source) { case "SSE" -> "SH"; case "SZSE" -> "SZ"; case "BSE" -> "BJ"; default -> source; };
    }
    private String text(Map<String, Object> row, String key) {
        var value = row.get(key);
        return value == null ? "" : value.toString();
    }
    private double number(Map<String, Object> row, String key) {
        return ((Number) row.get(key)).doubleValue();
    }
}
