package com.stockcal.scenario;
import static org.assertj.core.api.Assertions.*;
import static com.stockcal.scenario.ScenarioContracts.*;
import com.stockcal.market.MarketProvider.Candle;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
class TargetResolverTest {
    final Instant now=Instant.parse("2026-10-16T08:00:00Z");
    Candle candle(String day){return new Candle(LocalDate.parse(day),29,30,28,29,100);}
    DailyActualSource.DailyActualSeries series(String...days){return new DailyActualSource.DailyActualSeries("603533","fixture",now,Arrays.stream(days).map(this::candle).toList(),"response","canonical_adapter",Map.of());}
    PriceEvaluation previous(TargetResolution r){return new PriceEvaluation("previous","forecast",1,null,r,"pending",new Eligibility(false,List.of()),null,null,null,now,null,null);}
    @Test void incompleteTodayRemainsPending() {
        var resolver=new TargetResolver();var record=ScenarioTestFixtures.forecast(now.minusSeconds(86400),"live");
        assertThat(resolver.resolve(record,List.of(),series("2026-10-15"),Instant.parse("2026-10-15T06:59:00Z")).state()).isEqualTo("pending");
        assertThat(resolver.resolve(record,List.of(),series("2026-10-15"),Instant.parse("2026-10-15T07:00:00Z")).state()).isEqualTo("verified");
    }
    @Test void earlierBackfillAppendsResolutionRevisionAndLaterMissingBarDoesNotMoveTarget() {
        var resolver=new TargetResolver();var record=ScenarioTestFixtures.forecast(now,"live");
        var gap=resolver.resolve(record,List.of(),series("2026-10-16"),now);
        assertThat(gap.state()).isEqualTo("target_unverified");assertThat(gap.version()).isEqualTo(1);
        var filled=resolver.resolve(record,List.of(previous(gap)),series("2026-10-15","2026-10-16"),now);
        assertThat(filled.targetDay()).isEqualTo(LocalDate.parse("2026-10-15"));assertThat(filled.version()).isEqualTo(2);assertThat(filled.state()).isEqualTo("verified");
        assertThat(resolver.resolve(record,List.of(previous(filled)),series("2026-10-16"),now)).isEqualTo(filled);
    }
    @Test void doesNotGuessWeekendAndAcceptsExplicitCalendarEvidenceOnly() {
        var resolver=new TargetResolver();var record=ScenarioTestFixtures.forecast(now,"live");var s=series("2026-10-16");
        var verified=new DailyActualSource.DailyActualSeries(s.symbol(),s.provider(),s.fetchedAt(),s.candles(),s.responseHash(),s.responseHashKind(),Map.of("2026-10-15","verified suspension evidence"));
        assertThat(resolver.resolve(record,List.of(),verified,now).state()).isEqualTo("verified");
    }
}
