import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/market/market_data.dart';

void main() {
  group('A-share catalog search', () {
    final catalog = MemoryStockCatalog(DemoAshareData.securities);

    test('matches code, Chinese name, full pinyin, and initials', () async {
      expect((await catalog.search('600519')).single.name, '贵州茅台');
      expect((await catalog.search('茅台')).single.code, '600519');
      expect((await catalog.search('guizhoumaotai')).single.code, '600519');
      expect((await catalog.search('gzmt')).single.code, '600519');
    });

    test('ranks exact code ahead of partial matches', () async {
      final results = await catalog.search('000001');

      expect(results.first.code, '000001');
      expect(results.first.name, '平安银行');
    });

    test('empty query returns a bounded discovery list', () async {
      final results = await catalog.search('', limit: 2);

      expect(results, hasLength(2));
    });
  });

  group('market source state', () {
    test('classifies realtime, delayed, stale, and offline cache quotes', () {
      final now = DateTime(2026, 8, 14, 10, 0);

      expect(
        MarketFreshness.evaluate(
          fetchedAt: now.subtract(const Duration(seconds: 20)),
          now: now,
          realtimeThreshold: const Duration(minutes: 1),
          staleThreshold: const Duration(minutes: 30),
          isOnline: true,
        ),
        MarketDataState.realtime,
      );
      expect(
        MarketFreshness.evaluate(
          fetchedAt: now.subtract(const Duration(minutes: 15)),
          now: now,
          realtimeThreshold: const Duration(minutes: 1),
          staleThreshold: const Duration(minutes: 30),
          isOnline: true,
        ),
        MarketDataState.delayed,
      );
      expect(
        MarketFreshness.evaluate(
          fetchedAt: now.subtract(const Duration(hours: 2)),
          now: now,
          realtimeThreshold: const Duration(minutes: 1),
          staleThreshold: const Duration(minutes: 30),
          isOnline: true,
        ),
        MarketDataState.stale,
      );
      expect(
        MarketFreshness.evaluate(
          fetchedAt: now,
          now: now,
          realtimeThreshold: const Duration(minutes: 1),
          staleThreshold: const Duration(minutes: 30),
          isOnline: false,
        ),
        MarketDataState.offlineCache,
      );
    });
  });

  test(
    'adapter returns quote limits and chronological daily candles',
    () async {
      final adapter = DemoAshareMarketAdapter(
        clock: () => DateTime(2026, 8, 14, 15, 15),
      );

      final snapshot = await adapter.snapshot('600519');

      expect(snapshot.quote.security.name, '贵州茅台');
      expect(snapshot.quote.previousClose, 1729);
      expect(snapshot.quote.limitUp, closeTo(1901.9, 0.01));
      expect(snapshot.quote.limitDown, closeTo(1556.1, 0.01));
      expect(snapshot.source.name, 'StockCal 演示行情');
      expect(snapshot.source.state, MarketDataState.delayed);
      expect(snapshot.dailyCandles.length, greaterThanOrEqualTo(30));
      expect(
        snapshot.dailyCandles.first.day.isBefore(
          snapshot.dailyCandles.last.day,
        ),
        isTrue,
      );
    },
  );
}
