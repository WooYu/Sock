import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'calibration.dart';
import 'decision_models.dart';

class PersistentCalibrationRepository {
  static const _key = 'stockcal.calibration.v1';

  Future<CalibrationBook> load() async {
    final raw = (await SharedPreferences.getInstance()).getString(_key);
    if (raw == null || raw.isEmpty) {
      return CalibrationBook.fromEntries(const []);
    }
    try {
      final values = (jsonDecode(raw) as List<Object?>)
          .whereType<Map>()
          .map((value) => _fromJson(value.cast<String, Object?>()))
          .whereType<CalibrationEntry>();
      return CalibrationBook.fromEntries(values);
    } on Object {
      return CalibrationBook.fromEntries(const []);
    }
  }

  Future<void> save(CalibrationBook book) async {
    await (await SharedPreferences.getInstance()).setString(
      _key,
      jsonEncode(book.entries.map(_toJson).toList(growable: false)),
    );
  }

  Map<String, Object?> _toJson(CalibrationEntry entry) => {
    'ruleId': entry.ruleId,
    'ruleVersion': entry.ruleVersion,
    'mode': entry.mode.name,
    'timeframe': entry.timeframe,
    'horizonSessions': entry.horizonSessions,
    'sampleCount': entry.summary.sampleCount,
    'hitRate': entry.summary.hitRate,
    'meanAbsoluteError': entry.summary.meanAbsoluteError,
    'meanSlippage': entry.summary.meanSlippage,
    'maximumDrawdown': entry.summary.maximumDrawdown,
    'calibrated': entry.summary.calibrated,
    'confidence': entry.summary.confidence,
    'invalidationReasons': entry.summary.invalidationReasons,
  };

  CalibrationEntry? _fromJson(Map<String, Object?> json) {
    try {
      final mode = _mode(json['mode']);
      final reasons = <String, int>{};
      final rawReasons = json['invalidationReasons'];
      if (rawReasons is Map) {
        for (final item in rawReasons.entries) {
          if (item.key is String && item.value is num) {
            reasons[item.key as String] = (item.value as num).toInt();
          }
        }
      }
      return CalibrationEntry(
        ruleId: json['ruleId']! as String,
        ruleVersion: (json['ruleVersion']! as num).toInt(),
        mode: mode,
        timeframe: json['timeframe']! as String,
        horizonSessions: (json['horizonSessions']! as num).toInt(),
        summary: DecisionCalibration(
          sampleCount: (json['sampleCount']! as num).toInt(),
          hitRate: (json['hitRate']! as num).toDouble(),
          meanAbsoluteError:
              (json['meanAbsoluteError']! as num).toDouble(),
          meanSlippage: (json['meanSlippage']! as num).toDouble(),
          maximumDrawdown: (json['maximumDrawdown']! as num).toDouble(),
          calibrated: json['calibrated'] as bool? ?? false,
          confidence: (json['confidence'] as num?)?.toDouble(),
          invalidationReasons: reasons,
        ),
      );
    } on Object {
      return null;
    }
  }

  StrategyMode _mode(Object? raw) =>
      StrategyMode.values.firstWhere(
        (mode) => mode.name == raw,
        orElse: () => StrategyMode.baseGranville,
      );
}
