package com.stockcal.scenario;

import static org.assertj.core.api.Assertions.*;
import static com.stockcal.scenario.ScenarioContracts.*;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;

@SpringBootTest
@ActiveProfiles("scenario-postgres")
@EnabledIfEnvironmentVariable(named="SCENARIO_TEST_DATABASE_URL",matches="jdbc:postgresql:.*")
class ScenarioRecordPostgresTest {
    @Autowired ScenarioRecordRepository store;
    @Autowired NoteStudyService notes;
    @Autowired JdbcClient jdbc;
    @BeforeEach void clear() {jdbc.sql("delete from scenario_price_evaluation").update();jdbc.sql("delete from scenario_forecast_record").update();jdbc.sql("delete from note_study_revision").update();}
    ScenarioRecordValidator.ValidatedForecast valid() {return new ScenarioRecordValidator().validate(new SaveForecastRequest(new ScenarioRecordValidatorTest().fixture(),List.of()));}
    @Test void concurrentSameRequestReturnsOriginalReceipt() throws Exception {
        assertThat(jdbc.sql("select version()").query(String.class).single()).startsWith("PostgreSQL");
        var request=valid();
        try(var pool=Executors.newFixedThreadPool(4)) {
            var tasks=new java.util.ArrayList<Callable<ForecastRecord>>();
            for(int i=0;i<8;i++)tasks.add(()->store.save("web:one",request,Instant.now()));
            var results=pool.invokeAll(tasks).stream().map(f->{try{return f.get();}catch(Exception e){throw new RuntimeException(e);}}).toList();
            assertThat(results).extracting(ForecastRecord::id).containsOnly(results.getFirst().id());
            assertThat(results).extracting(ForecastRecord::serverReceivedAt).containsOnly(results.getFirst().serverReceivedAt());
            assertThat(jdbc.sql("select count(*) from scenario_forecast_record").query(Integer.class).single()).isEqualTo(1);
        }
    }
    @Test void sameKeyDifferentPayloadConflictsAndOwnerCannotReadAnotherOwner() {
        var record=store.save("web:one",valid(),Instant.now());
        assertThat(store.findOwned("web:two",record.id())).isEmpty();
        var changed=new ScenarioRecordValidatorTest().fixture();changed.put("kind","replay");
        assertThatThrownBy(()->store.save("web:one",new ScenarioRecordValidator().validate(new SaveForecastRequest(changed,List.of())),Instant.now()))
            .isInstanceOf(ResponseStatusException.class).hasMessageContaining("409");
    }
    @Test void legacyBindingIncludesLevelAndVersionAndMissingHistoryRemainsUnresolved() {
        var base=NoteStudyValidatorTest.valid();
        var key=new LegacyNoteKey("old-id","document",base.sourceHash(),1,"legacy");
        var one=notes.importRevision("web:one",new StudyImport(base.sourceFile(),base.sourceHash(),base.sourceText(),base.sourceUrl(),"legacy",null,key,base.payload()));
        var again=notes.importRevision("web:one",new StudyImport(base.sourceFile(),base.sourceHash(),base.sourceText(),base.sourceUrl(),"legacy",null,key,base.payload()));
        assertThat(one.id()).isEqualTo(again.id());
        var exact=notes.resolveBindings("web:one",List.of(new NoteBindingInput(null,base.sourceHash(),key,base.payload())));
        assertThat(exact.getFirst().revisionId()).isEqualTo(one.id());
        var otherVersion=new LegacyNoteKey("old-id","document",base.sourceHash(),2,"legacy");
        assertThat(notes.resolveBindings("web:one",List.of(new NoteBindingInput(null,base.sourceHash(),otherVersion,base.payload()))).getFirst().status()).isEqualTo("unresolved");
        assertThat(notes.resolveBindings("web:two",List.of(new NoteBindingInput(null,base.sourceHash(),key,base.payload()))).getFirst().status()).isEqualTo("unresolved");
        assertThatThrownBy(()->notes.resolveBindings("web:two",List.of(new NoteBindingInput(one.id(),base.sourceHash(),null,null))))
            .isInstanceOf(ResponseStatusException.class).hasMessageContaining("404");
    }
    @Test void exactLegacyKeyWithDifferentInlineContentConflicts() {
        var base=NoteStudyValidatorTest.valid();var key=new LegacyNoteKey("old-id","document",base.sourceHash(),1,"legacy");
        notes.importRevision("web:one",new StudyImport(base.sourceFile(),base.sourceHash(),base.sourceText(),base.sourceUrl(),"legacy",null,key,base.payload()));
        var altered=base.payload().deepCopy();((tools.jackson.databind.node.ObjectNode)altered).put("summary","different interpretation under the same version");
        assertThatThrownBy(()->notes.resolveBindings("web:one",List.of(new NoteBindingInput(null,base.sourceHash(),key,altered))))
            .isInstanceOf(org.springframework.web.server.ResponseStatusException.class).hasMessageContaining("409");
    }
}
