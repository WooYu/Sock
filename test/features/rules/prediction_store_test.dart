import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/domain/stockcal_domain.dart';
import 'package:stockcal/features/rules/prediction_store.dart';
import 'package:stockcal/features/rules/rule_engine.dart';

void main() {
  group('PredictionService', () {
    late MemoryPredictionRepository repository;
    late PredictionService service;
    late RuleVersion rule;

    setUp(() {
      repository = MemoryPredictionRepository();
      service = PredictionService(
        repository: repository,
        idFactory: _Ids(['prediction-1', 'prediction-2']).next,
        clock: () => DateTime(2026, 8, 14, 15),
      );
      rule = RuleBook.withSystemDefaults().activeRules.first;
    });

    test('saves immutable input, rule version, evidence, and output', () async {
      final candles = _candles();

      final prediction = await service.generate(
        stockCode: '600519',
        candles: candles,
        matchedRules: [rule],
      );
      candles.clear();

      expect(prediction.version, 1);
      expect(prediction.input.candles, hasLength(20));
      expect(prediction.matchedRules.single.ruleId, rule.id);
      expect(prediction.matchedRules.single.version, rule.version);
      expect(
        prediction.evidence.keys,
        containsAll(['support', 'resistance', 'range', 'lastClose']),
      );
      expect(
        prediction.output.target,
        greaterThan(prediction.output.resistance),
      );
      expect(await repository.history('600519'), [prediction]);
    });

    test(
      'regeneration appends a new version without replacing history',
      () async {
        final first = await service.generate(
          stockCode: '600519',
          candles: _candles(),
          matchedRules: [rule],
        );
        final second = await service.generate(
          stockCode: '600519',
          candles: _candles(closeOffset: 5),
          matchedRules: [rule],
        );

        expect(first.version, 1);
        expect(second.version, 2);
        expect(first.output.target, isNot(second.output.target));
        expect(await repository.history('600519'), [first, second]);
      },
    );

    test(
      'rejects insufficient input instead of writing partial evidence',
      () async {
        await expectLater(
          service.generate(
            stockCode: '600519',
            candles: _candles().take(4).toList(),
            matchedRules: [rule],
          ),
          throwsArgumentError,
        );
        expect(await repository.history('600519'), isEmpty);
      },
    );
  });
}

List<Candle> _candles({double closeOffset = 0}) => List.generate(20, (index) {
  final close = 100 + index + closeOffset;
  return Candle(
    day: DateTime(2026, 7, 1).add(Duration(days: index)),
    open: close - 1,
    high: close + 2,
    low: close - 2,
    close: close,
    volume: 1000 + index * 10,
  );
});

class _Ids {
  _Ids(this.values);
  final List<String> values;
  int index = 0;
  String next() => values[index++];
}
