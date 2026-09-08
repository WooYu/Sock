package com.stockcal.prediction;

import com.stockcal.market.MarketProvider;
import com.stockcal.prediction.PredictionModels.ChartPeriod;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/market/stocks")
public class PredictionController {
    private final MarketProvider provider;
    private final PredictionService service;

    PredictionController(MarketProvider provider, PredictionService service) {
        this.provider = provider;
        this.service = service;
    }

    @GetMapping("/{symbol}/prediction")
    ResponseEntity<?> prediction(@PathVariable String symbol, @RequestParam(defaultValue = "day") String period) {
        if (!symbol.matches("^[A-Za-z0-9]{1,12}$")) {
            return ResponseEntity.badRequest().body(Map.of("code", "PREDICTION_SYMBOL_INVALID", "message", "股票代码格式不正确"));
        }
        if (!period.equals("day")) {
            return ResponseEntity.badRequest().body(Map.of("code", "PREDICTION_PERIOD_UNSUPPORTED", "message", "预测仅支持日线周期"));
        }
        return ResponseEntity.ok(service.predict(symbol, ChartPeriod.DAY, provider.snapshot(symbol).dailyCandles()));
    }

    @ExceptionHandler(PredictionService.InsufficientDataException.class)
    ResponseEntity<?> insufficientData(PredictionService.InsufficientDataException error) {
        return ResponseEntity.status(422).body(Map.of("code", "PREDICTION_DATA_INSUFFICIENT", "message", error.getMessage()));
    }
}
