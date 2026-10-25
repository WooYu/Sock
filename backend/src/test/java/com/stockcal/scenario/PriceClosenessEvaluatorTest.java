package com.stockcal.scenario;

import static org.assertj.core.api.Assertions.*;
import com.stockcal.market.MarketProvider.Candle;
import static com.stockcal.scenario.ScenarioContracts.*;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class PriceClosenessEvaluatorTest {
    private final PriceClosenessEvaluator evaluator = new PriceClosenessEvaluator();
    private ForecastLevel level(long cents) { return new ForecastLevel("p" + cents, cents, List.of("g")); }
    private Candle actual(double value) { return new Candle(LocalDate.of(2026, 10, 15), value, value, value, value, 100); }

    @Test void strictThresholdUsesActualDenominator() {
        assertThat(evaluator.evaluate(List.of(level(10100)), actual(100)).closeLevels()).isZero();
        assertThat(evaluator.evaluate(List.of(level(10099)), actual(100)).closeLevels()).isEqualTo(1);
        var reverse = evaluator.evaluate(List.of(level(10000)), actual(101));
        assertThat(reverse.closeLevels()).isEqualTo(1);
        assertThat(reverse.levels().getFirst().errors().get("open")).isCloseTo(1.0 / 101, within(1e-12));
    }
    @Test void exactAndAllMatchingTargetsAreIndependent() {
        var result = evaluator.evaluate(List.of(level(10000)), actual(100));
        assertThat(result.exactLevels()).isEqualTo(1);
        assertThat(result.coveredTargets()).isEqualTo(4);
        assertThat(result.levels().getFirst().matches()).containsExactly("open", "high", "low", "close");
        assertThat(result.levels().getFirst().nearest()).isEqualTo("open");
    }
    @Test void zhangyueHistoricalReplayRetainsEveryLevel() {
        var actual = new Candle(LocalDate.of(2026, 10, 15),29.51,32.91,28.95,29.01,100);
        var result = evaluator.evaluate(List.of(level(3075),level(2975),level(2904),level(2865),level(2769)),actual);
        assertThat(result.totalLevels()).isEqualTo(5);
        assertThat(result.closeLevels()).isEqualTo(2);
        assertThat(result.levelClosenessRatio()).isEqualTo(0.4);
        assertThat(result.coveredTargets()).isEqualTo(3);
        assertThat(result.exactLevels()).isZero();
        assertThat(result.targets().get("high").covered()).isFalse();
        assertThat(result.targets().get("high").nearestError()).isCloseTo(0.0656335460346399,within(1e-12));
        assertThat(result.levels()).hasSize(5);
    }
    @Test void emptySetHasNoPrecisionAndMissesStayVisible() {
        var empty = evaluator.evaluate(List.of(),actual(100));
        assertThat(empty.levelClosenessRatio()).isNull();
        assertThat(empty.coveredTargets()).isZero();
        assertThat(empty.targets().get("high").nearestError()).isNull();
        var misses = evaluator.evaluate(List.of(level(9000),level(8000)),actual(100));
        assertThat(misses.totalLevels()).isEqualTo(2);
        assertThat(misses.levelClosenessRatio()).isZero();
    }
    @Test void rejectsInvalidOrUnsafePrices() {
        for (long cents : new long[]{0,-1,Long.MAX_VALUE})
            assertThatThrownBy(() -> evaluator.evaluate(List.of(level(cents)),actual(100))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> evaluator.evaluate(List.of(level(100)),actual(Double.NaN))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> evaluator.evaluate(List.of(level(100)),actual(0))).isInstanceOf(IllegalArgumentException.class);
    }
}
