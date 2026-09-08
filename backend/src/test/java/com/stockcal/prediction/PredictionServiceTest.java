package com.stockcal.prediction;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

import com.stockcal.market.MarketProvider.Candle;
import com.stockcal.prediction.PredictionModels.ChartPeriod;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class PredictionServiceTest {
    private final Clock clock = Clock.fixed(Instant.parse("2026-09-04T09:00:00Z"), ZoneOffset.UTC);
    private final PredictionService service = new PredictionService(clock, Set.of(LocalDate.parse("2026-09-07")));

    @Test
    void predictsExactlyThreeTradingDaysAndPreservesOhlcInvariants() {
        var result = service.predict("600519", ChartPeriod.DAY, history(20));

        assertThat(result.symbol()).isEqualTo("600519");
        assertThat(result.period()).isEqualTo(ChartPeriod.DAY);
        assertThat(result.modelVersion()).isEqualTo("baseline-v1");
        assertThat(result.generatedAt()).isEqualTo(clock.instant());
        assertThat(result.days()).extracting(PredictionModels.PredictionDay::day)
            .containsExactly(LocalDate.parse("2026-09-08"), LocalDate.parse("2026-09-09"), LocalDate.parse("2026-09-10"));
        assertThat(result.days()).allSatisfy(day -> {
            assertThat(day.high()).isGreaterThanOrEqualTo(Math.max(day.open(), day.close()));
            assertThat(day.low()).isLessThanOrEqualTo(Math.min(day.open(), day.close())).isPositive();
            assertThat(day.rangeLow()).isLessThanOrEqualTo(day.low()).isPositive();
            assertThat(day.rangeHigh()).isGreaterThanOrEqualTo(day.high());
            assertThat(day.confidence()).isBetween(0.0, 1.0);
        });
        assertThat(result.days().get(1).open()).isEqualTo(result.days().get(0).close());
        assertThat(result.days().get(2).confidence()).isLessThan(result.days().get(1).confidence());
    }

    @Test
    void derivesDriftTrueRangeAndIndicatorsFromAppendedCloses() {
        // Closes 10..29 have slope 1; true ranges are 2. First projection is 30.
        var days = service.predict("600519", ChartPeriod.DAY, history(20)).days();
        var first = days.getFirst();
        assertThat(first.open()).isEqualTo(29);
        assertThat(first.close()).isEqualTo(30);
        assertThat(first.high()).isEqualTo(31);
        assertThat(first.low()).isEqualTo(28);
        assertThat(first.ma5()).isEqualTo(28);
        assertThat(first.ma10()).isEqualTo(25.5);
        assertThat(first.ma20()).isEqualTo(20.5);
        assertThat(first.bollMiddle()).isEqualTo(20.5);
        assertThat(first.bollUpper()).isCloseTo(32.03256259467079, within(1e-10));
        assertThat(first.bollLower()).isCloseTo(8.967437405329203, within(1e-10));
        assertThat(days.get(2).ma20()).isEqualTo(22.5);
        assertThat(days.get(2).ma5()).isEqualTo(30);
    }

    @Test
    void usesTrueRangesIncludingGapsInsteadOfOnlyHighLowSpreads() {
        var candles = history(20).stream().map(candle -> new Candle(candle.day(), candle.close() * 10,
            candle.close() * 10 + 1, candle.close() * 10 - 1, candle.close() * 10, 100)).toList();
        var first = service.predict("600519", ChartPeriod.DAY, candles).days().getFirst();
        assertThat(first.close()).isEqualTo(300);
        assertThat(first.high()).isEqualTo(305.5);
        assertThat(first.low()).isEqualTo(284.5);
    }

    @Test
    void isDeterministicAndUsesOnlyTheLastTwentyClosesWithoutMutatingHistory() {
        var candles = new ArrayList<>(history(20));
        candles.addFirst(new Candle(candles.getFirst().day().minusDays(3), 999, 1000, 998, 999, 1));
        Collections.reverse(candles);
        var original = List.copyOf(candles);
        var first = service.predict("600519", ChartPeriod.DAY, candles);
        assertThat(service.predict("600519", ChartPeriod.DAY, candles)).isEqualTo(first);
        assertThat(first.days().getFirst().close()).isEqualTo(30);
        assertThat(candles).isEqualTo(original);
    }

    @Test
    void clampsFallingPricesAboveZero() {
        var candles = history(20);
        var declining = new ArrayList<Candle>();
        for (int i = 0; i < candles.size(); i++) {
            double close = 20 - i;
            declining.add(new Candle(candles.get(i).day(), close, close + 0.5, close - 0.5, close, 100));
        }
        assertThat(service.predict("600519", ChartPeriod.DAY, declining).days()).allSatisfy(day -> {
            assertThat(day.open()).isPositive();
            assertThat(day.close()).isPositive();
            assertThat(day.low()).isPositive().isLessThanOrEqualTo(day.close());
        });
    }

    @Test
    void preservesOhlcOrderingWhenHistoryIsBelowThePriceFloor() {
        var tiny = history(20).stream().map(candle -> new Candle(candle.day(), 0.001, 0.001, 0.001, 0.001, 1)).toList();
        var day = service.predict("600519", ChartPeriod.DAY, tiny).days().getFirst();
        assertThat(day.low()).isPositive().isLessThanOrEqualTo(day.open());
        assertThat(day.high()).isGreaterThanOrEqualTo(day.close());
    }

    @Test
    void rejectsFewerThanTwentyValidDistinctTradingCandles() {
        var candles = new ArrayList<>(history(19));
        var day = LocalDate.parse("2026-08-03");
        candles.add(new Candle(day, Double.NaN, 12, 9, 11, 1));
        candles.add(new Candle(day.plusDays(1), 10, 9, 8, 11, 1));
        candles.add(new Candle(day.plusDays(2), 0, 12, 0, 11, 1));
        candles.add(candles.getFirst());
        candles.add(new Candle(LocalDate.parse("2026-09-05"), 10, 12, 9, 11, 1));
        candles.add(new Candle(LocalDate.parse("2026-09-07"), 10, 12, 9, 11, 1));
        candles.add(null);

        assertThatThrownBy(() -> service.predict("600519", ChartPeriod.DAY, candles))
            .isInstanceOf(PredictionService.InsufficientDataException.class)
            .hasMessageContaining("20");
        assertThatThrownBy(() -> service.predict("600519", ChartPeriod.DAY, List.of()))
            .isInstanceOf(PredictionService.InsufficientDataException.class);
    }

    static List<Candle> history(int count) {
        var dates = new ArrayList<LocalDate>();
        var date = LocalDate.parse("2026-09-04");
        while (dates.size() < count) {
            if (date.getDayOfWeek() != DayOfWeek.SATURDAY && date.getDayOfWeek() != DayOfWeek.SUNDAY) dates.addFirst(date);
            date = date.minusDays(1);
        }
        var candles = new ArrayList<Candle>();
        for (int i = 0; i < count; i++) candles.add(new Candle(dates.get(i), 10 + i, 11 + i, 9 + i, 10 + i, 100));
        return candles;
    }
}
