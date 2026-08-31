import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/domain/stockcal_domain.dart';
import 'package:stockcal/features/analysis/technical_analysis.dart';
import 'package:stockcal/features/decision/decision_models.dart';
import 'package:stockcal/features/market/market_data.dart';
import 'package:stockcal/features/rules/rule_engine.dart';

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
        expect(analysis.future.every((point) => point.ma(5) > 0), isTrue);
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

  group('model extensions', () {
    final rising = candles(List.generate(30, (i) => 10.0 + i * 0.1));

    test('analyze exposes amplitude, atr and parameter snapshot', () {
      final analysis = StockAnalyzer().analyze(rising);
      expect(analysis.amplitude, greaterThan(0));
      expect(analysis.atr, greaterThan(0));
      expect(analysis.parameters, isNotEmpty);
      expect(analysis.parameters.every((p) => p.label.isNotEmpty), isTrue);
      expect(analysis.modelName, isNotEmpty);
      expect(analysis.conditions, hasLength(3));
    });

    test(
      'matched rules carry a band and hit counts fall back to heuristics',
      () {
        final analysis = StockAnalyzer().analyze(rising);
        expect(analysis.matchedRules, isNotEmpty);
        expect(analysis.matchedRules.first.band, isNotNull);
        expect(
          analysis.ruleTotalCount,
          greaterThanOrEqualTo(analysis.ruleHitCount),
        );
      },
    );

    test(
      'direction strength stays on the matching side of the neutral axis',
      () {
        final bullish = StockAnalyzer().analyze(rising);
        final falling = candles(List.generate(30, (i) => 30.0 - i * 0.2));
        final bearish = StockAnalyzer().analyze(falling);

        expect(bullish.direction, Direction.bullish);
        expect(bullish.directionStrength, greaterThan(50));
        expect(bearish.direction, Direction.bearish);
        expect(bearish.directionStrength, lessThan(50));
      },
    );

    test('analyzer uses RuleBook for hit counts when provided', () {
      final book = RuleBook.withSystemDefaults();
      final analysis = StockAnalyzer(ruleBook: book).analyze(rising);
      expect(analysis.ruleTotalCount, book.activeRules.length);
      expect(analysis.ruleHitCount, greaterThan(0));
    });

    test('recognizes climbing pattern for a strongly rising series', () {
      final risingStrong = candles(List.generate(30, (i) => 10.0 + i * 0.5));
      final signal = StockAnalyzer().recognizeTrend(risingStrong);
      expect(signal.pattern, TrendPattern.climbing);
      expect(signal.reason, isNotEmpty);
    });

    test('model name reflects a local engine, not an unintegrated LLM', () {
      final analysis = StockAnalyzer().analyze(rising);
      expect(analysis.modelName, isNot(contains('GPT')));
    });
  });

  group('decision gate integration', () {
    test('attaches WAIT when the decision engine has no applicable rule', () {
      final falling = candles(
        List.generate(30, (i) => 40.0 - i * 0.5),
      );

      final analysis = StockAnalyzer().analyze(falling);

      expect(analysis.decision, isNotNull);
      expect(analysis.decision!.decision, DecisionAction.wait);
      expect(analysis.decision!.reason, contains('规则'));
    });

    test('attaches ENTER for a confirmed rising trend', () {
      final risingStrong = candles(
        List.generate(30, (i) => 10.0 + i * 0.5),
      );

      final analysis = StockAnalyzer().analyze(risingStrong);

      expect(analysis.decision!.decision, DecisionAction.enter);
      expect(analysis.decision!.matchedRules, isNotEmpty);
    });

    test('surfaces a rule conflict as WAIT', () {
      var id = 0;
      final book = RuleBook(idFactory: () => 'rule-${++id}');
      book.create(
        name: '允许进入',
        priority: 10,
        action: DecisionAction.enter,
        conditions: const [
          RuleCondition(
            field: RuleField.closeAboveMa20,
            operator: RuleOperator.equals,
            value: 1,
          ),
        ],
      );
      book.create(
        name: '禁止进入',
        priority: 10,
        action: DecisionAction.exit,
        conditions: const [
          RuleCondition(
            field: RuleField.closeAboveMa20,
            operator: RuleOperator.equals,
            value: 1,
          ),
        ],
      );

      final analysis = StockAnalyzer(
        ruleBook: book,
      ).analyze(candles(List.generate(30, (i) => 10.0 + i * 0.5)));

      expect(analysis.decision!.decision, DecisionAction.wait);
      expect(analysis.decision!.conflicts, containsAll(['允许进入', '禁止进入']));
    });

    test('does not make a fresh-looking conclusion from stale data', () {
      final analysis = StockAnalyzer().analyze(
        candles(List.generate(30, (i) => 10.0 + i * 0.5)),
        dataFresh: false,
      );

      expect(analysis.decision!.decision, DecisionAction.wait);
      expect(analysis.decision!.reason, contains('过期'));
    });
  });
}
