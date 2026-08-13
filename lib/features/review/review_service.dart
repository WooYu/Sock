class TradeReview {
  const TradeReview({
    required this.id,
    required this.stockCode,
    required this.tradeId,
    required this.tradedAt,
    required this.plannedPrice,
    required this.actualPrice,
    required this.actualClose,
    required this.predictionVersion,
    required this.predictedTarget,
    required this.reason,
    required this.invalidationReason,
  });

  final String id;
  final String stockCode;
  final String tradeId;
  final DateTime tradedAt;
  final double plannedPrice;
  final double actualPrice;
  final double actualClose;
  final int predictionVersion;
  final double predictedTarget;
  final String reason;
  final String? invalidationReason;

  double get slippagePercent =>
      plannedPrice == 0 ? 0 : (actualPrice - plannedPrice).abs() / plannedPrice;
  double get predictionErrorPercent => actualClose == 0
      ? 0
      : (predictedTarget - actualClose).abs() / actualClose;
}

class ReviewSummary {
  ReviewSummary({
    required this.from,
    required this.to,
    required this.tradeCount,
    required Map<String, int> invalidationReasons,
    required this.meanSlippage,
    required this.meanPredictionError,
  }) : invalidationReasons = Map.unmodifiable(invalidationReasons);

  final DateTime from;
  final DateTime to;
  final int tradeCount;
  final Map<String, int> invalidationReasons;
  final double meanSlippage;
  final double meanPredictionError;
}

abstract interface class ReviewRepository {
  Future<void> saveTrade(TradeReview review);
  Future<List<TradeReview>> tradeReviews();
}

class MemoryReviewRepository implements ReviewRepository {
  final List<TradeReview> _reviews = [];

  @override
  Future<void> saveTrade(TradeReview review) async {
    if (_reviews.any((item) => item.id == review.id)) return;
    _reviews.add(review);
  }

  @override
  Future<List<TradeReview>> tradeReviews() async => List.unmodifiable(_reviews);
}

class ReviewService {
  const ReviewService({required this.repository, required this.idFactory});

  final ReviewRepository repository;
  final String Function() idFactory;

  Future<TradeReview> createTradeReview({
    required String stockCode,
    required String tradeId,
    required DateTime tradedAt,
    required double plannedPrice,
    required double actualPrice,
    required double actualClose,
    required int predictionVersion,
    required double predictedTarget,
    required String reason,
    required String? invalidationReason,
  }) async {
    final review = TradeReview(
      id: idFactory(),
      stockCode: stockCode,
      tradeId: tradeId,
      tradedAt: tradedAt,
      plannedPrice: plannedPrice,
      actualPrice: actualPrice,
      actualClose: actualClose,
      predictionVersion: predictionVersion,
      predictedTarget: predictedTarget,
      reason: reason,
      invalidationReason: invalidationReason,
    );
    await repository.saveTrade(review);
    return review;
  }

  Future<ReviewSummary> daily(DateTime day) {
    final from = DateTime(day.year, day.month, day.day);
    return _summarize(from, from.add(const Duration(days: 1)));
  }

  Future<ReviewSummary> weekly(DateTime day) {
    final date = DateTime(day.year, day.month, day.day);
    final monday = date.subtract(
      Duration(days: date.weekday - DateTime.monday),
    );
    return _summarize(monday, monday.add(const Duration(days: 7)));
  }

  Future<ReviewSummary> _summarize(DateTime from, DateTime exclusiveTo) async {
    final reviews = (await repository.tradeReviews())
        .where(
          (item) =>
              !item.tradedAt.isBefore(from) &&
              item.tradedAt.isBefore(exclusiveTo),
        )
        .toList();
    final reasons = <String, int>{};
    for (final review in reviews) {
      final reason = review.invalidationReason;
      if (reason != null && reason.isNotEmpty) {
        reasons[reason] = (reasons[reason] ?? 0) + 1;
      }
    }
    final count = reviews.length;
    return ReviewSummary(
      from: from,
      to: exclusiveTo.subtract(const Duration(microseconds: 1)),
      tradeCount: count,
      invalidationReasons: reasons,
      meanSlippage: count == 0
          ? 0
          : reviews.fold<double>(0, (sum, item) => sum + item.slippagePercent) /
                count,
      meanPredictionError: count == 0
          ? 0
          : reviews.fold<double>(
                  0,
                  (sum, item) => sum + item.predictionErrorPercent,
                ) /
                count,
    );
  }
}
