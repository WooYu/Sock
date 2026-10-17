package com.stockcal.scenario;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import org.springframework.jdbc.core.simple.JdbcClient;
import static com.stockcal.scenario.ScenarioRecordValidator.require;

record ResearchCursor(String queryHash,Instant asOf,Instant positionTime,String positionId,String visibilitySnapshot) {
    static ResearchCursor read(String raw,String queryHash,JdbcClient jdbc) {
        if(raw==null || raw.isBlank())return jdbc.sql("select pg_current_snapshot()::text as snapshot,clock_timestamp() as as_of")
            .query((r,n)->new ResearchCursor(queryHash,r.getTimestamp("as_of").toInstant(),null,null,r.getString("snapshot"))).single();
        try {
            require(raw.length()<16384,"游标过长");
            var cursor=ResearchJson.JSON.readValue(Base64.getUrlDecoder().decode(raw),ResearchCursor.class);
            require(queryHash.equals(cursor.queryHash) && cursor.asOf!=null && !cursor.asOf.isAfter(Instant.now()) && cursor.positionTime!=null
                && cursor.positionId!=null && cursor.positionTime.compareTo(cursor.asOf)<=0 && cursor.visibilitySnapshot!=null
                && cursor.visibilitySnapshot.matches("[0-9]+:[0-9]+:(?:[0-9]+(?:,[0-9]+)*)?"),"游标不属于当前筛选");return cursor;
        }catch(RuntimeException e){throw new IllegalArgumentException("分页游标无效，请重新查询",e);}
    }
    String after(Instant time,String id) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(ResearchJson.JSON.writeValueAsString(new ResearchCursor(queryHash,asOf,time,id,visibilitySnapshot)).getBytes(StandardCharsets.UTF_8));
    }
}
