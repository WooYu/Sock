package com.stockcal.scenario;

import static com.stockcal.scenario.ScenarioContracts.*;
import com.stockcal.market.MarketProvider.Candle;
import java.time.Instant;
import java.util.*;

public interface DailyActualSource {
    DailyActualSeries fetch(String symbol);
    record DailyActualSeries(String symbol,String provider,Instant fetchedAt,List<Candle> candles,
                             String responseHash,String responseHashKind,Map<String,String> verifiedAbsentDays) {
        public ActualProvenance provenance(Candle candle) {
            String hash=ResearchJson.hash(ResearchJson.canonical(Map.of("provider",provider,"symbol",symbol,"adjustment","none","candle",candle)));
            return new ActualProvenance(provider,symbol,"none",fetchedAt,hash,responseHash,responseHashKind);
        }
    }
}
