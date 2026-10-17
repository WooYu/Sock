package com.stockcal.scenario;
import static org.assertj.core.api.Assertions.*;
import static com.stockcal.scenario.ScenarioContracts.*;
import com.stockcal.market.MarketProvider.Candle;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("scenario-postgres")
@EnabledIfEnvironmentVariable(named="SCENARIO_TEST_DATABASE_URL",matches="jdbc:postgresql:.*")
class ScenarioEvaluationJobPostgresTest {
    @Autowired ScenarioRecordRepository store;
    @Autowired JdbcClient jdbc;
    @BeforeEach void clear(){jdbc.sql("delete from scenario_price_evaluation").update();jdbc.sql("delete from scenario_forecast_record").update();jdbc.sql("delete from note_study_revision").update();}
    ForecastRecord save() {return new ScenarioRecordService(store,Clock.fixed(Instant.parse("2026-10-09T08:00:00Z"),ZoneOffset.UTC))
        .save("web:test",new SaveForecastRequest(new ScenarioRecordValidatorTest().fixture(),List.of()));}
    DailyActualSource.DailyActualSeries series(double close,Instant fetched) {return new DailyActualSource.DailyActualSeries("603533","fixture",fetched,
        List.of(new Candle(LocalDate.parse("2026-10-10"),11,12.5,10,close,100)),"response"+close,"canonical_adapter",Map.of());}
    @Test void correctedCandleAppendsOneNewScoreAndReversionUsesExistingScore() {
        var record=save();var now=Instant.parse("2026-10-11T08:00:00Z");var response=new AtomicReference<>(series(11,now));
        var service=new ScenarioEvaluationService(store,s->response.get(),Clock.fixed(now,ZoneOffset.UTC));
        var first=service.evaluate("web:test",record.id()).latestSuccessful();assertThat(first).isNotNull();
        service.evaluate("web:test",record.id());assertThat(store.evaluations(record.id())).hasSize(1);
        response.set(series(11.2,now.plusSeconds(60)));var second=service.evaluate("web:test",record.id()).latestSuccessful();
        assertThat(second.id()).isNotEqualTo(first.id());assertThat(store.evaluations(record.id())).hasSize(2);
        response.set(series(11,now.plusSeconds(120)));var reverted=service.evaluate("web:test",record.id());
        assertThat(reverted.latestSuccessful().id()).isEqualTo(first.id());
        assertThat(store.evaluations(record.id()).stream().filter(e->e.result()!=null)).hasSize(2);
    }
    @Test void failedRecheckRetainsLastSuccessAndResumesAfterFailure() {
        var record=save();var now=Instant.parse("2026-10-11T08:00:00Z");
        var good=new ScenarioEvaluationService(store,s->series(11,now),Clock.fixed(now,ZoneOffset.UTC));var first=good.evaluate("web:test",record.id()).latestSuccessful();
        var bad=new ScenarioEvaluationService(store,s->{throw new IllegalStateException("offline");},Clock.fixed(now.plusSeconds(86400),ZoneOffset.UTC));
        var failed=bad.evaluate("web:test",record.id());assertThat(failed.latestStatus().status()).isEqualTo("source_error");assertThat(failed.latestSuccessful().id()).isEqualTo(first.id());
        var recovered=good.evaluate("web:test",record.id());assertThat(recovered.latestStatus().status()).isEqualTo("scored");assertThat(recovered.latestSuccessful().id()).isEqualTo(first.id());
        assertThat(store.evaluations(record.id()).stream().filter(e->e.result()!=null)).hasSize(1);
    }
    @Test void restartResumesPersistedDueWorkInNewApplicationContext() {
        var record=save();
        try(var restarted=new SpringApplicationBuilder(com.stockcal.StockCalBackendApplication.class).profiles("scenario-postgres")
            .properties("stockcal.scenario.jobs-enabled=false","stockcal.ai.enabled=false","stockcal.knowledge.auto-extract=false").run("--server.port=0")) {
            var reloaded=restarted.getBean(ScenarioRecordRepository.class);
            assertThat(reloaded.findOwned("web:test",record.id()).orElseThrow().serverReceivedAt()).isEqualTo(record.serverReceivedAt());
            var clock=Clock.fixed(Instant.parse("2026-10-11T08:00:00Z"),ZoneOffset.UTC);
            var job=new ScenarioEvaluationJob(reloaded,new ScenarioEvaluationService(reloaded,s->series(11,clock.instant()),clock),clock);
            assertThat(job.runDue(clock.instant())).isEqualTo(1);
            assertThat(ScenarioRecordRepository.view(reloaded.evaluations(record.id())).latestSuccessful()).isNotNull();
        }
    }
    @Test void seventhDayStopsAutomaticRecheckButManualEvaluationRemainsAvailable() {
        var record=save();var first=Instant.parse("2026-10-11T08:00:00Z");
        new ScenarioEvaluationService(store,s->series(11,first),Clock.fixed(first,ZoneOffset.UTC)).evaluate("web:test",record.id());
        var last=first.plusSeconds(7*86400);
        new ScenarioEvaluationService(store,s->series(11.1,last),Clock.fixed(last,ZoneOffset.UTC)).evaluate("web:test",record.id());
        assertThat(store.findDue(last.plusSeconds(86400),100)).isEmpty();
        var manual=new ScenarioEvaluationService(store,s->series(11.2,last.plusSeconds(86400)),Clock.fixed(last.plusSeconds(86400),ZoneOffset.UTC)).evaluate("web:test",record.id());
        assertThat(manual.latestSuccessful().actual().close()).isEqualTo(11.2);
    }
}
