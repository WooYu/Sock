package com.stockcal.prediction;

import com.fasterxml.jackson.annotation.JsonValue;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class PredictionModels {
    private PredictionModels() {}

    public enum ChartPeriod {
        DAY;

        @JsonValue
        public String value() { return "day"; }
    }

    public record PredictionDay(
        LocalDate day, double open, double high, double low, double close,
        double rangeLow, double rangeHigh, double confidence,
        double ma5, double ma10, double ma20,
        double bollUpper, double bollMiddle, double bollLower
    ) {}

    public record PredictionSnapshot(
        String symbol, ChartPeriod period, Instant generatedAt, String modelVersion,
        List<PredictionDay> days
    ) {
        public PredictionSnapshot { days = List.copyOf(days); }
    }
}
