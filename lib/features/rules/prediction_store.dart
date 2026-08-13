import '../../domain/stockcal_domain.dart';
import 'rule_engine.dart';

class PredictionInputSnapshot {
  PredictionInputSnapshot({required List<Candle> candles})
    : candles = List.unmodifiable(
        candles.map(
          (item) => Candle(
            day: item.day,
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close,
            volume: item.volume,
          ),
        ),
      );

  final List<Candle> candles;
}

class MatchedRuleReference {
  const MatchedRuleReference({
    required this.ruleId,
    required this.version,
    required this.name,
  });

  final String ruleId;
  final int version;
  final String name;
}

class PredictionOutput {
  const PredictionOutput({
    required this.support,
    required this.resistance,
    required this.target,
    required this.confidence,
  });

  final double support;
  final double resistance;
  final double target;
  final double confidence;
}

class PredictionRecord {
  PredictionRecord({
    required this.id,
    required this.stockCode,
    required this.version,
    required this.generatedAt,
    required this.input,
    required List<MatchedRuleReference> matchedRules,
    required Map<String, double> evidence,
    required this.output,
  }) : matchedRules = List.unmodifiable(matchedRules),
       evidence = Map.unmodifiable(evidence);

  final String id;
  final String stockCode;
  final int version;
  final DateTime generatedAt;
  final PredictionInputSnapshot input;
  final List<MatchedRuleReference> matchedRules;
  final Map<String, double> evidence;
  final PredictionOutput output;
}

abstract interface class PredictionRepository {
  Future<List<PredictionRecord>> history(String stockCode);
  Future<void> append(PredictionRecord record);
}

class MemoryPredictionRepository implements PredictionRepository {
  final Map<String, List<PredictionRecord>> _history = {};

  @override
  Future<List<PredictionRecord>> history(String stockCode) async =>
      List.unmodifiable(_history[stockCode] ?? const []);

  @override
  Future<void> append(PredictionRecord record) async {
    final current = _history[record.stockCode] ?? const [];
    if (current.any((item) => item.id == record.id)) return;
    final expectedVersion = current.length + 1;
    if (record.version != expectedVersion) {
      throw StateError('预测版本必须连续追加');
    }
    _history[record.stockCode] = [...current, record];
  }
}

class PredictionService {
  PredictionService({
    required this.repository,
    required this.idFactory,
    DateTime Function()? clock,
  }) : _clock = clock ?? DateTime.now;

  final PredictionRepository repository;
  final String Function() idFactory;
  final DateTime Function() _clock;

  Future<PredictionRecord> generate({
    required String stockCode,
    required List<Candle> candles,
    required List<RuleVersion> matchedRules,
  }) async {
    if (candles.length < 5) {
      throw ArgumentError('预测至少需要五根 K 线');
    }
    final input = PredictionInputSnapshot(candles: candles);
    final recent = input.candles.skip(input.candles.length - 5).toList();
    final support = recent.map((item) => item.low).reduce(_min);
    final resistance = recent.map((item) => item.high).reduce(_max);
    final range = resistance - support;
    final lastClose = input.candles.last.close;
    final history = await repository.history(stockCode);
    final record = PredictionRecord(
      id: idFactory(),
      stockCode: stockCode,
      version: history.length + 1,
      generatedAt: _clock(),
      input: input,
      matchedRules: matchedRules
          .map(
            (rule) => MatchedRuleReference(
              ruleId: rule.id,
              version: rule.version,
              name: rule.name,
            ),
          )
          .toList(),
      evidence: {
        'support': support,
        'resistance': resistance,
        'range': range,
        'lastClose': lastClose,
      },
      output: PredictionOutput(
        support: support,
        resistance: resistance,
        target: resistance + range * 0.382 + (lastClose - support) * 0.05,
        confidence: (0.55 + matchedRules.length * 0.08).clamp(0.55, 0.91),
      ),
    );
    await repository.append(record);
    return record;
  }

  static double _min(double a, double b) => a < b ? a : b;
  static double _max(double a, double b) => a > b ? a : b;
}
