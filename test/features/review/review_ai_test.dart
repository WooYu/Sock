import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/review/review_ai.dart';
import 'package:stockcal/features/review/review_service.dart';

void main() {
  group('ReviewAiService', () {
    late RecordingExplanationAdapter adapter;
    late MemoryReviewNarrativeRepository repository;
    late MemoryAiAuditLog audit;
    late ReviewAiService service;

    setUp(() {
      adapter = RecordingExplanationAdapter();
      repository = MemoryReviewNarrativeRepository();
      audit = MemoryAiAuditLog();
      service = ReviewAiService(
        adapter: adapter,
        repository: repository,
        audit: audit,
        idFactory: _Ids(['n1', 'n2']).next,
        clock: () => DateTime(2026, 8, 14, 16),
      );
    });

    test('AI receives only a deterministic read-only snapshot', () async {
      final review = _review();

      final narrative = await service.generate(review);

      expect(adapter.lastSnapshot!.stockCode, '600519');
      expect(adapter.lastSnapshot!.plannedPrice, 1700);
      expect(adapter.lastSnapshot!.actualPrice, 1715);
      expect(adapter.lastSnapshot!.predictionVersion, 2);
      expect(narrative.text, contains('计划价'));
      expect(narrative.sourceReviewId, review.id);
      expect(audit.events.single.action, AiAuditAction.generate);
    });

    test(
      'regenerate appends a new narrative and preserves prior text',
      () async {
        final first = await service.generate(_review());
        adapter.responsePrefix = '新版';
        final second = await service.regenerate(_review());

        expect(first.version, 1);
        expect(second.version, 2);
        expect(await repository.history(_review().id), [first, second]);
        expect(audit.events.map((item) => item.action), [
          AiAuditAction.generate,
          AiAuditAction.regenerate,
        ]);
      },
    );

    test('user edit creates a new version without calling AI', () async {
      await service.generate(_review());
      final edited = await service.edit(_review().id, '我自己的复盘结论');

      expect(edited.version, 2);
      expect(edited.text, '我自己的复盘结论');
      expect(adapter.callCount, 1);
      expect(audit.events.last.action, AiAuditAction.userEdit);
    });
  });
}

TradeReview _review() => TradeReview(
  id: 'review-1',
  stockCode: '600519',
  tradeId: 'trade-1',
  tradedAt: DateTime(2026, 8, 14),
  plannedPrice: 1700,
  actualPrice: 1715,
  actualClose: 1730,
  predictionVersion: 2,
  predictedTarget: 1750,
  reason: '突破回踩',
  invalidationReason: null,
);

class RecordingExplanationAdapter implements ReviewExplanationAdapter {
  ReviewSnapshot? lastSnapshot;
  int callCount = 0;
  String responsePrefix = '复盘';

  @override
  Future<String> explain(ReviewSnapshot snapshot) async {
    lastSnapshot = snapshot;
    callCount++;
    return '$responsePrefix：计划价 ${snapshot.plannedPrice}，实际成交 ${snapshot.actualPrice}。';
  }
}

class _Ids {
  _Ids(this.values);
  final List<String> values;
  int index = 0;
  String next() => values[index++];
}
