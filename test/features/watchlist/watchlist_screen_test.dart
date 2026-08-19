import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/market/market_data.dart';
import 'package:stockcal/features/watchlist/watchlist.dart';
import 'package:stockcal/features/watchlist/watchlist_screen.dart';

class _FakeCatalog implements StockCatalog {
  @override
  Future<List<Security>> search(String query, {int limit = 20}) async {
    return const [
      Security(
        code: '600519',
        name: '贵州茅台',
        pinyin: 'gzmt',
        initials: 'gzmt',
        exchange: 'SH',
        industry: '白酒',
      ),
    ];
  }
}

void main() {
  testWidgets('user creates a group and adds a searched stock', (tester) async {
    final controller = WatchlistController(
      repository: MemoryWatchlistRepository(),
      outbox: MemoryMutationOutbox(),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: WatchlistScreen(
          controller: controller,
          catalog: _FakeCatalog(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('还没有自选分组'), findsOneWidget);
    await tester.tap(find.byTooltip('新建自选分组'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('group-name-field')), '今日观察');
    await tester.tap(find.text('创建'));
    await tester.pumpAndSettle();

    expect(find.text('今日观察'), findsOneWidget);
    await tester.tap(find.byTooltip('添加股票'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const Key('stock-search-field')),
      '600519',
    );
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();
    await tester.tap(find.text('贵州茅台'));
    await tester.pumpAndSettle();

    expect(find.text('600519'), findsOneWidget);
    expect(find.text('待同步 2 项'), findsOneWidget);
  });
}
