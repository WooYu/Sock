import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/charts/statistics_workspace.dart';
import 'package:stockcal/features/portfolio/portfolio_controller.dart';
import 'package:stockcal/features/portfolio/portfolio_ledger.dart';

void main() {
  testWidgets('StatisticsWorkspace shows title and empty states', (
    tester,
  ) async {
    final portfolio = PortfolioController(marketPrices: const {});
    await tester.pumpWidget(
      MaterialApp(home: Scaffold(body: StatisticsWorkspace(portfolio: portfolio))),
    );
    expect(find.text('统计图表'), findsOneWidget);
    expect(find.text('持仓分布'), findsOneWidget);
    expect(find.text('收益曲线'), findsOneWidget);
    expect(find.text('暂无历史净值'), findsOneWidget);
  });

  testWidgets('StatisticsWorkspace renders equity curve from realized profit', (
    tester,
  ) async {
    final portfolio = PortfolioController(marketPrices: const {});
    portfolio.record(
      type: TradeEntryType.buy,
      code: '600519',
      name: '贵州茅台',
      quantity: 100,
      price: 10,
      fee: 0,
      cashAmount: 0,
      note: '',
    );
    portfolio.record(
      type: TradeEntryType.sell,
      code: '600519',
      name: '贵州茅台',
      quantity: 100,
      price: 12,
      fee: 0,
      cashAmount: 0,
      note: '',
    );

    await tester.pumpWidget(
      MaterialApp(home: Scaffold(body: StatisticsWorkspace(portfolio: portfolio))),
    );
    expect(find.byKey(const Key('equity-curve')), findsOneWidget);
  });
}
