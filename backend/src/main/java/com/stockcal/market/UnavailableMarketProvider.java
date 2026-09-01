package com.stockcal.market;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

final class UnavailableMarketProvider implements MarketProvider {
    public List<Security> search(String query) { return List.of(); }

    public MarketSnapshot snapshot(String code) {
        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "未配置真实行情源");
    }
}
