package com.stockcal.scenario;
import static com.stockcal.scenario.ScenarioContracts.*;
import java.time.Clock;
import org.springframework.stereotype.Service;
@Service
public class ScenarioRecordService {
    private final ScenarioRecordRepository store;
    private final Clock clock;
    private final ScenarioRecordValidator validator=new ScenarioRecordValidator();
    public ScenarioRecordService(ScenarioRecordRepository store,Clock clock){this.store=store;this.clock=clock;}
    public ForecastRecord save(String owner,SaveForecastRequest request) {
        var valid=validator.validate(request);var now=clock.instant();
        ScenarioRecordValidator.require(!valid.inputAsOf().isAfter(now) && !valid.clientCreatedAt().isAfter(now.plusSeconds(30)),"分析时点晚于服务器接收时点");
        return store.save(owner,valid,now);
    }
}
