package com.stockcal.scenario;
import static com.stockcal.scenario.ScenarioContracts.*;
import java.security.Principal;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
@RestController
@RequestMapping("/api/v1/scenario-records")
public class ScenarioRecordController {
    private final ScenarioRecordService records;private final ScenarioRecordRepository store;private final ScenarioEvaluationService evaluations;
    public ScenarioRecordController(ScenarioRecordService records,ScenarioRecordRepository store,ScenarioEvaluationService evaluations){this.records=records;this.store=store;this.evaluations=evaluations;}
    @PostMapping ForecastRecord save(Principal p,@RequestHeader(value="X-Client-Id",required=false) String client,@RequestBody SaveForecastRequest body){return records.save(ResearchIdentity.resolve(p,client),body);}
    @GetMapping Page<ForecastRecord> list(Principal p,@RequestHeader(value="X-Client-Id",required=false) String client,
        @RequestParam(required=false) String symbol,@RequestParam(required=false) String cursor,@RequestParam(defaultValue="25") int limit){
        var page=store.listSamples(ResearchIdentity.resolve(p,client),new LearningFilters(symbol,null,null,null,null,null,null,null,null,null,null),cursor,limit);
        return new Page<>(page.items().stream().map(LearningSample::forecast).toList(),page.nextCursor(),page.asOf());
    }
    @GetMapping("/{id}") ForecastRecord get(Principal p,@RequestHeader(value="X-Client-Id",required=false) String client,@PathVariable String id){return owned(ResearchIdentity.resolve(p,client),id);}
    @PostMapping("/{id}/evaluate") EvaluationView evaluate(Principal p,@RequestHeader(value="X-Client-Id",required=false) String client,@PathVariable String id){return evaluations.evaluate(ResearchIdentity.resolve(p,client),id);}
    @GetMapping("/{id}/evaluations") List<PriceEvaluation> history(Principal p,@RequestHeader(value="X-Client-Id",required=false) String client,@PathVariable String id){owned(ResearchIdentity.resolve(p,client),id);return store.evaluations(id);}
    private ForecastRecord owned(String owner,String id){return store.findOwned(owner,id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"计算记录不可读取"));}
}
