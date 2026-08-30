import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/domain/stockcal_domain.dart';
import 'package:stockcal/features/rules/backtest_engine.dart';
import 'package:stockcal/features/rules/rule_engine.dart';

void main() {
  group('BacktestEngine', () {
    final rule = RuleBook.withSystemDefaults().activeRules.first;

    test('filters by stock, exact rule version, and date range', () {
      final result = BacktestEngine().run(
        request: BacktestRequest(
          stockCode: '600519',
          rule: rule,
          from: DateTime(2026, 1, 10),
          to: DateTime(2026, 1, 20),
          horizonSessions: 3,
          hitTolerance: 0.05,
        ),
        candles: _trendCandles(35),
      );

      expect(result.stockCode, '600519');
      expect(result.ruleId, rule.id);
      expect(result.ruleVersion, rule.version);
      expect(result.samples, isNotEmpty);
      expect(
        result.samples,
        everyElement(
          predicate<BacktestSample>(
            (item) =>
                !item.signalDay.isBefore(DateTime(2026, 1, 10)) &&
                !item.signalDay.isAfter(DateTime(2026, 1, 20)),
          ),
        ),
      );
    });

    test('calculates hit rate, mean error, and maximum drawdown', () {
      final result = BacktestEngine().run(
        request: BacktestRequest(
          stockCode: '600519',
          rule: rule,
          from: DateTime(2026, 1, 6),
          to: DateTime(2026, 1, 25),
          horizonSessions: 2,
          hitTolerance: 0.08,
        ),
        candles: _trendCandles(35, pullbackAt: 22),
      );

      expect(result.sampleCount, result.samples.length);
      expect(result.hitRate, inInclusiveRange(0, 1));
      expect(result.meanAbsoluteError, greaterThanOrEqualTo(0));
      expect(result.maximumDrawdown, inInclusiveRange(0, 1));
    });

    test('uses only candles available on each signal day', () {
      final original = _trendCandles(35);
      final changedFuture = [...original];
      changedFuture[34] = _candle(34, 999);
      final request = BacktestRequest(
        stockCode: '600519',
        rule: rule,
        from: DateTime(2026, 1, 20),
        to: DateTime(2026, 1, 25),
        horizonSessions: 2,
        hitTolerance: 0.05,
      );

      final first = BacktestEngine().run(request: request, candles: original);
      final second = BacktestEngine().run(
        request: request,
        candles: changedFuture,
      );

      expect(
        second.samples.map((item) => item.predictedTarget),
        orderedEquals(first.samples.map((item) => item.predictedTarget)),
      );
    });

    test('rejects a range with no evaluable samples', () {
      expect(
        () => BacktestEngine().run(
          request: BacktestRequest(
            stockCode: '600519',
            rule: rule,
            from: DateTime(2027),
            to: DateTime(2027, 1, 2),
            horizonSessions: 3,
            hitTolerance: 0.05,
          ),
          candles: _trendCandles(10),
        ),
        throwsArgumentError,
      );
    });

    test('converts a backtest into a historical calibration summary', () {
      final result = BacktestResult(
        stockCode: '600519',
        ruleId: rule.id,
        ruleVersion: rule.version,
        samples: [
          BacktestSample(
            signalDay: DateTime(2026, 1, 1),
            predictedTarget: 100,
            actualClose: 102,
            absoluteError: 0.02,
            hit: true,
          ),
        ],
        hitRate: 1,
        meanAbsoluteError: 0.02,
        maximumDrawdown: 0.03,
      );

      final calibration = result.toCalibration(minimumSampleCount: 1);

      expect(calibration.calibrated, isTrue);
      expect(calibration.sampleCount, 1);
      expect(calibration.hitRate, 1);
    });
  });
}

List<Candle> _trendCandles(int count, {int? pullbackAt}) =>
    List.generate(count, (index) {
      final close = 100 + index - (index == pullbackAt ? 8 : 0);
      return _candle(index, close.toDouble());
    });

Candle _candle(int index, double close) => Candle(
  day: DateTime(2026, 1, 1).add(Duration(days: index)),
  open: close - 1,
  high: close + 2,
  low: close - 2,
  close: close,
  volume: 1000 + index * 20,
);
