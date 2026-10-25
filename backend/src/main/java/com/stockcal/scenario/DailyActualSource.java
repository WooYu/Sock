package com.stockcal.scenario;

import static com.stockcal.scenario.ScenarioContracts.*;
import com.stockcal.market.MarketProvider.Candle;
import java.time.Instant;
import java.util.*;

public interface DailyActualSource {
    DailyActualSeries fetch(String symbol);
    default DailyActualSeries fetch(String symbol,String adjustment) {
        if(!"none".equals(adjustment))throw new IllegalArgumentException("实际行情价格口径不支持");
        return fetch(symbol);
    }
    record DailyActualSeries(String symbol,String provider,Instant fetchedAt,List<Candle> candles,
                             String responseHash,String responseHashKind,Map<String,String> verifiedAbsentDays,String adjustment) {
        public DailyActualSeries(String symbol,String provider,Instant fetchedAt,List<Candle> candles,String responseHash,String responseHashKind,Map<String,String> verifiedAbsentDays) {
            this(symbol,provider,fetchedAt,candles,responseHash,responseHashKind,verifiedAbsentDays,"none");
        }
        public ActualProvenance provenance(Candle candle) {
            String hash=ResearchJson.hash(ResearchJson.canonical(Map.of("provider",provider,"symbol",symbol,"adjustment",adjustment,"candle",candle)));
            return new ActualProvenance(provider,symbol,adjustment,fetchedAt,hash,responseHash,responseHashKind);
        }
    }
}
