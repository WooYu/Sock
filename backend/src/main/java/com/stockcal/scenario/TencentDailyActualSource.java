package com.stockcal.scenario;

import com.stockcal.market.MarketProvider.Candle;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.springframework.web.client.RestClient;

/** Explicit daily price adjustment and share-volume unit as the public frontend adapter. */
public final class TencentDailyActualSource implements DailyActualSource {
    private final RestClient rest;
    private final Clock clock;
    public TencentDailyActualSource(RestClient rest,Clock clock){this.rest=rest;this.clock=clock;}
    public DailyActualSeries fetch(String symbol) { return fetch(symbol,"none"); }
    @Override public DailyActualSeries fetch(String symbol,String adjustment) {
        ScenarioRecordValidator.require(Set.of("none","qfq").contains(adjustment),"实际行情价格口径不支持");
        ScenarioRecordValidator.require(symbol!=null && symbol.matches("\\d{6}"),"股票代码无效");
        String prefix=symbol.matches("([48]\\d{5}|92\\d{4})")?"bj":symbol.startsWith("6")||symbol.startsWith("9")?"sh":"sz";
        String code=prefix+symbol;
        String body=rest.get().uri("https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param="+code+",day,,,640,"+("qfq".equals(adjustment)?"qfq":""))
            .retrieve().body(String.class);
        if(body==null || body.length()>2_000_000)throw new IllegalStateException("日线响应缺失或过大");
        try {
            var root=ResearchJson.JSON.readTree(body);
            if(root.path("code").asInt()!=0)throw new IllegalArgumentException("供应商日线错误");
            var rows=root.path("data").path(code).path("qfq".equals(adjustment)?"qfqday":"day");
            if(!rows.isArray() || rows.isEmpty() || rows.size()>2000)throw new IllegalArgumentException("指定口径日线缺失");
            var candles=new TreeMap<LocalDate,Candle>();
            for(var row:rows) {
                if(!row.isArray() || row.size()<6)throw new IllegalArgumentException("日线列不足");
                double o=Double.parseDouble(row.get(1).asText()),c=Double.parseDouble(row.get(2).asText()),h=Double.parseDouble(row.get(3).asText()),l=Double.parseDouble(row.get(4).asText());
                for(double p:new double[]{o,c,h,l})PriceClosenessEvaluator.cents(p);
                long volume=new BigDecimal(row.get(5).asText()).movePointRight(2).longValueExact();
                if(h<Math.max(o,c)||l>Math.min(o,c)||volume<0)throw new IllegalArgumentException("日线OHLCV关系错误");
                var candle=new Candle(LocalDate.parse(row.get(0).asText()),o,h,l,c,volume);candles.put(candle.day(),candle);
            }
            return new DailyActualSeries(symbol,"腾讯公开行情·延时",clock.instant(),List.copyOf(candles.values()),ResearchJson.hash(body),"raw_utf8_response",Map.of(),adjustment);
        }catch(RuntimeException e){throw new IllegalStateException("公开日线未通过校验",e);}
    }
}
