import 'decision_models.dart';
import '../rules/rule_engine.dart';

class CalibrationKey {
  const CalibrationKey({
    required this.ruleId,
    required this.ruleVersion,
    required this.mode,
    required this.timeframe,
    required this.horizonSessions,
  });

  final String ruleId;
  final int ruleVersion;
  final StrategyMode mode;
  final String timeframe;
  final int horizonSessions;

  factory CalibrationKey.fromRule(
    RuleVersion rule, {
    required int horizonSessions,
  }) => CalibrationKey(
    ruleId: rule.id,
    ruleVersion: rule.version,
    mode: rule.mode,
    timeframe: rule.timeframe,
    horizonSessions: horizonSessions,
  );

  @override
  bool operator ==(Object other) =>
      other is CalibrationKey &&
      other.ruleId == ruleId &&
      other.ruleVersion == ruleVersion &&
      other.mode == mode &&
      other.timeframe == timeframe &&
      other.horizonSessions == horizonSessions;

  @override
  int get hashCode => Object.hash(
    ruleId,
    ruleVersion,
    mode,
    timeframe,
    horizonSessions,
  );
}

class CalibrationEntry {
  const CalibrationEntry({
    required this.ruleId,
    required this.ruleVersion,
    required this.mode,
    required this.timeframe,
    required this.horizonSessions,
    required this.summary,
  });

  final String ruleId;
  final int ruleVersion;
  final StrategyMode mode;
  final String timeframe;
  final int horizonSessions;
  final DecisionCalibration summary;

  CalibrationKey get key => CalibrationKey(
    ruleId: ruleId,
    ruleVersion: ruleVersion,
    mode: mode,
    timeframe: timeframe,
    horizonSessions: horizonSessions,
  );
}

class CalibrationBook {
  CalibrationBook.fromEntries(Iterable<CalibrationEntry> entries)
    : _summaries = Map.unmodifiable({
        for (final entry in entries) entry.key: entry.summary,
      });

  final Map<CalibrationKey, DecisionCalibration> _summaries;

  List<CalibrationEntry> get entries => List.unmodifiable(
    _summaries.entries.map(
      (entry) => CalibrationEntry(
        ruleId: entry.key.ruleId,
        ruleVersion: entry.key.ruleVersion,
        mode: entry.key.mode,
        timeframe: entry.key.timeframe,
        horizonSessions: entry.key.horizonSessions,
        summary: entry.value,
      ),
    ),
  );

  DecisionCalibration? forRule(
    RuleVersion rule, {
    int horizonSessions = 2,
  }) => _summaries[CalibrationKey.fromRule(
    rule,
    horizonSessions: horizonSessions,
  )];
}

class CalibrationService {
  const CalibrationService._();

  static DecisionCalibration fromMetrics({
    required int sampleCount,
    required double hitRate,
    required double meanAbsoluteError,
    required double meanSlippage,
    required double maximumDrawdown,
    int minimumSampleCount = 10,
    Map<String, int> invalidationReasons = const {},
  }) {
    if (sampleCount < 0) {
      throw ArgumentError.value(sampleCount, 'sampleCount', '不能为负数');
    }
    if (minimumSampleCount <= 0) {
      throw ArgumentError.value(
        minimumSampleCount,
        'minimumSampleCount',
        '必须大于零',
      );
    }
    final boundedHitRate = hitRate.clamp(0.0, 1.0).toDouble();
    final boundedError = meanAbsoluteError.clamp(0.0, 1.0).toDouble();
    final boundedSlippage = meanSlippage.clamp(0.0, 1.0).toDouble();
    final boundedDrawdown = maximumDrawdown.clamp(0.0, 1.0).toDouble();
    final calibrated = sampleCount >= minimumSampleCount;
    final confidence = calibrated
        ? (boundedHitRate * 0.7 +
                  (1 - boundedError) * 0.2 +
                  (1 - boundedSlippage) * 0.05 +
                  (1 - boundedDrawdown) * 0.05)
              .clamp(0.0, 1.0)
              .toDouble()
        : null;
    return DecisionCalibration(
      sampleCount: sampleCount,
      hitRate: boundedHitRate,
      meanAbsoluteError: boundedError,
      meanSlippage: boundedSlippage,
      maximumDrawdown: boundedDrawdown,
      calibrated: calibrated,
      confidence: confidence,
      invalidationReasons: invalidationReasons,
    );
  }

  static DecisionCalibration merge(
    Iterable<DecisionCalibration> summaries, {
    int minimumSampleCount = 10,
  }) {
    final values = summaries.toList(growable: false);
    if (values.isEmpty) {
      return fromMetrics(
        sampleCount: 0,
        hitRate: 0,
        meanAbsoluteError: 1,
        meanSlippage: 1,
        maximumDrawdown: 1,
        minimumSampleCount: minimumSampleCount,
      );
    }
    final total = values.fold<int>(
      0,
      (sum, summary) => sum + summary.sampleCount,
    );
    double weighted(double Function(DecisionCalibration) pick) {
      if (total == 0) return 0;
      return values.fold<double>(
            0,
            (sum, summary) => sum + pick(summary) * summary.sampleCount,
          ) /
          total;
    }
    final reasons = <String, int>{};
    for (final summary in values) {
      summary.invalidationReasons.forEach(
        (reason, count) => reasons[reason] = (reasons[reason] ?? 0) + count,
      );
    }
    return fromMetrics(
      sampleCount: total,
      hitRate: weighted((summary) => summary.hitRate),
      meanAbsoluteError: weighted((summary) => summary.meanAbsoluteError),
      meanSlippage: weighted((summary) => summary.meanSlippage),
      maximumDrawdown: values
          .map((summary) => summary.maximumDrawdown)
          .reduce((a, b) => a > b ? a : b),
      minimumSampleCount: minimumSampleCount,
      invalidationReasons: reasons,
    );
  }
}
