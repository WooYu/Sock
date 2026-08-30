import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'review_ai.dart';
import 'review_service.dart';

class PersistentReviewStore
    implements ReviewRepository, ReviewNarrativeRepository, AiAuditLog {
  static const _reviewsKey = 'stockcal.reviews.v1';
  static const _narrativesKey = 'stockcal.review_narratives.v1';
  static const _auditKey = 'stockcal.ai_audit.v1';

  @override
  Future<void> saveTrade(TradeReview review) async {
    final current = await tradeReviews();
    if (current.any((item) => item.id == review.id)) return;
    await _write(_reviewsKey, [...current, review].map(_reviewToJson));
  }

  @override
  Future<List<TradeReview>> tradeReviews() async =>
      (await _read(_reviewsKey)).map(_reviewFromJson).toList(growable: false);

  @override
  Future<List<ReviewNarrative>> history(String reviewId) async =>
      (await _narratives())
          .where((item) => item.sourceReviewId == reviewId)
          .toList(growable: false);

  @override
  Future<void> append(ReviewNarrative narrative) async {
    final all = await _narratives();
    final current = all.where(
      (item) => item.sourceReviewId == narrative.sourceReviewId,
    );
    if (narrative.version != current.length + 1) {
      throw StateError('复盘文案版本必须连续追加');
    }
    await _write(_narrativesKey, [...all, narrative].map(_narrativeToJson));
  }

  @override
  Future<void> add(AiAuditEvent event) async {
    final all = await auditEvents();
    await _write(_auditKey, [...all, event].map(_auditToJson));
  }

  Future<List<AiAuditEvent>> auditEvents() async =>
      (await _read(_auditKey)).map(_auditFromJson).toList(growable: false);

  Future<List<ReviewNarrative>> _narratives() async => (await _read(
    _narrativesKey,
  )).map(_narrativeFromJson).toList(growable: false);

  Future<List<Map<String, Object?>>> _read(String key) async {
    final value = (await SharedPreferences.getInstance()).getString(key);
    if (value == null) return [];
    return (jsonDecode(value) as List<Object?>).cast<Map<String, Object?>>();
  }

  Future<void> _write(String key, Iterable<Map<String, Object?>> values) async {
    await (await SharedPreferences.getInstance()).setString(
      key,
      jsonEncode(values.toList(growable: false)),
    );
  }

  Map<String, Object?> _reviewToJson(TradeReview item) => {
    'id': item.id,
    'ruleId': item.ruleId,
    'stockCode': item.stockCode,
    'tradeId': item.tradeId,
    'tradedAt': item.tradedAt.toIso8601String(),
    'plannedPrice': item.plannedPrice,
    'actualPrice': item.actualPrice,
    'actualClose': item.actualClose,
    'predictionVersion': item.predictionVersion,
    'predictedTarget': item.predictedTarget,
    'reason': item.reason,
    'invalidationReason': item.invalidationReason,
  };

  TradeReview _reviewFromJson(Map<String, Object?> json) => TradeReview(
    id: json['id']! as String,
    ruleId: json['ruleId'] as String?,
    stockCode: json['stockCode']! as String,
    tradeId: json['tradeId']! as String,
    tradedAt: DateTime.parse(json['tradedAt']! as String),
    plannedPrice: (json['plannedPrice']! as num).toDouble(),
    actualPrice: (json['actualPrice']! as num).toDouble(),
    actualClose: (json['actualClose']! as num).toDouble(),
    predictionVersion: json['predictionVersion']! as int,
    predictedTarget: (json['predictedTarget']! as num).toDouble(),
    reason: json['reason']! as String,
    invalidationReason: json['invalidationReason'] as String?,
  );

  Map<String, Object?> _narrativeToJson(ReviewNarrative item) => {
    'id': item.id,
    'sourceReviewId': item.sourceReviewId,
    'version': item.version,
    'text': item.text,
    'source': item.source.name,
    'createdAt': item.createdAt.toIso8601String(),
  };

  ReviewNarrative _narrativeFromJson(Map<String, Object?> json) =>
      ReviewNarrative(
        id: json['id']! as String,
        sourceReviewId: json['sourceReviewId']! as String,
        version: json['version']! as int,
        text: json['text']! as String,
        source: NarrativeSource.values.byName(json['source']! as String),
        createdAt: DateTime.parse(json['createdAt']! as String),
      );

  Map<String, Object?> _auditToJson(AiAuditEvent item) => {
    'reviewId': item.reviewId,
    'narrativeId': item.narrativeId,
    'action': item.action.name,
    'createdAt': item.createdAt.toIso8601String(),
  };

  AiAuditEvent _auditFromJson(Map<String, Object?> json) => AiAuditEvent(
    reviewId: json['reviewId']! as String,
    narrativeId: json['narrativeId']! as String,
    action: AiAuditAction.values.byName(json['action']! as String),
    createdAt: DateTime.parse(json['createdAt']! as String),
  );
}
