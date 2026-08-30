import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/decision/calibration.dart';
import 'package:stockcal/features/decision/decision_models.dart';
import 'package:stockcal/features/rules/rule_engine.dart';

void main() {
  final rule = RuleVersion(
    id: 'trend',
    version: 2,
    name: '趋势确认',
    priority: 10,
    enabled: true,
    system: false,
    conditions: const [],
    publishedAt: DateTime(2026, 8, 30),
    mode: StrategyMode.baseGranville,
    timeframe: '日线',
  );

  test('calibration keeps confidence unavailable below the sample floor', () {
    final summary = CalibrationService.fromMetrics(
      sampleCount: 4,
      hitRate: 0.75,
      meanAbsoluteError: 0.08,
      meanSlippage: 0.01,
      maximumDrawdown: 0.12,
    );

    expect(summary.calibrated, isFalse);
    expect(summary.confidence, isNull);
    expect(summary.hitRate, 0.75);
  });

  test('calibration derives confidence after enough historical samples', () {
    final summary = CalibrationService.fromMetrics(
      sampleCount: 20,
      hitRate: 0.65,
      meanAbsoluteError: 0.04,
      meanSlippage: 0.01,
      maximumDrawdown: 0.12,
    );

    expect(summary.calibrated, isTrue);
    expect(summary.confidence, inInclusiveRange(0, 1));
  });

  test('calibration book matches the exact rule version and mode', () {
    final book = CalibrationBook.fromEntries([
      CalibrationEntry(
        ruleId: rule.id,
        ruleVersion: rule.version,
        mode: rule.mode,
        timeframe: rule.timeframe,
        horizonSessions: 3,
        summary: CalibrationService.fromMetrics(
          sampleCount: 12,
          hitRate: 0.8,
          meanAbsoluteError: 0.03,
          meanSlippage: 0.01,
          maximumDrawdown: 0.05,
        ),
      ),
    ]);

    expect(
      book.forRule(rule, horizonSessions: 3)?.hitRate,
      0.8,
    );
    expect(book.forRule(rule, horizonSessions: 2), isNull);
  });
}
