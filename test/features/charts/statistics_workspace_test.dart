import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/charts/statistics_workspace.dart';
import 'package:stockcal/features/portfolio/portfolio_controller.dart';

void main() {
  testWidgets('StatisticsWorkspace shows title and section', (tester) async {
    final portfolio = PortfolioController(marketPrices: const {});
    await tester.pumpWidget(
      MaterialApp(home: Scaffold(body: StatisticsWorkspace(portfolio: portfolio))),
    );
    expect(find.text('统计图表'), findsOneWidget);
    expect(find.text('持仓分布'), findsOneWidget);
  });
}
