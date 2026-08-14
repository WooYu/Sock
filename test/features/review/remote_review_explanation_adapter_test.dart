import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:stockcal/features/review/remote_review_explanation_adapter.dart';
import 'package:stockcal/features/review/review_ai.dart';

void main() {
  test(
    'sends only the deterministic snapshot with bearer authorization',
    () async {
      late http.Request sent;
      final adapter = RemoteReviewExplanationAdapter(
        baseUrl: Uri.parse('https://api.stockcal.test'),
        accessToken: () => 'token-1',
        client: MockClient((request) async {
          sent = request;
          return http.Response(
            '{"text":"严格执行计划，关注失效条件。"}',
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
          );
        }),
      );
      final snapshot = ReviewSnapshot(
        reviewId: 'r1',
        stockCode: '600519',
        tradedAt: DateTime.utc(2026, 8, 14),
        plannedPrice: 1700,
        actualPrice: 1715,
        actualClose: 1730,
        predictionVersion: 2,
        predictedTarget: 1750,
        reason: '突破回踩',
        invalidationReason: '量能不足',
      );

      final text = await adapter.explain(snapshot);

      expect(sent.url.path, '/api/v1/reviews/explain');
      expect(sent.headers['authorization'], 'Bearer token-1');
      final body = jsonDecode(sent.body) as Map<String, Object?>;
      expect(body['reviewId'], 'r1');
      expect(body['plannedPrice'], 1700);
      expect(body.containsKey('marketPrice'), isFalse);
      expect(text, '严格执行计划，关注失效条件。');
    },
  );
}
