import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/analysis/technical_analysis.dart';
import 'package:stockcal/features/future/future_workspace.dart';
import 'package:stockcal/features/market/market_data.dart';

void main() {
  testWidgets('FutureWorkspace lists three future sessions', (tester) async {
    final analysis = StockAnalyzer().analyze(
      DemoAshareData.candlesFor('600519'),
    );
    await tester.pumpWidget(
      MaterialApp(home: Scaffold(body: FutureWorkspace(analysis: analysis))),
    );
    expect(find.text('未来指标'), findsOneWidget);
    expect(find.byType(ListTile), findsNWidgets(3));
  });
}
