package com.stockcal.scenario;

import static com.stockcal.scenario.ScenarioContracts.*;
import java.time.ZoneId;
import java.util.*;

public final class ForwardEligibility {
    public Eligibility assess(ForecastRecord record,TargetResolution target) {
        var reasons=new ArrayList<String>();
        if(!"live".equals(record.kind()))reasons.add("historical_replay");
        if(!"verified".equals(target.state()) || target.targetDay()==null)reasons.add("target_not_verified");
        if("daily-close-ladder-v1".equals(record.snapshot().path("dailyPriceLadder").path("definitionVersion").asText()))reasons.add("legacy_level_definition");
        if(target.targetDay()!=null) {
            var cutoff=target.targetDay().atTime(9,15).atZone(ZoneId.of("Asia/Shanghai")).toInstant();
            if(!record.serverReceivedAt().isBefore(cutoff))reasons.add("server_receipt_after_cutoff");
            if(!record.clientCreatedAt().isBefore(cutoff))reasons.add("client_created_after_cutoff");
            if(!record.inputAsOf().isBefore(cutoff))reasons.add("input_after_cutoff");
        }
        return new Eligibility(reasons.isEmpty(),List.copyOf(reasons));
    }
}
