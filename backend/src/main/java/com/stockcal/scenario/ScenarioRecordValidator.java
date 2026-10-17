package com.stockcal.scenario;

import static com.stockcal.scenario.ScenarioContracts.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;
import tools.jackson.databind.JsonNode;

/** Checks frozen provenance and price consolidation; it does not certify chart-pattern predictions. */
public final class ScenarioRecordValidator {
    private static final Set<String> PERIODS=Set.of("day","60m","30m");
    private static final Set<String> METHODS=Set.of("average_delta","last_delta","rolling_close");
    public record ValidatedForecast(SaveForecastRequest request, String clientRecordId, int clientVersion,
        String symbol, String kind, Instant clientCreatedAt, Instant inputAsOf, LocalDate anchorDay,
        String method, String definitionVersion, String payloadHash, List<ForecastLevel> levels) {}
    public ValidatedForecast validate(SaveForecastRequest request) {
        try { return checked(request); }
        catch (IllegalArgumentException e) { throw e; }
        catch (RuntimeException e) { throw new IllegalArgumentException("冻结分析格式或时间无效",e); }
    }
    private ValidatedForecast checked(SaveForecastRequest request) {
        require(request!=null && request.snapshot()!=null,"缺少分析快照");
        var s=request.snapshot(); var input=s.path("input");
        require(s.path("schemaVersion").asInt()==1,"分析schema不支持");
        String id=text(s,"id"), symbol=text(input,"symbol"), kind=text(s,"kind");
        int version=s.path("version").asInt();
        require(id.length()<=180 && version>0 && (version==1 ? !s.has("previousVersion") : s.path("previousVersion").asInt()==version-1),"版本链无效");
        require(symbol.matches("\\d{6}") && input.path("sourceMode").asText().equals("real"),"仅保存真实股票分析");
        require(Set.of("live","replay").contains(kind),"分析类型无效");
        Instant asOf=Instant.parse(text(input,"asOf")), created=Instant.parse(text(s,"createdAt"));
        require(!created.isBefore(asOf),"生成时间早于分析时点");
        var periods=input.path("periods"); require(periods.isObject() && periods.has("day"),"完整日线基准未就绪");
        for(var entry:periods.properties()) {
            String period=entry.getKey(); var p=entry.getValue();
            require(PERIODS.contains(period) && period.equals(text(p,"period")) && symbol.equals(text(p,"symbol")) && "none".equals(text(p,"adjustment")),"周期股票或复权口径不一致");
            require(asOf.equals(Instant.parse(text(p,"asOf"))),"周期时点不一致");
            Instant fetched=Instant.parse(text(p.path("source"),"fetchedAt"));
            var bars=p.path("closed"); require(bars.isArray(),"完整柱列表缺失"); String prior="";
            for(var bar:bars) {
                String day=text(bar,"day"); Instant end=endAt(period,day); validateCandle(bar);
                require(day.compareTo(prior)>0 && !end.isAfter(asOf) && !end.isAfter(fetched),"未来柱或无序柱不能参与分析"); prior=day;
            }
            require(bars.isEmpty() ? p.path("lastClosedAt").isNull() : endAt(period,prior).equals(Instant.parse(text(p,"lastClosedAt"))),"完整柱结束时间不一致");
        }
        var daily=periods.path("day").path("closed"); require(!daily.isEmpty(),"完整日线基准未就绪");
        var anchor=daily.get(daily.size()-1); LocalDate anchorDay=LocalDate.parse(text(anchor,"day"));
        var selection=s.path("consolidation"); String method=text(selection,"method");
        require(METHODS.contains(method) && "reference-mean-1pct-v1".equals(text(selection,"definitionVersion"))
            && selection.path("tolerance").asDouble()==0.01 && "arithmetic_mean".equals(text(selection,"aggregation")),"合并定义无效");
        var refs=s.path("references"); require(refs.isArray() && s.path("scenarios").isArray(),"价位来源缺失");
        Map<String,JsonNode> byId=new HashMap<>(); var selected=new ArrayList<JsonNode>();
        for(var ref:refs) {
            String refId=text(ref,"id"), period=text(ref,"period"), origin=text(ref,"originBarKey"), refMethod=text(ref,"method");
            require(byId.put(refId,ref)==null && PERIODS.contains(period) && periods.has(period) && METHODS.contains(refMethod),"引用ID或周期无效");
            var bars=periods.path(period).path("closed");
            require(!bars.isEmpty() && origin.equals(text(bars.get(bars.size()-1),"day")) && endAt(period,origin).equals(Instant.parse(text(ref,"originEndAt")))
                && asOf.equals(Instant.parse(text(ref,"asOf"))),"引用原点不一致");
            int horizon=ref.path("target").path("horizon").asInt(); require(horizon>=1 && horizon<=4,"未来根数无效");
            var target=ref.path("target");
            if(!target.path("barKey").isNull()) require(endAt(period,text(target,"barKey")).equals(Instant.parse(text(target,"endAt")))
                && endAt(period,text(target,"barKey")).isAfter(endAt(period,origin)),"目标柱时间无效");
            if("rolling_close".equals(refMethod) && ref.path("valid").asBoolean()) {
                String pathId=text(ref,"scenarioId");
                require(stream(s.path("scenarios")).anyMatch(p -> pathId.equals(p.path("id").asText()) && period.equals(p.path("period").asText())
                    && symbol.equals(p.path("symbol").asText()) && origin.equals(p.path("originBarKey").asText()) && p.path("closes").size()>=horizon),"滚动路径缺失");
            }
            if(ref.path("valid").asBoolean()) {
                double value=number(ref,"value"); require(value>0,"参考价无效");
                if(method.equals(refMethod) && (!"rolling_close".equals(method) || ref.path("scenarioId").asText().equals(selection.path("scenarioIds").path(period).asText()))) selected.add(ref);
            }
        }
        selected.sort(Comparator.comparingDouble((JsonNode r)->r.path("value").asDouble()).thenComparing(r->r.path("id").asText()));
        var groups=new ArrayList<List<JsonNode>>();
        for(var ref:selected) {
            var group=groups.isEmpty()?null:groups.getLast(); double v=ref.path("value").asDouble();
            if(group!=null && group.stream().allMatch(r -> Math.abs(v-r.path("value").asDouble())/(v/2+r.path("value").asDouble()/2)<=0.01+8*Math.ulp(1.0))) group.add(ref);
            else {var next=new ArrayList<JsonNode>();next.add(ref);groups.add(next);}
        }
        var merged=s.path("mergedLevels"); require(merged.isArray() && merged.size()==groups.size(),"合并组数量不一致");
        for(int i=0;i<groups.size();i++) {
            var g=groups.get(i); var frozen=merged.get(i);
            require(String.join("::",g.stream().map(r->r.path("id").asText()).toList()).equals(text(frozen,"id")),"合并成员不一致");
            require(near(number(frozen,"value"),g.stream().mapToDouble(r->r.path("value").asDouble()/g.size()).sum()),"合并均价不一致");
            require(ResearchJson.canonical(frozen.path("references")).equals(ResearchJson.canonical(g)),"合并引用不一致");
        }
        var levels=validateLadder(s,anchor,anchorDay,symbol,asOf);
        var normalized=new SaveForecastRequest(s.deepCopy(),request.noteBindings()==null?List.of():List.copyOf(request.noteBindings()));
        return new ValidatedForecast(normalized,id,version,symbol,kind,created,asOf,anchorDay,method,text(s,"definitionVersion"),ResearchJson.hash(ResearchJson.canonical(normalized)),levels);
    }
    private List<ForecastLevel> validateLadder(JsonNode snapshot,JsonNode anchor,LocalDate day,String symbol,Instant asOf) {
        var ladder=snapshot.path("dailyPriceLadder"); String definition=text(ladder,"definitionVersion");
        boolean legacy="daily-close-ladder-v1".equals(definition);
        require(legacy || "daily-close-levels-v2".equals(definition),"单日价位定义无效");
        require(ladder.path("tickSize").asDouble()==0.01,"最小报价单位无效");
        long close=PriceClosenessEvaluator.cents(number(anchor,"close")); var frozenAnchor=ladder.path("anchor");
        require(day.toString().equals(text(frozenAnchor,"barKey")) && endAt("day",day.toString()).equals(Instant.parse(text(frozenAnchor,"endAt")))
            && PriceClosenessEvaluator.cents(number(frozenAnchor,"close"))==close,"收盘锚点不一致");
        var priceSelection=ladder.path("selection"); var limit=priceSelection.path("limit"); String source=text(limit,"source"); text(limit,"label");
        int count=legacy?priceSelection.path("count").asInt():0;
        require(legacy?Set.of(3,4,5).contains(count):!priceSelection.has("count"),"不可补足固定档数");
        Double ratio=limit.path("ratio").isNull()?null:number(limit,"ratio");
        require(Set.of("manual","board_default","unverified").contains(source),"涨跌幅来源无效");
        if("board_default".equals(source)) {
            double expected=symbol.matches("(300|301|688|689)\\d{3}")?.2:symbol.matches("([48]\\d{5}|92\\d{4})")?.3:symbol.matches("(600|601|603|605|000|001|002|003)\\d{3}")?.1:0;
            require(ratio!=null && ratio==expected && expected>0,"板块涨跌幅不一致");
        } else require("unverified".equals(source)?ratio==null:ratio!=null && Set.of(.05,.1,.2,.3).contains(ratio),"涨跌幅规则无效");
        boolean stale=false;
        var calendar=snapshot.path("input").path("calendar");
        for(var d:calendar.path("tradingDays")) if(d.asText().compareTo(day.toString())>0 && !endAt("day",d.asText()).isAfter(asOf))stale=true;
        for(String period:List.of("60m","30m"))for(var b:snapshot.path("input").path("periods").path(period).path("closed")) {
            String key=text(b,"day");if(key.substring(0,10).compareTo(day.toString())>0 && key.substring(11,16).equals("15:00"))stale=true;
        }
        boolean noBand=ratio==null || stale;
        long lower=ratio==null?0:Math.max(1,round(close*(1-ratio))),upper=ratio==null?0:round(close*(1+ratio));
        noBand |= lower==close || upper==close;
        var candidates=new TreeMap<Long,List<String>>();var excluded=new ArrayList<String>();
        if(noBand) require(ladder.path("band").isNull(),"未验证区间不能输出价格");
        else {
            require(PriceClosenessEvaluator.cents(number(ladder.path("band"),"lower"))==lower && PriceClosenessEvaluator.cents(number(ladder.path("band"),"upper"))==upper,"涨跌幅区间不一致");
            for(var group:snapshot.path("mergedLevels")) {
                double value=number(group,"value");String id=text(group,"id");
                if(value<lower/100.0 || value>upper/100.0) {excluded.add(id);continue;}
                long tick=round(value*100);if(tick!=close)candidates.computeIfAbsent(tick,k->new ArrayList<>()).add(id);
            }
        }
        require(ResearchJson.canonical(excluded).equals(ResearchJson.canonical(ladder.path("excludedGroupIds"))),"范围排除依据不一致");
        var output=new ArrayList<ForecastLevel>();
        for(int direction:List.of(1,-1)) {
            var entries=new LinkedHashMap<Long,List<String>>();
            var sorted=direction==1?candidates:candidates.descendingMap();
            sorted.forEach((tick,ids)->{if((tick-close)*direction>0 && (!legacy || entries.size()<count))entries.put(tick,ids);});
            if(legacy && !noBand) {
                long width=Math.abs((direction==1?upper:lower)-close), max=Math.min(count,width);
                for(int i=1;i<=count && entries.size()<max;i++) {long offset=round((double)width*i/count);if(offset>0)entries.putIfAbsent(close+direction*offset,List.of());}
                for(long i=1;entries.size()<max && i<=width;i++)entries.putIfAbsent(close+direction*i,List.of());
            }
            var expected=entries.entrySet().stream().sorted((a,b)->Long.compare(a.getKey(),b.getKey())*direction).toList();
            var side=ladder.path(direction==1?"up":"down");require(side.isArray() && side.size()==expected.size(),"最终价位数量不一致");
            for(int i=0;i<expected.size();i++) {
                var e=expected.get(i);var p=side.get(i);String id=(direction==1?"up-":"down-")+e.getKey();
                require(id.equals(text(p,"id")) && PriceClosenessEvaluator.cents(number(p,"value"))==e.getKey()
                    && near(number(p,"changeRatio"),(double)(e.getKey()-close)/close) && (e.getValue().isEmpty()?"grid":"merged").equals(text(p,"kind"))
                    && ResearchJson.canonical(e.getValue()).equals(ResearchJson.canonical(p.path("groupIds"))),"最终价格或来源不一致");
                output.add(new ForecastLevel(id,e.getKey(),List.copyOf(e.getValue())));
            }
        }
        return List.copyOf(output);
    }
    static Instant endAt(String period,String key) {
        if("day".equals(period))return LocalDate.parse(key).atTime(15,0).atOffset(java.time.ZoneOffset.ofHours(8)).toInstant();
        var end=OffsetDateTime.parse(key);String slot=end.toLocalTime().toString();
        require(end.getOffset().getTotalSeconds()==8*3600 && ("60m".equals(period)?Set.of("10:30","11:30","14:00","15:00"):Set.of("10:00","10:30","11:00","11:30","13:30","14:00","14:30","15:00")).contains(slot),"周期结束时刻无效");return end.toInstant();
    }
    private static void validateCandle(JsonNode b) {
        double o=number(b,"open"),h=number(b,"high"),l=number(b,"low"),c=number(b,"close");
        require(l>0 && h>=Math.max(o,c) && l<=Math.min(o,c) && number(b,"volume")>=0,"OHLCV无效");
    }
    private static java.util.stream.Stream<JsonNode> stream(JsonNode n) {return java.util.stream.StreamSupport.stream(n.spliterator(),false);}
    static void require(boolean condition,String message) {if(!condition)throw new IllegalArgumentException(message);}
    static String text(JsonNode n,String key) {var v=n.path(key);require(v.isString() && !v.asText().isBlank(),key+"缺失");return v.asText();}
    static double number(JsonNode n,String key) {var v=n.path(key);require(v.isNumber() && Double.isFinite(v.asDouble()),key+"不是有效数值");return v.asDouble();}
    private static long round(double n){return BigDecimal.valueOf(n).setScale(0,RoundingMode.HALF_UP).longValueExact();}
    private static boolean near(double a,double b){return Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(b));}
}
