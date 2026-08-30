import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart' as testing;
import 'package:stockcal/features/analysis/strategy_explanation.dart';
import 'package:stockcal/features/decision/decision_models.dart';

void main() {
  test('remote adapter sends the deterministic decision and parses explanation', () async {
    final client = testing.MockClient((request) async {
      expect(request.url.path, '/api/v1/analysis/strategy-explanation');
      expect(request.headers['authorization'], 'Bearer token');
      final body = jsonDecode(request.body) as Map<String, Object?>;
      expect(body['decision'], 'WAIT');
      return http.Response(
        jsonEncode({
          'decision': 'WAIT',
          'summary': '等待条件补齐',
          'evidenceIds': ['freshness'],
          'risks': ['行情可能过期'],
          'unknowns': ['板块强弱'],
        }),
        200,
        headers: {'content-type': 'application/json'},
      );
    });

    final adapter = RemoteStrategyExplanationAdapter(
      baseUrl: Uri.parse('https://stockcal.test'),
      accessToken: () => 'token',
      client: client,
    );
    final result = await adapter.explain(
      DecisionResult(
        decision: DecisionAction.wait,
        reason: '必要条件不完整',
        missingFacts: const ['板块强弱'],
        generatedAt: DateTime(2026, 8, 30),
      ),
    );

    expect(result.decision, DecisionAction.wait);
    expect(result.summary, '等待条件补齐');
    expect(result.evidenceIds, ['freshness']);
  });
}
