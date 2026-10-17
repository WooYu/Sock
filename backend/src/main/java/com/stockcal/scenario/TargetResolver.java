package com.stockcal.scenario;

import static com.stockcal.scenario.ScenarioContracts.*;
import java.time.*;
import java.util.*;

public final class TargetResolver {
    public TargetResolution resolve(ForecastRecord record,List<PriceEvaluation> history,DailyActualSource.DailyActualSeries actual,Instant now) {
        ScenarioRecordValidator.require(record.symbol().equals(actual.symbol()),"实际行情股票不一致");
        var prior=history.isEmpty()?null:history.getLast().targetResolution();
        Instant cutoff=actual.fetchedAt().isBefore(now)?actual.fetchedAt():now;
        var candidate=actual.candles().stream().filter(c->c.day().isAfter(record.anchorDay())
            && !ScenarioRecordValidator.endAt("day",c.day().toString()).isAfter(cutoff)).min(Comparator.comparing(c->c.day())).orElse(null);
        if(candidate==null)return prior!=null?prior:new TargetResolution(1,"pending",null,List.of("尚无后续完整日K"));
        if(prior!=null && prior.targetDay()!=null && candidate.day().isAfter(prior.targetDay()))return prior;
        boolean verified=true;var evidence=new ArrayList<String>();
        evidence.add("来源后续首根完整日K："+candidate.day()+"；"+actual.provider());
        for(var day=record.anchorDay().plusDays(1);day.isBefore(candidate.day());day=day.plusDays(1)) {
            String proof=actual.verifiedAbsentDays().get(day.toString());
            if(proof==null || proof.isBlank()){verified=false;evidence.add(day+"缺日原因未核实");}
            else evidence.add(day+"："+proof);
        }
        String state=verified?"verified":"target_unverified";
        if(prior!=null && candidate.day().equals(prior.targetDay()) && state.equals(prior.state()))return prior;
        return new TargetResolution(prior==null?1:prior.version()+1,state,candidate.day(),List.copyOf(evidence));
    }
}
