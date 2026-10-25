package com.stockcal.scenario;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static com.stockcal.scenario.ScenarioContracts.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
class ScenarioEvaluationServiceTest {
    @Test void pendingAndSourceFailureNeverBecomeMisses() {
        var record=ScenarioTestFixtures.forecast(Instant.parse("2026-10-14T08:00:00Z"),"live");
        var store=mock(ScenarioRecordRepository.class);var history=new ArrayList<PriceEvaluation>();
        when(store.findOwned("web:test",record.id())).thenReturn(Optional.of(record));
        when(store.claim(anyString(),any())).thenReturn(true);
        when(store.evaluations(record.id())).thenAnswer(i->List.copyOf(history));
        when(store.appendEvaluation(anyString(),any())).thenAnswer(i->{PriceEvaluation e=i.getArgument(1);history.add(e);return e;});
        Clock clock=Clock.fixed(Instant.parse("2026-10-15T06:00:00Z"),ZoneOffset.UTC);
        DailyActualSource source=symbol->new DailyActualSource.DailyActualSeries(symbol,"fixture",clock.instant(),List.of(),"hash","canonical_adapter",Map.of());
        var service=new ScenarioEvaluationService(store,source,clock);
        var pending=service.evaluate("web:test",record.id());
        assertThat(pending.latestStatus().status()).isEqualTo("pending");assertThat(pending.latestSuccessful()).isNull();assertThat(pending.latestStatus().result()).isNull();
        var failing=new ScenarioEvaluationService(store,symbol->{throw new IllegalStateException("source down");},clock);
        var failed=failing.evaluate("web:test",record.id());
        assertThat(failed.latestStatus().status()).isEqualTo("source_error");assertThat(failed.latestSuccessful()).isNull();assertThat(failed.latestStatus().result()).isNull();
        assertThat(failed.latestStatus().nextRetryAt()).isEqualTo(clock.instant().plusSeconds(900));
    }
}
