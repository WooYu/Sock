import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/analysis/technical_analysis.dart';
import 'package:stockcal/features/market/market_data.dart';
import 'package:stockcal/features/patterns/patterns_workspace.dart';
import 'package:stockcal/features/rules/rule_engine.dart';

void main() {
  testWidgets('PatternsWorkspace lists active rules', (tester) async {
    final book = RuleBook.withSystemDefaults();
    await tester.pumpWidget(
      MaterialApp(home: Scaffold(body: PatternsWorkspace(ruleBook: book))),
    );
    expect(find.text('盈利模式'), findsOneWidget);
    expect(find.text(book.activeRules.first.name), findsWidgets);
    expect(find.text('待定'), findsWidgets);
  });

  testWidgets('PatternsWorkspace evaluates matches from analysis', (
    tester,
  ) async {
    final book = RuleBook.withSystemDefaults();
    final analysis = StockAnalyzer(ruleBook: book).analyze(
      DemoAshareData.candlesFor('600519'),
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PatternsWorkspace(ruleBook: book, analysis: analysis),
        ),
      ),
    );
    expect(find.text('命中'), findsWidgets);
    expect(find.text('命中率'), findsOneWidget);
  });
}
