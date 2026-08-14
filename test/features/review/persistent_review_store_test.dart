import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockcal/features/review/persistent_review_store.dart';
import 'package:stockcal/features/review/review_ai.dart';
import 'package:stockcal/features/review/review_service.dart';

void main() {
  test('review facts narratives and audit events survive recreation', () async {
    SharedPreferences.setMockInitialValues({});
    final time = DateTime.utc(2026, 8, 14);
    final first = PersistentReviewStore();
    await first.saveTrade(
      TradeReview(
        id: 'r1',
        stockCode: '600519',
        tradeId: 't1',
        tradedAt: time,
        plannedPrice: 1700,
        actualPrice: 1710,
        actualClose: 1720,
        predictionVersion: 2,
        predictedTarget: 1750,
        reason: '突破',
        invalidationReason: '量能不足',
      ),
    );
    await first.append(
      ReviewNarrative(
        id: 'n1',
        sourceReviewId: 'r1',
        version: 1,
        text: '复盘摘要',
        source: NarrativeSource.ai,
        createdAt: time,
      ),
    );
    await first.add(
      AiAuditEvent(
        reviewId: 'r1',
        narrativeId: 'n1',
        action: AiAuditAction.generate,
        createdAt: time,
      ),
    );

    final restored = PersistentReviewStore();
    expect((await restored.tradeReviews()).single.reason, '突破');
    expect((await restored.history('r1')).single.text, '复盘摘要');
    expect(
      (await restored.auditEvents()).single.action,
      AiAuditAction.generate,
    );
  });
}
