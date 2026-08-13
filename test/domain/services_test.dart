import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/domain/stockcal_services.dart';

void main() {
  test('sync queue retries failed local-first operations', () {
    final queue = SyncQueue();

    queue.enqueue(SyncOperation('watchlist', {'code': '600519'}));
    queue.markFailed('watchlist');
    queue.retryFailed();

    expect(queue.pendingCount, 1);
    expect(queue.failedCount, 0);
    expect(queue.snapshot.first.status, SyncStatus.pending);
  });

  test('market adapter returns delayed quotes with source state', () {
    final adapter = DemoMarketAdapter();

    final quote = adapter.quote('600519');

    expect(quote.code, '600519');
    expect(quote.delayMinutes, 15);
    expect(quote.sourceName, 'Demo A-share adapter');
    expect(quote.isRealtime, isFalse);
  });

  test(
    'review assistant summarizes deterministic results without changing prices',
    () {
      final summary = ReviewAssistant().summarize(
        symbol: '600519',
        support: 1696,
        resistance: 1758,
        actualClose: 1742,
      );

      expect(summary, contains('600519'));
      expect(summary, contains('1696'));
      expect(summary, contains('1758'));
      expect(summary, contains('不修改任何价格'));
    },
  );
}
