package com.stockcal.scenario;

import static com.stockcal.scenario.ScenarioContracts.*;
import com.stockcal.market.MarketProvider.Candle;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;

public final class PriceClosenessEvaluator {
    static final long MAX_CENTS = 1_000_000_000_000L;
    public static long cents(double value) {
        if (!Double.isFinite(value) || value <= 0) throw new IllegalArgumentException("价格必须是正数");
        try {
            long cents = BigDecimal.valueOf(value).movePointRight(2).longValueExact();
            requireCents(cents);
            return cents;
        } catch (ArithmeticException e) { throw new IllegalArgumentException("价格必须精确到分且在有效范围", e); }
    }
    private static void requireCents(long cents) {
        if (cents <= 0 || cents > MAX_CENTS) throw new IllegalArgumentException("价格超出有效范围");
    }
    public PriceClosenessResult evaluate(List<ForecastLevel> levels, Candle actual) {
        var prices = new LinkedHashMap<String,Long>();
        prices.put("open", cents(actual.open())); prices.put("high", cents(actual.high()));
        prices.put("low", cents(actual.low())); prices.put("close", cents(actual.close()));
        if (actual.low() > Math.min(actual.open(),actual.close()) || actual.high() < Math.max(actual.open(),actual.close()))
            throw new IllegalArgumentException("实际四价关系无效");
        var evaluated = new ArrayList<LevelCloseness>();
        for (var level : levels) {
            requireCents(level.priceCents());
            var errors = new LinkedHashMap<String,Double>(); var matches = new ArrayList<String>();
            String nearest = null; double minimum = Double.POSITIVE_INFINITY; boolean exact = false;
            for (var target : prices.entrySet()) {
                long difference = Math.abs(level.priceCents() - target.getValue());
                double error = (double) difference / target.getValue();
                errors.put(target.getKey(),error);
                if (error < minimum) { minimum = error; nearest = target.getKey(); }
                if (difference * 100 < target.getValue()) matches.add(target.getKey());
                exact |= difference == 0;
            }
            evaluated.add(new LevelCloseness(level.id(),level.priceCents(),level.groupIds(),errors,nearest,List.copyOf(matches),exact));
        }
        var targets = new LinkedHashMap<String,TargetCloseness>();
        prices.forEach((name,price) -> {
            var matched = evaluated.stream().filter(l -> l.matches().contains(name)).map(LevelCloseness::id).toList();
            Double nearest = evaluated.stream().mapToDouble(l -> l.errors().get(name)).min().stream().boxed().findFirst().orElse(null);
            targets.put(name,new TargetCloseness(price,!matched.isEmpty(),matched,nearest));
        });
        int close = (int)evaluated.stream().filter(l -> !l.matches().isEmpty()).count();
        return new PriceClosenessResult(SCORE_VERSION,List.copyOf(evaluated),targets,levels.size(),close,
            levels.isEmpty() ? null : (double)close/levels.size(),(int)targets.values().stream().filter(TargetCloseness::covered).count(),
            (int)evaluated.stream().filter(LevelCloseness::exactMatch).count());
    }
}
