import 'dart:convert';

import 'package:http/http.dart' as http;

import '../decision/decision_models.dart';

class StrategyExplanation {
  const StrategyExplanation({
    required this.decision,
    required this.summary,
    required this.evidenceIds,
    required this.risks,
    required this.unknowns,
  });

  final DecisionAction decision;
  final String summary;
  final List<String> evidenceIds;
  final List<String> risks;
  final List<String> unknowns;

  factory StrategyExplanation.fromJson(Map<String, Object?> json) =>
      StrategyExplanation(
        decision: _parseAction(json['decision'] as String?),
        summary: json['summary'] as String? ?? '',
        evidenceIds: _stringList(json['evidenceIds']),
        risks: _stringList(json['risks']),
        unknowns: _stringList(json['unknowns']),
      );

  static DecisionAction _parseAction(String? value) {
    final normalized = value?.toLowerCase();
    return DecisionAction.values.firstWhere(
      (action) => action.name == normalized,
      orElse: () => DecisionAction.wait,
    );
  }

  static List<String> _stringList(Object? value) {
    if (value is! List) return const [];
    return value.whereType<String>().toList(growable: false);
  }
}

abstract interface class StrategyExplanationAdapter {
  Future<StrategyExplanation> explain(DecisionResult decision);
}

class RemoteStrategyExplanationAdapter implements StrategyExplanationAdapter {
  RemoteStrategyExplanationAdapter({
    required this.baseUrl,
    required this.accessToken,
    http.Client? client,
  }) : _client = client ?? http.Client();

  final Uri baseUrl;
  final String? Function() accessToken;
  final http.Client _client;

  @override
  Future<StrategyExplanation> explain(DecisionResult decision) async {
    final token = accessToken();
    if (token == null || token.isEmpty) {
      throw StateError('请先登录后生成 AI 策略解释');
    }
    final response = await _client.post(
      baseUrl.resolve('/api/v1/analysis/strategy-explanation'),
      headers: {
        'authorization': 'Bearer $token',
        'content-type': 'application/json',
      },
      body: jsonEncode(_payload(decision)),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError('AI 策略解释暂不可用 (${response.statusCode})');
    }
    final json = jsonDecode(response.body);
    if (json is! Map) throw StateError('AI 策略解释格式无效');
    return StrategyExplanation.fromJson(
      Map<String, Object?>.from(json),
    );
  }

  Map<String, Object?> _payload(DecisionResult decision) {
    final evidence = <String, Map<String, Object?>>{};
    for (final rule in decision.matchedRules) {
      for (final item in rule.evidence) {
        evidence[item.id] = {
          'id': item.id,
          'label': item.label,
          'detail': item.detail,
        };
      }
    }
    final calibration = decision.calibration;
    return {
      'decision': decision.decision.name.toUpperCase(),
      'primaryMode': decision.primaryMode?.name,
      'reason': decision.reason,
      'matchedRules': decision.matchedRules.map((rule) => rule.name).toList(),
      'missingFacts': decision.missingFacts,
      'conflicts': decision.conflicts,
      'invalidationConditions': decision.invalidationConditions,
      'snapshot': {
        'support': decision.support,
        'resistance': decision.resistance,
        'target': decision.target,
        'generatedAt': decision.generatedAt.toUtc().toIso8601String(),
      },
      'evidence': evidence.values.toList(growable: false),
      if (calibration != null)
        'calibration': {
          'sampleCount': calibration.sampleCount,
          'hitRate': calibration.hitRate,
          'meanAbsoluteError': calibration.meanAbsoluteError,
          'meanSlippage': calibration.meanSlippage,
          'maximumDrawdown': calibration.maximumDrawdown,
          'calibrated': calibration.calibrated,
          'confidence': calibration.confidence,
        },
    };
  }
}
