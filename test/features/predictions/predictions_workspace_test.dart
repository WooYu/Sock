import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/market/market_data.dart';
import 'package:stockcal/features/predictions/predictions_workspace.dart';
import 'package:stockcal/features/rules/prediction_store.dart';
import 'package:stockcal/features/rules/rule_engine.dart';

void main() {
  testWidgets('PredictionsWorkspace lists records from repository', (
    tester,
  ) async {
    final repo = MemoryPredictionRepository();
    final service = PredictionService(repository: repo, idFactory: () => 'p1');
    final candles = DemoAshareData.candlesFor('600519');
    await service.generate(
      stockCode: '600519',
      candles: candles,
      matchedRules: const <RuleVersion>[],
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PredictionsWorkspace(repository: repo, stockCode: '600519'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('预测记录'), findsOneWidget);
    expect(find.byType(ListTile), findsOneWidget);
  });
}
