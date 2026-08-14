import '../../domain/stockcal_domain.dart';
import '../analysis/technical_analysis.dart';
import 'rule_engine.dart';

class BacktestRequest {
  const BacktestRequest({
    required this.stockCode,
    required this.rule,
    required this.from,
    required this.to,
    required this.horizonSessions,
    required this.hitTolerance,
  });

  final String stockCode;
  final RuleVersion rule;
  final DateTime from;
  final DateTime to;
  final int horizonSessions;
  final double hitTolerance;
}

class BacktestSample {
  const BacktestSample({
    required this.signalDay,
    required this.predictedTarget,
    required this.actualClose,
    required this.absoluteError,
    required this.hit,
  });

  final DateTime signalDay;
  final double predictedTarget;
  final double actualClose;
  final double absoluteError;
  final bool hit;
}

class BacktestResult {
  BacktestResult({
    required this.stockCode,
    required this.ruleId,
    required this.ruleVersion,
    required List<BacktestSample> samples,
    required this.hitRate,
    required this.meanAbsoluteError,
    required this.maximumDrawdown,
  }) : samples = List.unmodifiable(samples);

  final String stockCode;
  final String ruleId;
  final int ruleVersion;
  final List<BacktestSample> samples;
  final double hitRate;
  final double meanAbsoluteError;
  final double maximumDrawdown;

  int get sampleCount => samples.length;
}

class BacktestEngine {
  BacktestResult run({
    required BacktestRequest request,
    required List<Candle> candles,
  }) {
    if (request.horizonSessions <= 0 || request.hitTolerance < 0) {
      throw ArgumentError('回测周期必须大于零，容差不能为负数');
    }
    final ordered = [...candles]..sort((a, b) => a.day.compareTo(b.day));
    final analyzer = StockAnalyzer();
    final book = RuleBook(idFactory: () => 'unused');
    final samples = <BacktestSample>[];
    final evaluatedCloses = <double>[];

    for (
      var index = 19;
      index < ordered.length - request.horizonSessions;
      index++
    ) {
      final signal = ordered[index];
      if (signal.day.isBefore(request.from) || signal.day.isAfter(request.to)) {
        continue;
      }
      final historical = ordered.sublist(0, index + 1);
      final analysis = analyzer.analyze(historical);
      final facts = RuleFacts(
        closeAboveMa20: analysis.lastClose >= analysis.maLong,
        volumeRatio: analysis.volumeRatio,
        supportDistance: analysis.lastClose == 0
            ? 1
            : (analysis.lastClose - analysis.support) / analysis.lastClose,
      );
      if (!book.evaluate(request.rule, facts)) continue;

      final future = ordered.sublist(
        index + 1,
        index + request.horizonSessions + 1,
      );
      final actual = future.last.close;
      final predicted = analysis.target;
      final error = actual == 0 ? 0.0 : (predicted - actual).abs() / actual;
      samples.add(
        BacktestSample(
          signalDay: signal.day,
          predictedTarget: predicted,
          actualClose: actual,
          absoluteError: error,
          hit: error <= request.hitTolerance,
        ),
      );
      evaluatedCloses.addAll(future.map((item) => item.close));
    }

    if (samples.isEmpty) throw ArgumentError('所选范围没有可评估样本');
    final hits = samples.where((item) => item.hit).length;
    final meanError =
        samples.fold<double>(0, (sum, item) => sum + item.absoluteError) /
        samples.length;
    return BacktestResult(
      stockCode: request.stockCode,
      ruleId: request.rule.id,
      ruleVersion: request.rule.version,
      samples: samples,
      hitRate: hits / samples.length,
      meanAbsoluteError: meanError,
      maximumDrawdown: _maximumDrawdown(evaluatedCloses),
    );
  }

  double _maximumDrawdown(List<double> values) {
    if (values.isEmpty) return 0;
    var peak = values.first;
    var maximum = 0.0;
    for (final value in values) {
      if (value > peak) peak = value;
      if (peak == 0) continue;
      final drawdown = (peak - value) / peak;
      if (drawdown > maximum) maximum = drawdown;
    }
    return maximum;
  }
}
