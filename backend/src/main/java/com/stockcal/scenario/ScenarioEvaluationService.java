package com.stockcal.scenario;

import static com.stockcal.scenario.ScenarioContracts.*;
import java.time.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ScenarioEvaluationService {
    private final ScenarioRecordRepository store;
    private final DailyActualSource source;
    private final Clock clock;
    @Value("${stockcal.scenario.retry-base-seconds:900}") private long retryBaseSeconds=900;
    @Value("${stockcal.scenario.retry-max-seconds:21600}") private long retryMaxSeconds=21600;
    public ScenarioEvaluationService(ScenarioRecordRepository store,DailyActualSource source,Clock clock){this.store=store;this.source=source;this.clock=clock;}
    public EvaluationView evaluate(String owner,String id) {
        var record=store.findOwned(owner,id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"计算记录不可读取"));
        var startedAt=clock.instant();
        if(!store.claim(id,startedAt))return ScenarioRecordRepository.view(store.evaluations(id));
        var history=store.evaluations(id);
        var resolution=history.isEmpty()?new TargetResolution(1,"pending",null,List.of("尚无后续完整日K")):history.getLast().targetResolution();
        String status="pending";ActualProvenance provenance=null;com.stockcal.market.MarketProvider.Candle actual=null;PriceClosenessResult result=null;
        try {
            String adjustment=record.snapshot().path("input").path("periods").path("day").path("adjustment").asText("none");
            var series=source.fetch(record.symbol(),adjustment);
            if(!adjustment.equals(series.adjustment()))throw new IllegalStateException("实际行情口径不一致");
            if("qfq".equals(adjustment)) {
                var anchor=series.candles().stream().filter(c -> c.day().equals(record.anchorDay())).findFirst().orElseThrow();
                double frozen=record.snapshot().path("dailyPriceLadder").path("anchor").path("close").asDouble();
                if(Math.abs(anchor.close()-frozen)>0.005)throw new IllegalStateException("复权基准已变化，禁止跨基准评分");
            }
            var observedAt=clock.instant();
            resolution=new TargetResolver().resolve(record,history,series,observedAt);
            var day=resolution.targetDay();
            actual=day==null?null:series.candles().stream().filter(c->c.day().equals(day)
                && !ScenarioRecordValidator.endAt("day",c.day().toString()).isAfter(observedAt)
                && !ScenarioRecordValidator.endAt("day",c.day().toString()).isAfter(series.fetchedAt())).findFirst().orElse(null);
            if(actual!=null)provenance=series.provenance(actual);
            if("target_unverified".equals(resolution.state()))status="target_unverified";
            else if(actual!=null && "verified".equals(resolution.state())) {result=new PriceClosenessEvaluator().evaluate(record.levels(),actual);status="scored";}
            else if(day!=null && !ScenarioRecordValidator.endAt("day",day.toString()).isAfter(observedAt))status="source_error";
        } catch(RuntimeException sourceFailure) {status="source_error";}
        // A completed evaluation must never be dated before the observation it uses.
        var now=clock.instant();
        boolean success="scored".equals(status),failure="source_error".equals(status);
        long delay=failure?Math.min(Math.max(60,retryMaxSeconds),Math.max(60,retryBaseSeconds)*(1L<<Math.min(10,store.retryCount(id)))):success?86400:Math.max(60,retryBaseSeconds);
        Instant next=now.plusSeconds(delay);var until=store.recheckUntil(id);
        if(until.isPresent() && next.isAfter(until.get()))next=null;
        var candidate=new PriceEvaluation(null,id,0,null,resolution,status,new ForwardEligibility().assess(record,resolution),actual,provenance,result,now,next,null);
        try {
            store.appendEvaluation(id,candidate);
            store.schedule(id,next,now,success,failure);
        } catch(RuntimeException persistenceFailure) {
            store.schedule(id,now.plusSeconds(Math.max(60,retryBaseSeconds)),now,false,true);
            throw persistenceFailure;
        }
        return ScenarioRecordRepository.view(store.evaluations(id));
    }
}
