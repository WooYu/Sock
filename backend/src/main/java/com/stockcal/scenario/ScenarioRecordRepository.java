package com.stockcal.scenario;

import static com.stockcal.scenario.ScenarioContracts.*;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Repository
public class ScenarioRecordRepository {
    private final JdbcClient jdbc;
    private final NoteStudyService notes;
    public ScenarioRecordRepository(JdbcClient jdbc,NoteStudyService notes){this.jdbc=jdbc;this.notes=notes;}
    @Transactional
    public ForecastRecord save(String owner,ScenarioRecordValidator.ValidatedForecast v,Instant receivedAt) {
        var existing=byClientKey(owner,v.clientRecordId(),v.clientVersion());
        if(existing.isPresent())return samePayload(existing.get(),v.payloadHash());
        ForecastRecord previous=null;
        if(v.clientVersion()>1) {
            previous=byClientKey(owner,v.clientRecordId(),v.clientVersion()-1).orElseThrow(()->new ResponseStatusException(HttpStatus.CONFLICT,"请先上传上一计算版本"));
            ScenarioRecordValidator.require(previous.symbol().equals(v.symbol()),"版本股票不一致");
        }
        var record=new ForecastRecord(UUID.randomUUID().toString(),owner,v.clientRecordId(),v.clientVersion(),previous==null?null:previous.id(),
            v.symbol(),v.kind(),receivedAt,v.clientCreatedAt(),v.inputAsOf(),v.anchorDay(),v.method(),v.definitionVersion(),v.payloadHash(),TARGET_POLICY,
            v.request().snapshot(),notes.resolveBindings(owner,v.request().noteBindings()),v.levels());
        jdbc.sql("""
            insert into scenario_forecast_record(id,owner_id,client_record_id,client_version,previous_record_id,symbol,kind,received_at,
            client_created_at,input_as_of,anchor_day,method,definition_version,target_policy,payload_hash,payload_text,next_check_at)
            values(:id,:owner,:client,:version,:previous,:symbol,:kind,:received,:created,:asof,:anchor,:method,:definition,:policy,:hash,:payload,:received)
            on conflict(owner_id,client_record_id,client_version) do nothing
            """).param("id",record.id()).param("owner",owner).param("client",v.clientRecordId()).param("version",v.clientVersion())
            .param("previous",record.previousRecordId()).param("symbol",v.symbol()).param("kind",v.kind()).param("received",Timestamp.from(receivedAt))
            .param("created",Timestamp.from(v.clientCreatedAt())).param("asof",Timestamp.from(v.inputAsOf())).param("anchor",v.anchorDay())
            .param("method",v.method()).param("definition",v.definitionVersion()).param("policy",TARGET_POLICY).param("hash",v.payloadHash())
            .param("payload",ResearchJson.JSON.writeValueAsString(record)).update();
        return samePayload(byClientKey(owner,v.clientRecordId(),v.clientVersion()).orElseThrow(),v.payloadHash());
    }
    private ForecastRecord samePayload(ForecastRecord existing,String hash) {
        if(!existing.payloadHash().equals(hash))throw new ResponseStatusException(HttpStatus.CONFLICT,"同一计算版本的内容冲突，原价格未覆盖");
        return existing;
    }
    private Optional<ForecastRecord> byClientKey(String owner,String client,int version) {
        return jdbc.sql("select payload_text from scenario_forecast_record where owner_id=:owner and client_record_id=:client and client_version=:version")
            .param("owner",owner).param("client",client).param("version",version).query(String.class).optional().map(s->ResearchJson.JSON.readValue(s,ForecastRecord.class));
    }
    public Optional<ForecastRecord> findOwned(String owner,String id) {
        return jdbc.sql("select payload_text from scenario_forecast_record where owner_id=:owner and id=:id")
            .param("owner",owner).param("id",id).query(String.class).optional().map(s->ResearchJson.JSON.readValue(s,ForecastRecord.class));
    }
    public Optional<ForecastRecord> findInternal(String id) {
        return jdbc.sql("select payload_text from scenario_forecast_record where id=:id").param("id",id).query(String.class).optional().map(s->ResearchJson.JSON.readValue(s,ForecastRecord.class));
    }
    public List<PriceEvaluation> evaluations(String id) {return evaluations(id,Instant.parse("9999-12-31T00:00:00Z"));}
    public List<PriceEvaluation> evaluations(String id,Instant asOf) {
        return jdbc.sql("select payload_text from scenario_price_evaluation where forecast_id=:id and evaluated_at<=:asof order by evaluation_version")
            .param("id",id).param("asof",Timestamp.from(asOf)).query(String.class).list().stream().map(s->ResearchJson.JSON.readValue(s,PriceEvaluation.class)).toList();
    }
    public static EvaluationView view(List<PriceEvaluation> history) {
        if(history.isEmpty())return new EvaluationView(null,null);
        var latest=history.getLast();PriceEvaluation successful=null;
        for(var e:history)if(e.targetResolution().version()==latest.targetResolution().version() && "verified".equals(e.targetResolution().state()) && "scored".equals(e.status())) {
            if(e.result()!=null)successful=e;
            else if(e.scoreEvaluationId()!=null)successful=history.stream().filter(s->s.id().equals(e.scoreEvaluationId()) && s.result()!=null).findFirst().orElse(null);
        }
        return new EvaluationView(latest,successful);
    }
    @Transactional
    public PriceEvaluation appendEvaluation(String id,PriceEvaluation candidate) {
        jdbc.sql("select id from scenario_forecast_record where id=:id for update").param("id",id).query(String.class).single();
        var history=evaluations(id);var previous=history.isEmpty()?null:history.getLast();
        PriceEvaluation oldScore=null;
        if(candidate.result()!=null)oldScore=history.stream().filter(e->e.result()!=null && e.targetResolution().version()==candidate.targetResolution().version()
            && e.source().candleHash().equals(candidate.source().candleHash())).findFirst().orElse(null);
        if(oldScore!=null && previous!=null && "scored".equals(previous.status()) && previous.source()!=null
            && previous.source().fetchedAt().equals(candidate.source().fetchedAt()) && previous.source().responseHash().equals(candidate.source().responseHash()) && previous.targetResolution().version()==oldScore.targetResolution().version()
            && (oldScore.id().equals(previous.id()) || oldScore.id().equals(previous.scoreEvaluationId())))return previous;
        var result=oldScore==null?candidate.result():null;
        var e=new PriceEvaluation(UUID.randomUUID().toString(),id,previous==null?1:previous.version()+1,previous==null?null:previous.id(),
            candidate.targetResolution(),candidate.status(),candidate.eligibility(),candidate.actual(),candidate.source(),result,candidate.evaluatedAt(),candidate.nextRetryAt(),oldScore==null?null:oldScore.id());
        jdbc.sql("""
            insert into scenario_price_evaluation(id,forecast_id,evaluation_version,previous_evaluation_id,score_evaluation_id,target_resolution_version,
            target_resolution_state,target_day,resolution_evidence,actual_candle_hash,raw_response_hash,actual_fetched_at,evaluated_at,definition_version,
            forward_eligible,status,next_retry_at,total_levels,close_levels,covered_targets,payload_text)
            values(:id,:forecast,:version,:previous,:score,:resolution,:state,:day,:evidence,:candle,:raw,:fetched,:evaluated,:definition,:eligible,:status,:retry,:total,:close,:covered,:payload)
            """).param("id",e.id()).param("forecast",id).param("version",e.version()).param("previous",e.previousEvaluationId()).param("score",e.scoreEvaluationId())
            .param("resolution",e.targetResolution().version()).param("state",e.targetResolution().state()).param("day",e.targetResolution().targetDay())
            .param("evidence",ResearchJson.canonical(e.targetResolution().evidence())).param("candle",result==null?null:e.source().candleHash())
            .param("raw",e.source()==null?null:e.source().responseHash()).param("fetched",e.source()==null?null:Timestamp.from(e.source().fetchedAt()))
            .param("evaluated",Timestamp.from(e.evaluatedAt())).param("definition",SCORE_VERSION).param("eligible",e.eligibility().forwardEligible())
            .param("status",e.status()).param("retry",e.nextRetryAt()==null?null:Timestamp.from(e.nextRetryAt())).param("total",result==null?null:result.totalLevels())
            .param("close",result==null?null:result.closeLevels()).param("covered",result==null?null:result.coveredTargets()).param("payload",ResearchJson.JSON.writeValueAsString(e)).update();
        return e;
    }
    public List<String> findDue(Instant now,int limit) {
        return jdbc.sql("select id from scenario_forecast_record where next_check_at<=:now and (claim_until is null or claim_until<:now) order by next_check_at,id limit :limit")
            .param("now",Timestamp.from(now)).param("limit",limit).query(String.class).list();
    }
    public boolean claim(String id,Instant now) {
        return jdbc.sql("update scenario_forecast_record set claim_until=:until where id=:id and (claim_until is null or claim_until<:now)")
            .param("id",id).param("now",Timestamp.from(now)).param("until",Timestamp.from(now.plusSeconds(120))).update()==1;
    }
    public int retryCount(String id){return jdbc.sql("select retry_count from scenario_forecast_record where id=:id").param("id",id).query(Integer.class).single();}
    public void schedule(String id,Instant next,Instant now,boolean success,boolean failure) {
        jdbc.sql("""
            update scenario_forecast_record set next_check_at=:next,claim_until=null,retry_count=case when :failure then retry_count+1 else 0 end,
            first_success_at=case when :success then coalesce(first_success_at,:now) else first_success_at end,
            recheck_until=case when :success then coalesce(recheck_until,:until) else recheck_until end where id=:id
            """).param("id",id).param("next",next==null?null:Timestamp.from(next)).param("now",Timestamp.from(now))
            .param("until",Timestamp.from(now.plusSeconds(7*86400))).param("success",success).param("failure",failure).update();
    }
    public Optional<Instant> recheckUntil(String id) {
        return jdbc.sql("select recheck_until from scenario_forecast_record where id=:id and recheck_until is not null")
            .param("id",id).query(Timestamp.class).optional().map(Timestamp::toInstant);
    }
    public Page<LearningSample> listSamples(String owner,LearningFilters f,String rawCursor,int limit) {
        ScenarioRecordValidator.require(limit>=1 && limit<=100,"分页数量须为1至100");
        ScenarioRecordValidator.require(f.symbol()==null || f.symbol().isBlank() || f.symbol().matches("\\d{6}"),"股票代码无效");
        ScenarioRecordValidator.require(f.anchorFrom()==null || f.anchorThrough()==null || !f.anchorFrom().isAfter(f.anchorThrough()),"基准日范围无效");
        var cursor=ResearchCursor.read(rawCursor,ResearchJson.hash(ResearchJson.canonical(Map.of("kind","samples","owner",owner,"filters",f))),jdbc);
        var query=jdbc.sql("""
            with owned as (
                select * from scenario_forecast_record where owner_id=:owner and received_at<=:asof
                and pg_visible_in_snapshot(created_xid,cast(:snapshot as pg_snapshot))
                and (:symbol='' or symbol=:symbol) and (:method='' or method=:method) and (:definition='' or definition_version=:definition)
                and (:fromDay='' or anchor_day>=cast(nullif(:fromDay,'') as date)) and (:throughDay='' or anchor_day<=cast(nullif(:throughDay,'') as date))
            ), latest as (
                select distinct on(e.forecast_id) e.* from scenario_price_evaluation e join owned f on f.id=e.forecast_id
                where e.evaluated_at<=:asof and pg_visible_in_snapshot(e.created_xid,cast(:snapshot as pg_snapshot))
                order by e.forecast_id,e.evaluation_version desc
            ), scored as (
                select distinct on(e.forecast_id) e.forecast_id,coalesce(e.score_evaluation_id,e.id) as score_id
                from scenario_price_evaluation e join latest c on c.forecast_id=e.forecast_id and c.target_resolution_version=e.target_resolution_version
                where e.evaluated_at<=:asof and pg_visible_in_snapshot(e.created_xid,cast(:snapshot as pg_snapshot))
                and e.status='scored' and e.definition_version=:evaluationDefinition
                and e.target_resolution_state='verified' and (e.total_levels is not null or e.score_evaluation_id is not null)
                order by e.forecast_id,e.evaluation_version desc
            )
            select f.payload_text as forecast,c.payload_text as latest_status,s.payload_text as successful,f.received_at,f.id
            from owned f left join latest c on c.forecast_id=f.id left join scored a on a.forecast_id=f.id left join scenario_price_evaluation s on s.id=a.score_id
            where (:status='' or coalesce(c.status,'pending')=:status)
            and (:filterEligibility=false or coalesce(s.forward_eligible,false)=:eligible)
            and (:candidate='' or f.payload_text::jsonb#>>'{snapshot,states,day,directionCandidate}'=:candidate)
            and (:confirmed='' or (case when f.payload_text::jsonb#>>'{snapshot,states,day,confirmed}'='true'
                then f.payload_text::jsonb#>>'{snapshot,states,day,direction}' else 'unknown' end)=:confirmed)
            and (:noteFile='' or exists(select 1 from jsonb_array_elements(f.payload_text::jsonb->'noteBindings') b
                where b->'study'->>'sourceFile'=:noteFile or b->'inlineVersion'->>'file'=:noteFile))
            and (:hasCursor=false or f.received_at<:position or (f.received_at=:position and f.id<:positionId))
            order by f.received_at desc,f.id desc limit :limit
            """).param("owner",owner).param("asof",Timestamp.from(cursor.asOf())).param("snapshot",cursor.visibilitySnapshot()).param("symbol",empty(f.symbol())).param("method",empty(f.method()))
            .param("definition",empty(f.forecastDefinitionVersion())).param("fromDay",f.anchorFrom()==null?"":f.anchorFrom().toString())
            .param("throughDay",f.anchorThrough()==null?"":f.anchorThrough().toString()).param("evaluationDefinition",empty(f.evaluationDefinitionVersion()).isEmpty()?SCORE_VERSION:f.evaluationDefinitionVersion())
            .param("status",empty(f.status())).param("filterEligibility",f.forwardEligible()!=null).param("eligible",Boolean.TRUE.equals(f.forwardEligible()))
            .param("candidate",empty(f.directionCandidate())).param("confirmed",empty(f.directionConfirmed())).param("noteFile",empty(f.noteFile()))
            .param("hasCursor",cursor.positionTime()!=null).param("position",Timestamp.from(cursor.positionTime()==null?cursor.asOf():cursor.positionTime()))
            .param("positionId",cursor.positionId()==null?"":cursor.positionId()).param("limit",limit+1);
        record Row(LearningSample sample,Instant time,String id){}
        var rows=query.query((r,n)->new Row(new LearningSample(ResearchJson.JSON.readValue(r.getString("forecast"),ForecastRecord.class),
            new EvaluationView(r.getString("latest_status")==null?null:ResearchJson.JSON.readValue(r.getString("latest_status"),PriceEvaluation.class),
                r.getString("successful")==null?null:ResearchJson.JSON.readValue(r.getString("successful"),PriceEvaluation.class))),r.getTimestamp("received_at").toInstant(),r.getString("id"))).list();
        var selected=rows.subList(0,Math.min(limit,rows.size()));var last=selected.isEmpty()?null:selected.getLast();
        return new Page<>(selected.stream().map(Row::sample).toList(),rows.size()>limit?cursor.after(last.time(),last.id()):null,cursor.asOf());
    }
    private static String empty(String value){return value==null?"":value;}
}
