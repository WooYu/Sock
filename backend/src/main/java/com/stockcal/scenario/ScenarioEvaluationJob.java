package com.stockcal.scenario;

import java.time.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name="stockcal.scenario.jobs-enabled",havingValue="true",matchIfMissing=true)
public class ScenarioEvaluationJob {
    private final ScenarioRecordRepository store;private final ScenarioEvaluationService service;private final Clock clock;
    @Value("${stockcal.scenario.batch-size:100}") private int batchSize=100;
    public ScenarioEvaluationJob(ScenarioRecordRepository store,ScenarioEvaluationService service,Clock clock){this.store=store;this.service=service;this.clock=clock;}
    @Scheduled(fixedDelayString="${stockcal.scenario.scan-ms:900000}",initialDelayString="${stockcal.scenario.initial-delay-ms:15000}")
    public void tick(){runDue(clock.instant());}
    public int runDue(Instant now) {
        int count=0;
        for(String id:store.findDue(now,Math.max(1,Math.min(1000,batchSize)))) {
            var record=store.findInternal(id);
            if(record.isPresent())try {service.evaluate(record.get().owner(),id);count++;}
            catch(RuntimeException error){System.getLogger(getClass().getName()).log(System.Logger.Level.WARNING,"研究记录核对暂时失败，等待重试："+id);}
        }
        return count;
    }
}
