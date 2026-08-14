import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockcal/features/market/market_data.dart';
import 'package:stockcal/features/rules/persistent_prediction_repository.dart';
import 'package:stockcal/features/rules/prediction_store.dart';
import 'package:stockcal/features/rules/rule_engine.dart';

void main() {
  test(
    'immutable prediction snapshot and versions survive recreation',
    () async {
      SharedPreferences.setMockInitialValues({});
      var sequence = 0;
      final repository = PersistentPredictionRepository();
      final service = PredictionService(
        repository: repository,
        idFactory: () => 'p-${++sequence}',
        clock: () => DateTime.utc(2026, 8, 14),
      );
      await service.generate(
        stockCode: '600519',
        candles: DemoAshareData.candlesFor('600519'),
        matchedRules: RuleBook.withSystemDefaults().activeRules,
      );

      final restored = await PersistentPredictionRepository().history('600519');
      expect(restored.single.version, 1);
      expect(restored.single.input.candles, hasLength(40));
      expect(restored.single.matchedRules, hasLength(2));
      expect(restored.single.evidence, contains('support'));
      expect(restored.single.output.target, greaterThan(0));
    },
  );
}
