import 'review_service.dart';

class ReviewSnapshot {
  const ReviewSnapshot({
    required this.reviewId,
    required this.stockCode,
    required this.tradedAt,
    required this.plannedPrice,
    required this.actualPrice,
    required this.actualClose,
    required this.predictionVersion,
    required this.predictedTarget,
    required this.reason,
    required this.invalidationReason,
  });

  factory ReviewSnapshot.fromReview(TradeReview review) => ReviewSnapshot(
    reviewId: review.id,
    stockCode: review.stockCode,
    tradedAt: review.tradedAt,
    plannedPrice: review.plannedPrice,
    actualPrice: review.actualPrice,
    actualClose: review.actualClose,
    predictionVersion: review.predictionVersion,
    predictedTarget: review.predictedTarget,
    reason: review.reason,
    invalidationReason: review.invalidationReason,
  );

  final String reviewId;
  final String stockCode;
  final DateTime tradedAt;
  final double plannedPrice;
  final double actualPrice;
  final double actualClose;
  final int predictionVersion;
  final double predictedTarget;
  final String reason;
  final String? invalidationReason;
}

abstract interface class ReviewExplanationAdapter {
  Future<String> explain(ReviewSnapshot snapshot);
}

enum NarrativeSource { ai, user }

class ReviewNarrative {
  const ReviewNarrative({
    required this.id,
    required this.sourceReviewId,
    required this.version,
    required this.text,
    required this.source,
    required this.createdAt,
  });

  final String id;
  final String sourceReviewId;
  final int version;
  final String text;
  final NarrativeSource source;
  final DateTime createdAt;
}

abstract interface class ReviewNarrativeRepository {
  Future<List<ReviewNarrative>> history(String reviewId);
  Future<void> append(ReviewNarrative narrative);
}

class MemoryReviewNarrativeRepository implements ReviewNarrativeRepository {
  final Map<String, List<ReviewNarrative>> _history = {};

  @override
  Future<List<ReviewNarrative>> history(String reviewId) async =>
      List.unmodifiable(_history[reviewId] ?? const []);

  @override
  Future<void> append(ReviewNarrative narrative) async {
    final current = _history[narrative.sourceReviewId] ?? const [];
    if (narrative.version != current.length + 1) {
      throw StateError('复盘文案版本必须连续追加');
    }
    _history[narrative.sourceReviewId] = [...current, narrative];
  }
}

enum AiAuditAction { generate, regenerate, userEdit }

class AiAuditEvent {
  const AiAuditEvent({
    required this.reviewId,
    required this.narrativeId,
    required this.action,
    required this.createdAt,
  });

  final String reviewId;
  final String narrativeId;
  final AiAuditAction action;
  final DateTime createdAt;
}

abstract interface class AiAuditLog {
  Future<void> add(AiAuditEvent event);
}

class MemoryAiAuditLog implements AiAuditLog {
  final List<AiAuditEvent> _events = [];
  List<AiAuditEvent> get events => List.unmodifiable(_events);

  @override
  Future<void> add(AiAuditEvent event) async => _events.add(event);
}

class ReviewAiService {
  ReviewAiService({
    required this.adapter,
    required this.repository,
    required this.audit,
    required this.idFactory,
    DateTime Function()? clock,
  }) : _clock = clock ?? DateTime.now;

  final ReviewExplanationAdapter adapter;
  final ReviewNarrativeRepository repository;
  final AiAuditLog audit;
  final String Function() idFactory;
  final DateTime Function() _clock;

  Future<ReviewNarrative> generate(TradeReview review) =>
      _generate(review, AiAuditAction.generate);

  Future<ReviewNarrative> regenerate(TradeReview review) =>
      _generate(review, AiAuditAction.regenerate);

  Future<ReviewNarrative> edit(String reviewId, String text) async {
    if (text.trim().isEmpty) throw ArgumentError('复盘文字不能为空');
    final history = await repository.history(reviewId);
    final narrative = ReviewNarrative(
      id: idFactory(),
      sourceReviewId: reviewId,
      version: history.length + 1,
      text: text.trim(),
      source: NarrativeSource.user,
      createdAt: _clock(),
    );
    await _append(narrative, AiAuditAction.userEdit);
    return narrative;
  }

  Future<ReviewNarrative> _generate(
    TradeReview review,
    AiAuditAction action,
  ) async {
    final snapshot = ReviewSnapshot.fromReview(review);
    final text = await adapter.explain(snapshot);
    final history = await repository.history(review.id);
    final narrative = ReviewNarrative(
      id: idFactory(),
      sourceReviewId: review.id,
      version: history.length + 1,
      text: text,
      source: NarrativeSource.ai,
      createdAt: _clock(),
    );
    await _append(narrative, action);
    return narrative;
  }

  Future<void> _append(ReviewNarrative narrative, AiAuditAction action) async {
    await repository.append(narrative);
    await audit.add(
      AiAuditEvent(
        reviewId: narrative.sourceReviewId,
        narrativeId: narrative.id,
        action: action,
        createdAt: narrative.createdAt,
      ),
    );
  }
}
