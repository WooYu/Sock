package com.stockcal.scenario;
import static com.stockcal.scenario.ScenarioContracts.*;
import java.security.Principal;
import java.time.LocalDate;
import java.util.Map;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/v1/learning-samples")
public class LearningSampleController {
    private final ScenarioRecordRepository store;
    public LearningSampleController(ScenarioRecordRepository store){this.store=store;}
    @GetMapping Page<LearningSample> list(Principal p,@RequestHeader(value="X-Client-Id",required=false) String client,@RequestParam Map<String,String> q){
        String eligible=q.get("forwardEligible");
        ScenarioRecordValidator.require(eligible==null || eligible.equals("true") || eligible.equals("false"),"前瞻资格参数无效");
        var filters=new LearningFilters(q.get("symbol"),date(q.get("anchorFrom")),date(q.get("anchorThrough")),q.get("method"),q.get("forecastDefinitionVersion"),q.get("evaluationDefinitionVersion"),
            q.get("directionCandidate"),q.get("directionConfirmed"),q.get("noteFile"),q.get("status"),eligible==null?null:Boolean.valueOf(eligible));
        return store.listSamples(ResearchIdentity.resolve(p,client),filters,q.get("cursor"),Integer.parseInt(q.getOrDefault("limit","25")));
    }
    private LocalDate date(String value){return value==null || value.isBlank()?null:LocalDate.parse(value);}
}
