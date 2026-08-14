import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../../domain/stockcal_domain.dart';
import 'prediction_store.dart';

class PersistentPredictionRepository implements PredictionRepository {
  static const _key = 'stockcal.predictions.v1';

  @override
  Future<List<PredictionRecord>> history(String stockCode) async {
    return (await _all())
        .where((record) => record.stockCode == stockCode)
        .toList(growable: false);
  }

  @override
  Future<void> append(PredictionRecord record) async {
    final all = await _all();
    if (all.any((item) => item.id == record.id)) return;
    final current = all.where((item) => item.stockCode == record.stockCode);
    if (record.version != current.length + 1) {
      throw StateError('预测版本必须连续追加');
    }
    await (await SharedPreferences.getInstance()).setString(
      _key,
      jsonEncode([...all, record].map(_toJson).toList(growable: false)),
    );
  }

  Future<List<PredictionRecord>> _all() async {
    final value = (await SharedPreferences.getInstance()).getString(_key);
    if (value == null) return [];
    return (jsonDecode(value) as List<Object?>)
        .map((item) => _fromJson(item! as Map<String, Object?>))
        .toList(growable: false);
  }

  Map<String, Object?> _toJson(PredictionRecord record) => {
    'id': record.id,
    'stockCode': record.stockCode,
    'version': record.version,
    'generatedAt': record.generatedAt.toIso8601String(),
    'input': [
      for (final candle in record.input.candles)
        {
          'day': candle.day.toIso8601String(),
          'open': candle.open,
          'high': candle.high,
          'low': candle.low,
          'close': candle.close,
          'volume': candle.volume,
        },
    ],
    'matchedRules': [
      for (final rule in record.matchedRules)
        {'ruleId': rule.ruleId, 'version': rule.version, 'name': rule.name},
    ],
    'evidence': record.evidence,
    'output': {
      'support': record.output.support,
      'resistance': record.output.resistance,
      'target': record.output.target,
      'confidence': record.output.confidence,
    },
  };

  PredictionRecord _fromJson(Map<String, Object?> json) {
    final output = json['output']! as Map<String, Object?>;
    return PredictionRecord(
      id: json['id']! as String,
      stockCode: json['stockCode']! as String,
      version: json['version']! as int,
      generatedAt: DateTime.parse(json['generatedAt']! as String),
      input: PredictionInputSnapshot(
        candles: (json['input']! as List<Object?>)
            .map((item) {
              final candle = item! as Map<String, Object?>;
              return Candle(
                day: DateTime.parse(candle['day']! as String),
                open: (candle['open']! as num).toDouble(),
                high: (candle['high']! as num).toDouble(),
                low: (candle['low']! as num).toDouble(),
                close: (candle['close']! as num).toDouble(),
                volume: candle['volume']! as int,
              );
            })
            .toList(growable: false),
      ),
      matchedRules: (json['matchedRules']! as List<Object?>)
          .map((item) {
            final rule = item! as Map<String, Object?>;
            return MatchedRuleReference(
              ruleId: rule['ruleId']! as String,
              version: rule['version']! as int,
              name: rule['name']! as String,
            );
          })
          .toList(growable: false),
      evidence: (json['evidence']! as Map<String, Object?>).map(
        (key, value) => MapEntry(key, (value! as num).toDouble()),
      ),
      output: PredictionOutput(
        support: (output['support']! as num).toDouble(),
        resistance: (output['resistance']! as num).toDouble(),
        target: (output['target']! as num).toDouble(),
        confidence: (output['confidence']! as num).toDouble(),
      ),
    );
  }
}
