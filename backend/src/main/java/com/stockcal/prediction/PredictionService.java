package com.stockcal.prediction;

import com.stockcal.market.MarketProvider.Candle;
import com.stockcal.prediction.PredictionModels.ChartPeriod;
import com.stockcal.prediction.PredictionModels.PredictionDay;
import com.stockcal.prediction.PredictionModels.PredictionSnapshot;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** Deterministic technical projection, not AI output or calibrated investment confidence. */
@Service
public class PredictionService {
    private static final int WINDOW = 20;
    private static final double MIN_PRICE = 0.01;
    private final Clock clock;
    private final Set<LocalDate> holidays;

    @Autowired
    public PredictionService(@Value("${stockcal.prediction.exchange-holidays:}") String holidayDates) {
        this(Clock.systemUTC(), Arrays.stream(holidayDates.split(","))
            .map(String::trim).filter(value -> !value.isEmpty()).map(LocalDate::parse).collect(Collectors.toSet()));
    }

    PredictionService(Clock clock, Set<LocalDate> holidays) {
        this.clock = clock;
        this.holidays = Set.copyOf(holidays);
    }

    public PredictionSnapshot predict(String symbol, ChartPeriod period, List<Candle> history) {
        var byDay = new TreeMap<LocalDate, Candle>();
        if (history != null) {
            for (var candle : history) {
                if (valid(candle)) byDay.put(candle.day(), candle);
            }
        }
        var candles = new ArrayList<>(byDay.values());
        if (candles.size() < WINDOW) throw new InsufficientDataException();

        var closes = new ArrayList<Double>();
        var trueRanges = new ArrayList<Double>();
        int start = candles.size() - WINDOW;
        for (int i = start; i < candles.size(); i++) {
            var candle = candles.get(i);
            closes.add(candle.close());
            double previous = i > 0 ? candles.get(i - 1).close() : candle.close();
            trueRanges.add(Math.max(candle.high() - candle.low(),
                Math.max(Math.abs(candle.high() - previous), Math.abs(candle.low() - previous))));
        }
        double drift = linearRegressionSlope(closes);
        trueRanges.sort(Double::compareTo);
        double amplitude = (trueRanges.get(9) + trueRanges.get(10)) / 2;
        var days = new ArrayList<PredictionDay>();
        var date = candles.getLast().day();
        double previousClose = closes.getLast();
        for (int dayIndex = 0; dayIndex < 3; dayIndex++) {
            do { date = date.plusDays(1); } while (!isTradingDay(date));
            double open = Math.max(MIN_PRICE, previousClose);
            double close = Math.max(MIN_PRICE, previousClose + drift);
            double high = Math.max(open, close) + amplitude * 0.5;
            double low = Math.max(MIN_PRICE, Math.min(open, close) - amplitude * 0.5);
            // Widen the scenario envelope with the horizon; this is not a statistical probability interval.
            double range = amplitude * Math.sqrt(dayIndex + 1);
            double rangeLow = Math.max(MIN_PRICE, Math.min(low, close - range));
            double rangeHigh = Math.max(high, close + range);
            // Fixed conservative heuristic, deliberately independent of any AI or calibration claim.
            double confidence = Math.max(0.35, 0.7 - 0.05 * dayIndex);
            closes.add(close);
            double ma20 = average(closes, WINDOW);
            double variance = 0;
            for (int i = closes.size() - WINDOW; i < closes.size(); i++) {
                double delta = closes.get(i) - ma20;
                variance += delta * delta / WINDOW;
            }
            double band = 2 * Math.sqrt(variance);
            days.add(new PredictionDay(date, open, high, low, close, rangeLow, rangeHigh, confidence,
                average(closes, 5), average(closes, 10), ma20, ma20 + band, ma20, ma20 - band));
            previousClose = close;
        }
        return new PredictionSnapshot(symbol, period, clock.instant(), "baseline-v1", days);
    }

    private boolean valid(Candle candle) {
        return candle != null && candle.day() != null && isTradingDay(candle.day())
            && positiveFinite(candle.open()) && positiveFinite(candle.high())
            && positiveFinite(candle.low()) && positiveFinite(candle.close())
            && candle.high() >= Math.max(candle.open(), candle.close())
            && candle.low() <= Math.min(candle.open(), candle.close());
    }

    private static boolean positiveFinite(double value) { return Double.isFinite(value) && value > 0; }

    private boolean isTradingDay(LocalDate date) {
        return date.getDayOfWeek() != DayOfWeek.SATURDAY && date.getDayOfWeek() != DayOfWeek.SUNDAY
            && !holidays.contains(date);
    }

    private static double linearRegressionSlope(List<Double> closes) {
        double mean = average(closes, WINDOW);
        double numerator = 0;
        double denominator = 0;
        for (int i = 0; i < WINDOW; i++) {
            double x = i - (WINDOW - 1) / 2.0;
            numerator += x * (closes.get(i) - mean);
            denominator += x * x;
        }
        return numerator / denominator;
    }

    private static double average(List<Double> closes, int count) {
        double sum = 0;
        for (int i = closes.size() - count; i < closes.size(); i++) sum += closes.get(i);
        return sum / count;
    }

    public static final class InsufficientDataException extends RuntimeException {
        InsufficientDataException() { super("至少需要 20 个有效交易日的历史行情"); }
    }
}
