import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/core/display.dart';
import 'package:stockcal/theme/stockcal_theme.dart';

void main() {
  testWidgets('dark theme uses financial background and sharp gain/loss colors',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      theme: buildStockCalTheme(Brightness.dark),
      home: const Scaffold(body: SizedBox()),
    ));
    final context = tester.element(find.byType(Scaffold));
    expect(Theme.of(context).brightness, Brightness.dark);
    expect(Theme.of(context).scaffoldBackgroundColor, StockCalColors.bg);
    expect(gainColor(context), StockCalColors.gain);
    expect(lossColor(context), StockCalColors.loss);
  });

  testWidgets('light theme keeps A-share red-up green-down convention',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      theme: buildStockCalTheme(Brightness.light),
      home: const Scaffold(body: SizedBox()),
    ));
    final context = tester.element(find.byType(Scaffold));
    expect(gainColor(context), StockCalColors.lightGain);
    expect(lossColor(context), StockCalColors.lightLoss);
  });
}
