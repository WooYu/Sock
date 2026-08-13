import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/domain/stockcal_domain.dart';
import 'package:stockcal/features/analysis/technical_analysis.dart';
import 'package:stockcal/features/market/market_data.dart';

void main() {
  List<Candle> candles(List<double> closes) => List.generate(
    closes.length,
    (index) => Candle(
      day: DateTime(2026, 7, 1).add(Duration(days: index)),
      open: closes[index] - 0.5,
      high: closes[index] + 1,
      low: closes[index] - 1,
      close: closes[index],
      volume: 1000 + index * 100,
    ),
  );

  group('technical indicators', () {
    test('calculates MA and EMA with null warm-up values', () {
      final input = candles([1, 2, 3, 4, 5, 6]);
      final calculator = IndicatorCalculator();

      final ma = calculator.sma(input, period: 5);
      final ema = calculator.ema(input, period: 3);

      expect(ma.take(4), everyElement(isNull));
      expect(ma[4], 3);
      expect(ma[5], 4);
      expect(ema.take(2), everyElement(isNull));
      expect(ema[2], 2);
      expect(ema[3], 3);
      expect(ema[5], 5);
    });

    test('calculates Bollinger bands from population deviation', () {
      final input = candles([1, 2, 3, 4, 5]);

      final bands = IndicatorCalculator().bollinger(
        input,
        period: 5,
        multiplier: 2,
      );

      expect(bands.take(4).every((band) => band == null), isTrue);
      expect(bands.last!.middle, 3);
      expect(bands.last!.upper, closeTo(3 + 2 * math.sqrt(2), 0.0001));
      expect(bands.last!.lower, closeTo(3 - 2 * math.sqrt(2), 0.0001));
    });

    test('calculates volume average and latest volume ratio', () {
      final input = candles([1, 2, 3, 4, 5]);

      final result = IndicatorCalculator().volume(input, period: 5);

      expect(result.average.last, 1200);
      expect(result.latestRatio, closeTo(1400 / 1200, 0.0001));
    });

    test('rejects insufficient candles and invalid periods', () {
      expect(
        () => IndicatorCalculator().sma(candles([1, 2]), period: 0),
        throwsArgumentError,
      );
      expect(
        () => IndicatorCalculator().bollinger(candles([1, 2]), period: 5),
        throwsA(isA<AnalysisException>()),
      );
    });
  });

  group('key level analysis', () {
    test(
      'derives levels, confidence, risk, rules, and three future sessions',
      () {
        final snapshot = DemoAshareData.candlesFor('600519');

        final analysis = StockAnalyzer().analyze(snapshot);

        expect(analysis.support, lessThan(analysis.lastClose));
        expect(analysis.resistance, greaterThan(analysis.support));
        expect(analysis.target, greaterThan(analysis.resistance));
        expect(analysis.confidence, inInclusiveRange(0.5, 0.95));
        expect(
          analysis.riskLevel,
          isIn([RiskLevel.low, RiskLevel.medium, RiskLevel.high]),
        );
        expect(analysis.matchedRules, isNotEmpty);
        expect(analysis.future, hasLength(3));
        expect(analysis.future.first.day.isAfter(snapshot.last.day), isTrue);
        expect(analysis.future.last.day.weekday, isNot(DateTime.saturday));
        expect(analysis.future.last.day.weekday, isNot(DateTime.sunday));
        expect(analysis.future.every((point) => point.ma5 > 0), isTrue);
        expect(
          analysis.future.every((point) => point.bollUpper > point.bollLower),
          isTrue,
        );
      },
    );

    test('does not mutate source candles when extending indicators', () {
      final source = DemoAshareData.candlesFor('600519');
      final originalLength = source.length;
      final originalLastDay = source.last.day;

      StockAnalyzer().analyze(source);

      expect(source, hasLength(originalLength));
      expect(source.last.day, originalLastDay);
    });
  });
}
