package com.stockcal.scenario;
import static org.assertj.core.api.Assertions.*;
import static com.stockcal.scenario.ScenarioContracts.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
class ForwardEligibilityTest {
    private final TargetResolution target=new TargetResolution(1,"verified",LocalDate.parse("2026-10-15"),List.of("contiguous"));
    @Test void auctionCutoffAppliesToEachRevision() {
        var eligibility=new ForwardEligibility();
        assertThat(eligibility.assess(ScenarioTestFixtures.forecast(Instant.parse("2026-10-15T01:14:59.999Z"),"live"),target).forwardEligible()).isTrue();
        for(String time:List.of("2026-10-15T01:15:00Z","2026-10-15T01:25:00Z","2026-10-16T00:00:00Z"))
            assertThat(eligibility.assess(ScenarioTestFixtures.forecast(Instant.parse(time),"live"),target).forwardEligible()).isFalse();
        assertThat(eligibility.assess(ScenarioTestFixtures.forecast(Instant.parse("2026-10-15T00:00:00Z"),"replay"),target).forwardEligible()).isFalse();
        assertThat(eligibility.assess(ScenarioTestFixtures.forecast(Instant.parse("2026-10-15T00:00:00Z"),"live"),new TargetResolution(1,"target_unverified",target.targetDay(),List.of())).forwardEligible()).isFalse();
    }
    @Test void clientDatesMustAlsoPrecedeCutoff() {
        var r=ScenarioTestFixtures.forecast(Instant.parse("2026-10-15T00:00:00Z"),"live");
        var changed=new ForecastRecord(r.id(),r.owner(),r.clientRecordId(),2,r.id(),r.symbol(),r.kind(),r.serverReceivedAt(),Instant.parse("2026-10-15T01:15:00Z"),r.inputAsOf(),r.anchorDay(),r.method(),r.definitionVersion(),r.payloadHash(),r.targetPolicy(),r.snapshot(),r.noteBindings(),r.levels());
        assertThat(new ForwardEligibility().assess(changed,target).forwardEligible()).isFalse();
    }
}
