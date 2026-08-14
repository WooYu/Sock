import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/portfolio/portfolio.dart';
import 'package:stockcal/features/portfolio/portfolio_controller.dart';
import 'package:stockcal/features/portfolio/portfolio_ledger.dart';
import 'package:stockcal/features/portfolio/portfolio_screen.dart';

void main() {
  testWidgets('records a buy and updates portfolio summary and ledger', (
    tester,
  ) async {
    final controller = PortfolioController(
      marketPrices: const {'600519': 12},
      portfolios: [
        Portfolio(
          id: 'p1',
          name: '默认组合',
          ledger: PortfolioLedger(openingCash: 200000),
        ),
      ],
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: PortfolioScreen(controller: controller)),
      ),
    );

    expect(find.text('暂无持仓'), findsOneWidget);
    await tester.tap(find.byTooltip('记一笔交易'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('买入').last);
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('trade-code')), '600519');
    await tester.enterText(find.byKey(const Key('trade-name')), '贵州茅台');
    await tester.enterText(find.byKey(const Key('trade-quantity')), '100');
    await tester.enterText(find.byKey(const Key('trade-price')), '10');
    await tester.enterText(find.byKey(const Key('trade-fee')), '5');
    await tester.tap(find.text('保存'));
    await tester.pumpAndSettle();

    expect(find.text('贵州茅台'), findsNWidgets(2));
    expect(find.text('600519  100 股'), findsOneWidget);
    expect(find.text('浮动盈亏 ¥195.00'), findsOneWidget);
    expect(find.text('买入 100 股 @ ¥10.00'), findsOneWidget);
  });

  testWidgets('sample import previews, commits, and can be undone', (
    tester,
  ) async {
    final controller = PortfolioController(
      marketPrices: const {'000001': 14},
      portfolios: [
        Portfolio(
          id: 'p1',
          name: '默认组合',
          ledger: PortfolioLedger(openingCash: 100000),
        ),
      ],
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: PortfolioScreen(controller: controller)),
      ),
    );

    await tester.tap(find.byTooltip('导入交易'));
    await tester.pumpAndSettle();
    expect(find.text('预览 2 条记录'), findsOneWidget);
    expect(find.text('校验通过'), findsOneWidget);
    await tester.tap(find.text('确认导入'));
    await tester.pumpAndSettle();

    expect(find.text('已导入 2 条记录'), findsOneWidget);
    await tester.tap(find.text('撤销导入'));
    await tester.pumpAndSettle();
    expect(find.text('暂无持仓'), findsOneWidget);
  });

  testWidgets('switches between portfolios and shows the active ledger', (
    tester,
  ) async {
    final controller = PortfolioController(
      marketPrices: const {'600519': 120},
      portfolios: [
        Portfolio(
          id: 'p1',
          name: '长线',
          ledger: PortfolioLedger()
            ..record(
              TradeEntry.buy(
                id: 'a-buy',
                occurredAt: DateTime(2026, 8, 1),
                code: '600519',
                name: '贵州茅台',
                quantity: 10,
                price: 100,
                fee: 0,
              ),
            ),
        ),
        Portfolio(id: 'p2', name: '波段'),
      ],
      activeId: 'p1',
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: PortfolioScreen(controller: controller)),
      ),
    );

    expect(find.text('贵州茅台'), findsWidgets);

    await tester.tap(find.byKey(const Key('portfolio-switcher')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('波段').last);
    await tester.pumpAndSettle();

    expect(find.text('暂无持仓'), findsOneWidget);
  });

  testWidgets('shows aggregate totals across all portfolios', (tester) async {
    final controller = PortfolioController(
      marketPrices: const {'600519': 120, '000001': 15},
      portfolios: [
        Portfolio(
          id: 'p1',
          name: '长线',
          ledger: PortfolioLedger()
            ..record(
              TradeEntry.buy(
                id: 'a-buy',
                occurredAt: DateTime(2026, 8, 1),
                code: '600519',
                name: '贵州茅台',
                quantity: 10,
                price: 100,
                fee: 0,
              ),
            ),
        ),
        Portfolio(
          id: 'p2',
          name: '波段',
          ledger: PortfolioLedger()
            ..record(
              TradeEntry.buy(
                id: 'b-buy',
                occurredAt: DateTime(2026, 8, 1),
                code: '000001',
                name: '平安银行',
                quantity: 20,
                price: 10,
                fee: 0,
              ),
            ),
        ),
      ],
      activeId: 'p1',
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: PortfolioScreen(controller: controller)),
      ),
    );

    expect(find.textContaining('市值 ¥1500.00'), findsOneWidget);
    expect(find.textContaining('累计盈亏 ¥300.00'), findsOneWidget);
  });

  testWidgets('creates, renames, and deletes portfolios from the actions menu', (
    tester,
  ) async {
    final controller = PortfolioController(
      marketPrices: const {},
      portfolios: [
        Portfolio(id: 'p1', name: '长线'),
        Portfolio(id: 'p2', name: '波段'),
      ],
      activeId: 'p1',
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: PortfolioScreen(controller: controller)),
      ),
    );

    await tester.tap(find.byKey(const Key('portfolio-actions')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('新建组合'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('portfolio-name')), '打新');
    await tester.tap(find.text('确定'));
    await tester.pumpAndSettle();
    expect(find.text('打新'), findsOneWidget);

    await tester.tap(find.byKey(const Key('portfolio-actions')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('重命名'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('portfolio-name')), '打新账户');
    await tester.tap(find.text('确定'));
    await tester.pumpAndSettle();
    expect(find.text('打新账户'), findsOneWidget);

    await tester.tap(find.byKey(const Key('portfolio-actions')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('删除组合'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('删除'));
    await tester.pumpAndSettle();
    expect(find.text('打新账户'), findsNothing);
    expect(controller.portfolios.map((p) => p.name), ['长线', '波段']);
  });
}
