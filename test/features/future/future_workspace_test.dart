import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/analysis/technical_analysis.dart';
import 'package:stockcal/features/future/future_workspace.dart';
import 'package:stockcal/features/market/market_data.dart';

void main() {
  testWidgets('FutureWorkspace lists all MA and BOLL periods', (tester) async {
    final analysis = StockAnalyzer().analyze(
      DemoAshareData.candlesFor('600519'),
    );
    await tester.pumpWidget(
      MaterialApp(home: Scaffold(body: FutureWorkspace(analysis: analysis))),
    );
    expect(find.text('未来指标'), findsOneWidget);
    expect(find.text('MA5'), findsOneWidget);
    expect(find.text('MA10'), findsOneWidget);
    expect(find.text('MA20'), findsOneWidget);
    expect(find.text('MA30'), findsOneWidget);
    expect(find.text('MA60'), findsOneWidget);
    expect(find.text('MA90'), findsOneWidget);
    expect(find.text('MA120'), findsOneWidget);
    expect(find.text('MA250'), findsOneWidget);
    expect(find.text('BOLL上'), findsOneWidget);
    expect(find.text('BOLL下'), findsOneWidget);
  });
}
