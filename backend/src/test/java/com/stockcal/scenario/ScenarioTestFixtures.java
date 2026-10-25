package com.stockcal.scenario;
import static com.stockcal.scenario.ScenarioContracts.*;
import java.time.*;
import java.util.*;
final class ScenarioTestFixtures {
    static ForecastRecord forecast(Instant receipt,String kind) {
        var snapshot=new ScenarioRecordValidatorTest().fixture();snapshot.put("kind",kind);
        var v=new ScenarioRecordValidator().validate(new SaveForecastRequest(snapshot,List.of()));
        return new ForecastRecord(UUID.randomUUID().toString(),"web:test",v.clientRecordId(),1,null,v.symbol(),kind,receipt,
            Instant.parse("2026-10-14T07:00:00Z"),Instant.parse("2026-10-14T07:00:00Z"),LocalDate.parse("2026-10-14"),v.method(),v.definitionVersion(),v.payloadHash(),TARGET_POLICY,snapshot,List.of(),v.levels());
    }
}
