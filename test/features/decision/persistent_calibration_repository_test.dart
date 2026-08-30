import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockcal/features/decision/calibration.dart';
import 'package:stockcal/features/decision/decision_models.dart';
import 'package:stockcal/features/decision/persistent_calibration_repository.dart';

void main() {
  test('persists calibration keyed by rule version and horizon', () async {
    SharedPreferences.setMockInitialValues({});
    final book = CalibrationBook.fromEntries([
      CalibrationEntry(
        ruleId: 'rule-1',
        ruleVersion: 2,
        mode: StrategyMode.rebound,
        timeframe: '日线',
        horizonSessions: 3,
        summary: DecisionCalibration(
          sampleCount: 12,
          hitRate: 0.75,
          meanAbsoluteError: 0.04,
          meanSlippage: 0.01,
          maximumDrawdown: 0.12,
          calibrated: true,
          confidence: 0.79,
          invalidationReasons: const {'跌破 MA5': 2},
        ),
      ),
    ]);

    final repository = PersistentCalibrationRepository();
    await repository.save(book);
    final restored = await repository.load();

    final summary = restored.entries.single.summary;
    expect(restored.entries.single.ruleVersion, 2);
    expect(restored.entries.single.horizonSessions, 3);
    expect(restored.entries.single.mode, StrategyMode.rebound);
    expect(summary.sampleCount, 12);
    expect(summary.confidence, 0.79);
    expect(summary.invalidationReasons['跌破 MA5'], 2);
  });
}
