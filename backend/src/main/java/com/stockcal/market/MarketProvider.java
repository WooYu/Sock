package com.stockcal.market;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public interface MarketProvider {
    List<Security> search(String query);
    MarketSnapshot snapshot(String code);

    record Security(String code, String name, String pinyin, String initials,
                    String exchange, String industry) {}
    record Quote(Security security, double price, double previousClose, double open,
                 double high, double low, long volume, double turnover, double limitRatio) {}
    record Candle(LocalDate day, double open, double high, double low, double close, long volume) {}
    record Source(String name, Instant fetchedAt, String state, boolean online) {}
    record MarketSnapshot(Quote quote, List<Candle> dailyCandles, Source source) {}
}
