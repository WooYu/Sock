import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/portfolio/portfolio_controller.dart';
import 'package:stockcal/features/portfolio/portfolio_ledger.dart';
import 'package:stockcal/features/portfolio/portfolio_screen.dart';

void main() {
  testWidgets('records a buy and updates portfolio summary and ledger', (
    tester,
  ) async {
    final controller = PortfolioController(
      ledger: PortfolioLedger(openingCash: 200000),
      marketPrices: const {'600519': 12},
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
      ledger: PortfolioLedger(openingCash: 100000),
      marketPrices: const {'000001': 14},
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
}
