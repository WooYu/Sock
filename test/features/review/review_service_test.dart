import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/decision/decision_models.dart';
import 'package:stockcal/features/review/review_service.dart';

void main() {
  group('ReviewService', () {
    late MemoryReviewRepository repository;
    late ReviewService service;

    setUp(() {
      repository = MemoryReviewRepository();
      service = ReviewService(
        repository: repository,
        idFactory: () => 'review-1',
      );
    });

    test(
      'creates a trade review with plan, execution, prediction, and reason',
      () async {
        final review = await service.createTradeReview(
          stockCode: '600519',
          tradeId: 'trade-1',
          tradedAt: DateTime(2026, 8, 14, 10),
          plannedPrice: 1700,
          actualPrice: 1715,
          actualClose: 1730,
          predictionVersion: 2,
          predictedTarget: 1750,
          reason: '突破后回踩确认',
          invalidationReason: null,
        );

        expect(review.slippagePercent, closeTo(15 / 1700, 0.000001));
        expect(review.predictionErrorPercent, closeTo(20 / 1730, 0.000001));
        expect(await repository.tradeReviews(), [review]);
      },
    );

    test(
      'daily and weekly summaries aggregate failures without changing trades',
      () async {
        await repository.saveTrade(_review('r1', DateTime(2026, 8, 10), '追高'));
        await repository.saveTrade(_review('r2', DateTime(2026, 8, 10), '追高'));
        await repository.saveTrade(
          _review('r3', DateTime(2026, 8, 12), '量能不足'),
        );

        final daily = await service.daily(DateTime(2026, 8, 10));
        final weekly = await service.weekly(DateTime(2026, 8, 10));

        expect(daily.tradeCount, 2);
        expect(daily.invalidationReasons, {'追高': 2});
        expect(weekly.tradeCount, 3);
        expect(weekly.invalidationReasons, {'追高': 2, '量能不足': 1});
        expect(await repository.tradeReviews(), hasLength(3));
      },
    );

    test('calibrates a rule from review history', () async {
      await repository.saveTrade(_review(
        'r4',
        DateTime(2026, 8, 14),
        '趋势延续',
        ruleId: 'trend',
      ));
      await repository.saveTrade(_review(
        'r5',
        DateTime(2026, 8, 15),
        '趋势延续',
        ruleId: 'trend',
      ));

      final entry = await service.calibrationForRule(
        ruleId: 'trend',
        ruleVersion: 1,
        mode: StrategyMode.baseGranville,
        timeframe: '日线',
        minimumSampleCount: 2,
      );

      expect(entry.key.ruleId, 'trend');
      expect(entry.summary.sampleCount, 2);
      expect(entry.summary.calibrated, isTrue);
    });
  });
}

TradeReview _review(String id, DateTime day, String failure, {String? ruleId}) => TradeReview(
  id: id,
  ruleId: ruleId,
  stockCode: '600519',
  tradeId: 'trade-$id',
  tradedAt: day,
  plannedPrice: 100,
  actualPrice: 101,
  actualClose: 102,
  predictionVersion: 1,
  predictedTarget: 103,
  reason: '测试',
  invalidationReason: failure,
);
