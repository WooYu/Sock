import 'dart:convert';

import 'package:http/http.dart' as http;

import 'review_ai.dart';

class RemoteReviewExplanationAdapter implements ReviewExplanationAdapter {
  RemoteReviewExplanationAdapter({
    required this.baseUrl,
    required this.accessToken,
    http.Client? client,
  }) : _client = client ?? http.Client();

  final Uri baseUrl;
  final String? Function() accessToken;
  final http.Client _client;

  @override
  Future<String> explain(ReviewSnapshot snapshot) async {
    final token = accessToken();
    if (token == null || token.isEmpty) throw StateError('请先登录后生成 AI 复盘');
    final response = await _client.post(
      baseUrl.resolve('/api/v1/reviews/explain'),
      headers: {
        'authorization': 'Bearer $token',
        'content-type': 'application/json',
      },
      body: jsonEncode({
        'reviewId': snapshot.reviewId,
        'stockCode': snapshot.stockCode,
        'tradedAt': snapshot.tradedAt.toUtc().toIso8601String(),
        'plannedPrice': snapshot.plannedPrice,
        'actualPrice': snapshot.actualPrice,
        'actualClose': snapshot.actualClose,
        'predictionVersion': snapshot.predictionVersion,
        'predictedTarget': snapshot.predictedTarget,
        'reason': snapshot.reason,
        'invalidationReason': snapshot.invalidationReason,
      }),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError('AI 复盘服务暂不可用 (${response.statusCode})');
    }
    final body = jsonDecode(response.body) as Map<String, Object?>;
    return body['text']! as String;
  }
}
