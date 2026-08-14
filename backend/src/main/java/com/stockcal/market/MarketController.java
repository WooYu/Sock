package com.stockcal.market;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/market")
public class MarketController {
    private final MarketProvider provider;

    MarketController(MarketProvider provider) {
        this.provider = provider;
    }

    @GetMapping("/search")
    List<MarketProvider.Security> search(@RequestParam(defaultValue = "") String q) {
        return provider.search(q);
    }

    @GetMapping("/stocks/{code}/snapshot")
    MarketProvider.MarketSnapshot snapshot(@PathVariable String code) {
        return provider.snapshot(code);
    }
}
