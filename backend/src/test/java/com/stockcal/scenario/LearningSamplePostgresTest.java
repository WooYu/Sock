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
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
@SpringBootTest
@ActiveProfiles("scenario-postgres")
@EnabledIfEnvironmentVariable(named="SCENARIO_TEST_DATABASE_URL",matches="jdbc:postgresql:.*")
class LearningSamplePostgresTest {
    @Autowired ScenarioRecordRepository store;
    @Autowired JdbcClient jdbc;
    @Autowired org.springframework.transaction.PlatformTransactionManager transactions;
    @BeforeEach void clear(){jdbc.sql("delete from scenario_price_evaluation").update();jdbc.sql("delete from scenario_forecast_record").update();jdbc.sql("delete from note_study_revision").update();}
    ForecastRecord save(String id,String candidate,int secondsAgo) {
        var snapshot=new ScenarioRecordValidatorTest().fixture();snapshot.put("id",id);
        ((tools.jackson.databind.node.ObjectNode)snapshot.path("states").path("day")).put("directionCandidate",candidate);
        return store.save("web:test",new ScenarioRecordValidator().validate(new SaveForecastRequest(snapshot,List.of())),Instant.now().minusSeconds(secondsAgo));
    }
    LearningFilters filters(String candidate) {return new LearningFilters("603533",null,null,null,null,null,candidate,null,null,null,null);}
    DailyActualSource.DailyActualSeries series(String day,double close,Instant fetched,Map<String,String> absent) {
        return new DailyActualSource.DailyActualSeries("603533","fixture",fetched,List.of(new Candle(LocalDate.parse(day),11,12,10,close,100)),"response","canonical_adapter",absent);
    }
    @Test void filterBeforePaginationAndStableCursor() {
        save("wanted-first","rising",30);save("wanted-second","rising",20);save("unwanted-newest","falling",10);
        var first=store.listSamples("web:test",filters("rising"),null,1);assertThat(first.items()).hasSize(1);
        assertThat(first.items().getFirst().forecast().clientRecordId()).isEqualTo("wanted-second");assertThat(first.nextCursor()).isNotBlank();
        var second=store.listSamples("web:test",filters("rising"),first.nextCursor(),1);
        assertThat(second.items()).hasSize(1);assertThat(second.items().getFirst().forecast().clientRecordId()).isEqualTo("wanted-first");assertThat(second.nextCursor()).isNull();
        assertThatThrownBy(()->store.listSamples("web:test",filters("falling"),first.nextCursor(),1)).isInstanceOf(IllegalArgumentException.class);
        assertThat(store.listSamples("web:other",filters("rising"),null,25).items()).hasSize(2);
    }
    @Test void latestSuccessfulActiveTargetOnlyAndFailedRecheckRetainsSuccess() {
        var r=save("target","rising",20);var now=Instant.parse("2026-10-12T08:00:00Z");
        var response=new AtomicReference<>(series("2026-10-11",11,now,Map.of("2026-10-10","verified fixture closure")));
        var service=new ScenarioEvaluationService(store,s->response.get(),Clock.fixed(now,ZoneOffset.UTC));var old=service.evaluate("web:test",r.id()).latestSuccessful();
        response.set(series("2026-10-10",11.1,now,Map.of()));var fresh=service.evaluate("web:test",r.id()).latestSuccessful();
        assertThat(fresh.targetResolution().targetDay()).isBefore(old.targetResolution().targetDay());
        new ScenarioEvaluationService(store,s->{throw new IllegalStateException("down");},Clock.fixed(now.plusSeconds(1),ZoneOffset.UTC)).evaluate("web:test",r.id());
        var samples=store.listSamples("web:test",filters("rising"),null,25);
        assertThat(samples.items()).hasSize(1);var view=samples.items().getFirst().evaluation();
        assertThat(view.latestSuccessful().id()).isEqualTo(fresh.id());assertThat(view.latestStatus().status()).isEqualTo("source_error");
    }
    @Test void cursorFreezesCohortAsOfIncludingEvaluationVersion() {
        var older=save("older","rising",30);save("newer","rising",20);
        var now=Instant.parse("2026-10-12T08:00:00Z");
        var original=new ScenarioEvaluationService(store,s->series("2026-10-10",11,now,Map.of()),Clock.fixed(now,ZoneOffset.UTC)).evaluate("web:test",older.id()).latestSuccessful();
        var first=store.listSamples("web:test",filters("rising"),null,1);
        var later=first.asOf().plusSeconds(1);
        new ScenarioEvaluationService(store,s->series("2026-10-10",11.2,later,Map.of()),Clock.fixed(later,ZoneOffset.UTC)).evaluate("web:test",older.id());
        var second=store.listSamples("web:test",filters("rising"),first.nextCursor(),1);
        assertThat(second.asOf()).isEqualTo(first.asOf());assertThat(second.items().getFirst().evaluation().latestSuccessful().id()).isEqualTo(original.id());
    }
    @Test void cursorExcludesEvaluationWhoseCollectionFinishesAfterFirstPage() {
        var older=save("collecting-older","rising",30);save("collecting-newer","rising",20);
        var started=Instant.now().minusSeconds(2);
        var original=new ScenarioEvaluationService(store,s->series("2026-10-10",11,started,Map.of()),Clock.fixed(started,ZoneOffset.UTC)).evaluate("web:test",older.id()).latestSuccessful();
        var time=new AtomicReference<>(started);var first=new AtomicReference<Page<LearningSample>>();
        Clock clock=new Clock(){public ZoneId getZone(){return ZoneOffset.UTC;} public Clock withZone(ZoneId zone){return this;} public Instant instant(){return time.get();}};
        var changed=new ScenarioEvaluationService(store,s->{
            first.set(store.listSamples("web:test",filters("rising"),null,1));
            time.set(Instant.now().plusMillis(1));
            return series("2026-10-10",11.2,time.get(),Map.of());
        },clock).evaluate("web:test",older.id()).latestSuccessful();
        assertThat(changed.evaluatedAt()).isEqualTo(time.get()).isAfter(first.get().asOf());
        var second=store.listSamples("web:test",filters("rising"),first.get().nextCursor(),1);
        assertThat(second.items().getFirst().evaluation().latestSuccessful().id()).isEqualTo(original.id());
    }
    @Test void cursorExcludesUncommittedEvaluationEvenWhenItsTimestampIsEarlier() throws Exception {
        var older=save("committing-older","rising",30);save("committing-newer","rising",20);
        var now=Instant.parse("2026-10-12T08:00:00Z");
        var original=new ScenarioEvaluationService(store,s->series("2026-10-10",11,now,Map.of()),Clock.fixed(now,ZoneOffset.UTC)).evaluate("web:test",older.id()).latestSuccessful();
        var appended=new java.util.concurrent.CountDownLatch(1);var commit=new java.util.concurrent.CountDownLatch(1);
        var worker=java.util.concurrent.CompletableFuture.runAsync(()->new org.springframework.transaction.support.TransactionTemplate(transactions).executeWithoutResult(tx->{
            new ScenarioEvaluationService(store,s->series("2026-10-10",11.2,now,Map.of()),Clock.fixed(now,ZoneOffset.UTC)).evaluate("web:test",older.id());
            appended.countDown();try {if(!commit.await(10,java.util.concurrent.TimeUnit.SECONDS))throw new IllegalStateException("commit gate timed out");}
            catch(InterruptedException interrupted){Thread.currentThread().interrupt();throw new IllegalStateException(interrupted);}
        }));
        Page<LearningSample> first;
        try {assertThat(appended.await(10,java.util.concurrent.TimeUnit.SECONDS)).isTrue();first=store.listSamples("web:test",filters("rising"),null,1);}
        finally {commit.countDown();}
        worker.get(10,java.util.concurrent.TimeUnit.SECONDS);
        var second=store.listSamples("web:test",filters("rising"),first.nextCursor(),1);
        assertThat(second.items().getFirst().evaluation().latestSuccessful().id()).isEqualTo(original.id());
        assertThat(store.listSamples("web:test",filters("rising"),null,25).items().stream().filter(s->s.forecast().id().equals(older.id())).findFirst().orElseThrow()
            .evaluation().latestSuccessful().actual().close()).isEqualTo(11.2);
    }
}
